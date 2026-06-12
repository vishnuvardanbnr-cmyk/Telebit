import { Router } from "express";
import { db, incomeLogTable, userPackagesTable, royaltyDistributionsTable, royaltyDailyPayoutsTable } from "@workspace/db";
import { eq, desc, and, sum } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

// ─── User: income history ─────────────────────────────────────────────────────

router.get("/income", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const type = req.query.type as string | undefined;

  let rows;
  if (type) {
    rows = await db.select().from(incomeLogTable)
      .where(and(eq(incomeLogTable.userId, user.id), eq(incomeLogTable.type, type)))
      .orderBy(desc(incomeLogTable.createdAt))
      .limit(limit).offset(offset);
  } else {
    rows = await db.select().from(incomeLogTable)
      .where(eq(incomeLogTable.userId, user.id))
      .orderBy(desc(incomeLogTable.createdAt))
      .limit(limit).offset(offset);
  }

  res.json(rows);
});

// ─── User: income summary ─────────────────────────────────────────────────────

router.get("/income/summary", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;

  const [roi] = await db.select({ total: sum(incomeLogTable.amount) }).from(incomeLogTable)
    .where(and(eq(incomeLogTable.userId, user.id), eq(incomeLogTable.type, "roi")));
  const [referral] = await db.select({ total: sum(incomeLogTable.amount) }).from(incomeLogTable)
    .where(and(eq(incomeLogTable.userId, user.id), eq(incomeLogTable.type, "referral")));
  const [royalty] = await db.select({ total: sum(incomeLogTable.amount) }).from(incomeLogTable)
    .where(and(eq(incomeLogTable.userId, user.id), eq(incomeLogTable.type, "royalty")));
  const [rankReward] = await db.select({ total: sum(incomeLogTable.amount) }).from(incomeLogTable)
    .where(and(eq(incomeLogTable.userId, user.id), eq(incomeLogTable.type, "rank_reward")));

  const activePackages = await db.select().from(userPackagesTable)
    .where(and(eq(userPackagesTable.userId, user.id), eq(userPackagesTable.isActive, true)));

  res.json({
    roi: roi?.total ?? "0",
    referral: referral?.total ?? "0",
    royalty: royalty?.total ?? "0",
    rankReward: rankReward?.total ?? "0",
    activePackages: activePackages.length,
    packages: activePackages,
  });
});

// ─── Admin: income overview ───────────────────────────────────────────────────

router.get("/admin/income", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const rows = await db.select().from(incomeLogTable)
    .orderBy(desc(incomeLogTable.createdAt))
    .limit(limit).offset(offset);

  const [totals] = await db.select({
    total: sum(incomeLogTable.amount),
  }).from(incomeLogTable);

  res.json({ entries: rows, total: totals?.total ?? "0" });
});

// ─── Admin: excess wallet ─────────────────────────────────────────────────────

router.get("/admin/excess-wallet", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const pending = await db.select().from(royaltyDistributionsTable)
    .where(eq(royaltyDistributionsTable.isComplete, false));

  res.json({
    pendingDistributions: pending.length,
    distributions: pending,
  });
});

export default router;
