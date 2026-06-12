import { Router } from "express";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const SUBSCRIPTION_AMOUNT = 35;
const REFERRAL_BONUS = 10;

router.get("/subscription/status", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  res.json({ active: user.subscriptionActive });
});

router.post("/subscription", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;

  if (user.subscriptionActive) {
    res.status(400).json({ error: "You already have an active subscription" });
    return;
  }

  if (parseFloat(user.walletBalance) < SUBSCRIPTION_AMOUNT) {
    res.status(400).json({ error: `Insufficient balance. Required: $${SUBSCRIPTION_AMOUNT} USDT` });
    return;
  }

  const newWallet = parseFloat(user.walletBalance) - SUBSCRIPTION_AMOUNT;
  const newInvested = parseFloat((user as any).investedUsdt ?? "0") + SUBSCRIPTION_AMOUNT;
  await db.update(usersTable)
    .set({
      walletBalance: String(newWallet),
      subscriptionActive: true,
      investedUsdt: String(newInvested),
    } as any)
    .where(eq(usersTable.id, user.id));

  let bonusPaid = 0;
  if (user.uplineId) {
    const [upline] = await db.select().from(usersTable).where(eq(usersTable.id, user.uplineId));
    if (upline) {
      bonusPaid = REFERRAL_BONUS;
      const newUplineWallet = parseFloat(upline.walletBalance) + REFERRAL_BONUS;
      const newUplineTotalIncome = parseFloat(upline.totalIncomeEarned) + REFERRAL_BONUS;
      await db.update(usersTable)
        .set({
          walletBalance: String(newUplineWallet),
          totalIncomeEarned: String(newUplineTotalIncome),
        } as any)
        .where(eq(usersTable.id, upline.id));
    }
  }

  await db.insert(subscriptionsTable).values({
    userId: user.id,
    uplineId: user.uplineId ?? null,
    amount: String(SUBSCRIPTION_AMOUNT),
    referralBonus: String(bonusPaid),
  });

  res.json({
    success: true,
    message: "Subscription activated successfully",
    newWalletBalance: String(newWallet),
    referralBonusPaid: bonusPaid,
  });
});

export default router;
