import { Router } from "express";
import { db, usersTable, depositsTable, withdrawalsTable } from "@workspace/db";
import { eq, sum, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    fullName: user.fullName,
    walletBalance: user.walletBalance,
    earningsBalance: user.earningsBalance,
    depositAddress: user.depositAddress,
    referralCode: user.referralCode,
    isAdmin: user.isAdmin,
    withdrawalBlocked: user.withdrawalBlocked,
    createdAt: user.createdAt,
  });
});

router.get("/users/me/dashboard", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;

  const [depositTotals] = await db
    .select({ total: sum(depositsTable.netAmount) })
    .from(depositsTable)
    .where(eq(depositsTable.userId, user.id));

  const [withdrawalTotals] = await db
    .select({ total: sum(withdrawalsTable.netAmount) })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id));

  const pendingWithdrawals = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id));

  const recentDeposits = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.userId, user.id))
    .orderBy(depositsTable.createdAt)
    .limit(5);

  const recentWithdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id))
    .orderBy(withdrawalsTable.createdAt)
    .limit(5);

  res.json({
    walletBalance: user.walletBalance,
    earningsBalance: user.earningsBalance,
    depositAddress: user.depositAddress,
    totalDeposited: depositTotals?.total ?? "0",
    totalWithdrawn: withdrawalTotals?.total ?? "0",
    pendingWithdrawals: pendingWithdrawals[0]?.total ?? "0",
    recentDeposits,
    recentWithdrawals,
    recentP2P: [],
  });
});

export default router;
