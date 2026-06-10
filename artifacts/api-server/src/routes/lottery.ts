import { Router } from "express";
import { db, usersTable, lotteriesTable, lotteryTicketsTable } from "@workspace/db";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

/* ─── helpers ─────────────────────────────────────────────── */
async function generateTicketNumber(lotteryId: string): Promise<string> {
  for (let attempts = 0; attempts < 200; attempts++) {
    const n = String(Math.floor(100 + Math.random() * 900));
    const taken = await db.select({ id: lotteryTicketsTable.id })
      .from(lotteryTicketsTable)
      .where(and(eq(lotteryTicketsTable.lotteryId, lotteryId), eq(lotteryTicketsTable.ticketNumber, n)))
      .limit(1);
    if (taken.length === 0) return n;
  }
  throw new Error("No ticket numbers available");
}

/* ─── Public: list lotteries ──────────────────────────────── */
router.get("/lottery", async (req, res): Promise<void> => {
  try {
    const { status } = req.query as { status?: string };
    let query = db.select().from(lotteriesTable).orderBy(desc(lotteriesTable.createdAt));
    if (status) {
      const rows = await db.select().from(lotteriesTable)
        .where(eq(lotteriesTable.status, status as "draft" | "active" | "completed" | "cancelled"))
        .orderBy(desc(lotteriesTable.createdAt));
      res.json(rows);
      return;
    }
    const rows = await query;
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Auth: my tickets ─────────────────────────────────────── */
router.get("/lottery/my-tickets", requireAuth, async (req, res): Promise<void> => {
  try {
    const dbUser = (req as any).dbUser;
    const tickets = await db
      .select({
        id: lotteryTicketsTable.id,
        lotteryId: lotteryTicketsTable.lotteryId,
        ticketNumber: lotteryTicketsTable.ticketNumber,
        status: lotteryTicketsTable.status,
        purchasedAt: lotteryTicketsTable.purchasedAt,
        lotteryTitle: lotteriesTable.title,
        lotteryStatus: lotteriesTable.status,
        prizePool: lotteriesTable.prizePool,
        currency: lotteriesTable.currency,
      })
      .from(lotteryTicketsTable)
      .leftJoin(lotteriesTable, eq(lotteryTicketsTable.lotteryId, lotteriesTable.id))
      .where(eq(lotteryTicketsTable.userId, dbUser.id))
      .orderBy(desc(lotteryTicketsTable.purchasedAt));
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Public: single lottery ───────────────────────────────── */
router.get("/lottery/:id", async (req, res): Promise<void> => {
  try {
    const [lottery] = await db.select().from(lotteriesTable).where(eq(lotteriesTable.id, req.params.id)).limit(1);
    if (!lottery) { res.status(404).json({ error: "Lottery not found" }); return; }
    res.json(lottery);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Public: sold tickets for a lottery ──────────────────── */
router.get("/lottery/:id/tickets", async (req, res): Promise<void> => {
  try {
    const tickets = await db.select({
      id: lotteryTicketsTable.id,
      ticketNumber: lotteryTicketsTable.ticketNumber,
      status: lotteryTicketsTable.status,
      purchasedAt: lotteryTicketsTable.purchasedAt,
    })
      .from(lotteryTicketsTable)
      .where(eq(lotteryTicketsTable.lotteryId, req.params.id))
      .orderBy(lotteryTicketsTable.purchasedAt);
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Auth: purchase ticket ────────────────────────────────── */
router.post("/lottery/:id/purchase", requireAuth, async (req, res): Promise<void> => {
  try {
    const dbUser = (req as any).dbUser;
    const [lottery] = await db.select().from(lotteriesTable).where(eq(lotteriesTable.id, req.params.id)).limit(1);

    if (!lottery) { res.status(404).json({ error: "Lottery not found" }); return; }
    if (lottery.status !== "active") { res.status(400).json({ error: "Lottery is not active" }); return; }
    if (lottery.soldTickets >= lottery.maxTickets) { res.status(400).json({ error: "Lottery is sold out" }); return; }

    // Determine ticket number
    let ticketNumber: string;
    if (lottery.type === "custom" && req.body.ticketNumber) {
      const num = String(req.body.ticketNumber);
      if (!/^\d{3}$/.test(num) || parseInt(num) < 100 || parseInt(num) > 999) {
        res.status(400).json({ error: "Ticket number must be 3 digits (100–999)" }); return;
      }
      const [taken] = await db.select({ id: lotteryTicketsTable.id })
        .from(lotteryTicketsTable)
        .where(and(eq(lotteryTicketsTable.lotteryId, lottery.id), eq(lotteryTicketsTable.ticketNumber, num)))
        .limit(1);
      if (taken) { res.status(400).json({ error: "That number is already taken" }); return; }
      ticketNumber = num;
    } else {
      ticketNumber = await generateTicketNumber(lottery.id);
    }

    // Check balance
    const price = parseFloat(lottery.ticketPrice);
    const balance = parseFloat(dbUser.walletBalance);
    if (balance < price) { res.status(400).json({ error: "Insufficient wallet balance" }); return; }

    // Deduct balance
    await db.update(usersTable)
      .set({ walletBalance: String((balance - price).toFixed(8)) })
      .where(eq(usersTable.id, dbUser.id));

    // Create ticket
    const [ticket] = await db.insert(lotteryTicketsTable).values({
      lotteryId: lottery.id,
      userId: dbUser.id,
      ticketNumber,
      status: "purchased",
    }).returning();

    // Update lottery: soldTickets + prizePool
    const newPrize = (parseFloat(lottery.prizePool) + price).toFixed(8);
    await db.update(lotteriesTable)
      .set({
        soldTickets: lottery.soldTickets + 1,
        prizePool: newPrize,
      })
      .where(eq(lotteriesTable.id, lottery.id));

    res.json({ ticket, ticketNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Admin: list all lotteries ───────────────────────────── */
router.get("/admin/lottery", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const lotteries = await db.select().from(lotteriesTable).orderBy(desc(lotteriesTable.createdAt));
    const counts = await db
      .select({ lotteryId: lotteryTicketsTable.lotteryId, count: sql<number>`count(*)::int` })
      .from(lotteryTicketsTable)
      .groupBy(lotteryTicketsTable.lotteryId);
    const countMap = new Map(counts.map(c => [c.lotteryId, c.count]));
    res.json(lotteries.map(l => ({ ...l, ticketsSold: countMap.get(l.id) ?? 0 })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Admin: create lottery ────────────────────────────────── */
router.post("/admin/lottery", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const dbUser = (req as any).dbUser;
    const { title, subtitle, description, type, ticketPrice, maxTickets, drawDate, showOnDashboard } = req.body;
    if (!title || !ticketPrice || !maxTickets) {
      res.status(400).json({ error: "title, ticketPrice, maxTickets required" }); return;
    }
    const [lottery] = await db.insert(lotteriesTable).values({
      title, subtitle, description,
      type: type ?? "random",
      ticketPrice: String(parseFloat(ticketPrice).toFixed(8)),
      maxTickets: parseInt(maxTickets),
      adminId: dbUser.id,
      showOnDashboard: !!showOnDashboard,
      drawDate: drawDate ? new Date(drawDate) : undefined,
      status: "draft",
    }).returning();
    res.json(lottery);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Admin: update lottery ────────────────────────────────── */
router.put("/admin/lottery/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const updates: Record<string, unknown> = {};
    const allowed = ["title", "subtitle", "description", "status", "drawDate", "showOnDashboard", "maxTickets"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = key === "drawDate" && req.body[key] ? new Date(req.body[key]) : req.body[key];
      }
    }
    const [lottery] = await db.update(lotteriesTable).set(updates).where(eq(lotteriesTable.id, req.params.id)).returning();
    res.json(lottery);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Admin: draw winner ───────────────────────────────────── */
router.post("/admin/lottery/:id/draw", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const [lottery] = await db.select().from(lotteriesTable).where(eq(lotteriesTable.id, req.params.id)).limit(1);
    if (!lottery) { res.status(404).json({ error: "Lottery not found" }); return; }
    if (lottery.status !== "active") { res.status(400).json({ error: "Only active lotteries can be drawn" }); return; }

    const tickets = await db.select().from(lotteryTicketsTable).where(eq(lotteryTicketsTable.lotteryId, lottery.id));
    if (tickets.length === 0) { res.status(400).json({ error: "No tickets sold" }); return; }

    // Pick winner randomly (or use preset)
    const { presetTicketNumber } = req.body;
    let winner = presetTicketNumber
      ? tickets.find(t => t.ticketNumber === presetTicketNumber)
      : tickets[Math.floor(Math.random() * tickets.length)];

    if (!winner) winner = tickets[Math.floor(Math.random() * tickets.length)]!;

    // Mark winner ticket
    await db.update(lotteryTicketsTable)
      .set({ status: "winning" })
      .where(eq(lotteryTicketsTable.id, winner.id));

    // Mark all other tickets as losing
    await db.update(lotteryTicketsTable)
      .set({ status: "losing" })
      .where(and(eq(lotteryTicketsTable.lotteryId, lottery.id), ne(lotteryTicketsTable.id, winner.id)));

    // Credit prize to winner
    const [winnerUser] = await db.select().from(usersTable).where(eq(usersTable.id, winner.userId)).limit(1);
    if (winnerUser) {
      const newBalance = (parseFloat(winnerUser.walletBalance) + parseFloat(lottery.prizePool)).toFixed(8);
      await db.update(usersTable).set({ walletBalance: newBalance }).where(eq(usersTable.id, winnerUser.id));
    }

    // Mark lottery completed
    const [updated] = await db.update(lotteriesTable)
      .set({ status: "completed", winnerId: winner.userId, winnerTicket: winner.ticketNumber })
      .where(eq(lotteriesTable.id, lottery.id))
      .returning();

    res.json({ lottery: updated, winnerTicket: winner.ticketNumber, winnerId: winner.userId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Admin: delete lottery ────────────────────────────────── */
router.delete("/admin/lottery/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const lotteryId = String(req.params.id);
    await db.delete(lotteryTicketsTable).where(eq(lotteryTicketsTable.lotteryId, lotteryId));
    await db.delete(lotteriesTable).where(eq(lotteriesTable.id, lotteryId));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
