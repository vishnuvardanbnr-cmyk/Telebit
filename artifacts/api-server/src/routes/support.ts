import { Router } from "express";
import { db, supportTicketsTable, supportMessagesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

function ticketOut(t: typeof supportTicketsTable.$inferSelect) {
  return {
    id: t.id,
    userId: t.userId,
    userName: t.userName,
    userEmail: t.userEmail,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
  };
}

function msgOut(m: typeof supportMessagesTable.$inferSelect) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    senderName: m.senderName,
    isAdmin: m.isAdmin,
    message: m.message,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  };
}

/* ─── User routes ─────────────────────────────────────────────── */

router.get("/support/tickets", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const tickets = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, user.id))
    .orderBy(desc(supportTicketsTable.updatedAt));
  res.json({ data: tickets.map(ticketOut) });
});

router.post("/support/tickets", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const { subject, message } = req.body as { subject: string; message?: string };
  if (!subject?.trim()) {
    res.status(400).json({ error: "Subject is required" });
    return;
  }
  const [ticket] = await db.insert(supportTicketsTable).values({
    userId: user.id,
    userName: user.fullName ?? user.email,
    userEmail: user.email,
    subject: subject.trim(),
  }).returning();

  if (message?.trim()) {
    await db.insert(supportMessagesTable).values({
      ticketId: ticket.id,
      senderName: user.fullName ?? user.email,
      isAdmin: false,
      message: message.trim(),
    });
  }
  res.status(201).json(ticketOut(ticket));
});

router.get("/support/tickets/:id", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const id = parseInt(req.params["id"] as string);
  const [ticket] = await db.select().from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, user.id)));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const messages = await db.select().from(supportMessagesTable)
    .where(eq(supportMessagesTable.ticketId, id))
    .orderBy(supportMessagesTable.createdAt);
  res.json({ ticket: ticketOut(ticket), messages: messages.map(msgOut) });
});

router.post("/support/tickets/:id/messages", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const id = parseInt(req.params["id"] as string);
  const { message } = req.body as { message: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }
  const [ticket] = await db.select().from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, user.id)));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (ticket.status === "closed") { res.status(400).json({ error: "Ticket is closed" }); return; }
  const [msg] = await db.insert(supportMessagesTable).values({
    ticketId: id,
    senderName: user.fullName ?? user.email,
    isAdmin: false,
    message: message.trim(),
  }).returning();
  await db.update(supportTicketsTable)
    .set({ updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
  res.status(201).json(msgOut(msg));
});

/* ─── Admin routes ─────────────────────────────────────────────── */

router.get("/support/admin/tickets", requireAdmin, async (_req, res) => {
  const tickets = await db.select().from(supportTicketsTable)
    .orderBy(desc(supportTicketsTable.updatedAt));
  res.json({ data: tickets.map(ticketOut) });
});

router.get("/support/admin/tickets/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const [ticket] = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const messages = await db.select().from(supportMessagesTable)
    .where(eq(supportMessagesTable.ticketId, id))
    .orderBy(supportMessagesTable.createdAt);
  res.json({ ticket: ticketOut(ticket), messages: messages.map(msgOut) });
});

router.put("/support/admin/tickets/:id/status", requireAdmin, async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { status } = req.body as { status: string };
  if (!["open", "in_progress", "closed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  const [updated] = await db.update(supportTicketsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(ticketOut(updated));
});

router.post("/support/admin/tickets/:id/messages", requireAdmin, async (req, res) => {
  const id = parseInt(req.params["id"] as string);
  const { message } = req.body as { message: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }
  const [ticket] = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const [msg] = await db.insert(supportMessagesTable).values({
    ticketId: id,
    senderName: "Support Team",
    isAdmin: true,
    message: message.trim(),
  }).returning();
  await db.update(supportTicketsTable)
    .set({ status: ticket.status === "open" ? "in_progress" : ticket.status, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
  res.status(201).json(msgOut(msg));
});

export default router;
