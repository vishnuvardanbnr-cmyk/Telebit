import { Router } from "express";
import { db, usersTable, withdrawalsTable, royaltyDistributionsTable, royaltyDailyPayoutsTable, incomeLogTable, userPackagesTable } from "@workspace/db";
import { eq, desc, and, gte, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getSettings, updateSettings } from "../lib/settings";
import { getProvider, sweepUsdt, sendBnbGas, getBnbBalance } from "../lib/wallet";
import { encrypt } from "../lib/crypto";
import { ethers } from "ethers";
import { logger } from "../lib/logger";
import { generateDailyAmounts } from "./packages";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function distributeRoyalty(withdrawalId: string, withdrawerId: string, grossAmount: number) {
  const royaltyTotal = parseFloat((grossAmount * 0.15).toFixed(8));
  const perUplineAmount = parseFloat((royaltyTotal / 10).toFixed(8));

  // Traverse upline chain (up to 10 levels)
  const uplines: string[] = [];
  let currentUserId = withdrawerId;
  for (let i = 0; i < 10; i++) {
    const [current] = await db.select({ uplineId: usersTable.uplineId }).from(usersTable).where(eq(usersTable.id, currentUserId));
    if (!current?.uplineId) break;
    uplines.push(current.uplineId);
    currentUserId = current.uplineId;
  }

  // Leftover for missing upline levels → admin excess wallet
  const missingLevels = 10 - uplines.length;
  if (missingLevels > 0) {
    const leftover = parseFloat((missingLevels * perUplineAmount).toFixed(8));
    const settings = await getSettings();
    const currentExcess = parseFloat(settings.adminExcessWallet || "0");
    await updateSettings({ adminExcessWallet: String(currentExcess + leftover) });
  }

  // Create royalty distributions + daily payout schedules
  const now = new Date();
  for (let i = 0; i < uplines.length; i++) {
    const uplineUserId = uplines[i];

    const [dist] = await db.insert(royaltyDistributionsTable).values({
      withdrawalId,
      uplineUserId,
      level: i + 1,
      totalAmount: String(perUplineAmount),
      totalDays: 15,
    }).returning();

    const dailyAmounts = generateDailyAmounts(perUplineAmount, 15);
    const payouts = dailyAmounts.map((amount, dayIdx) => ({
      distributionId: dist.id,
      dayNumber: dayIdx + 1,
      amount: String(amount),
      scheduledFor: new Date(now.getTime() + dayIdx * 24 * 60 * 60 * 1000),
    }));

    await db.insert(royaltyDailyPayoutsTable).values(payouts);
  }

  logger.info({ withdrawalId, withdrawerId, uplines: uplines.length }, "Royalty distribution created");
}

// ─── GET /withdrawals ─────────────────────────────────────────────────────────

router.get("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(withdrawals);
});

// ─── POST /withdrawals ────────────────────────────────────────────────────────

router.post("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { amount, destinationAddress } = req.body;

  if (!amount || !destinationAddress) {
    res.status(400).json({ error: "Amount and destination address are required" });
    return;
  }

  const settings = await getSettings();

  if (!settings.withdrawalEnabled) {
    res.status(400).json({ error: "Withdrawals are currently disabled by the admin" });
    return;
  }

  if (user.withdrawalBlocked) {
    res.status(400).json({ error: "Your account has a withdrawal block. Contact support." });
    return;
  }

  // Must have at least one active package to withdraw
  const [activePkg] = await db.select({ id: userPackagesTable.id }).from(userPackagesTable)
    .where(and(eq(userPackagesTable.userId, user.id), eq(userPackagesTable.isActive, true)))
    .limit(1);
  if (!activePkg) {
    res.status(400).json({ error: "You must have an active investment package to withdraw. Please purchase a package first." });
    return;
  }

  // Only allow 1st or 15th of the month
  const today = new Date();
  const dayOfMonth = today.getDate();
  if (dayOfMonth !== 1 && dayOfMonth !== 15) {
    res.status(400).json({ error: "Withdrawals are only processed on the 1st and 15th of each month" });
    return;
  }

  // Max 2 withdrawals per calendar month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [monthCount] = await db.select({ cnt: count() }).from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.userId, user.id), gte(withdrawalsTable.createdAt, monthStart)));
  if (Number(monthCount?.cnt ?? 0) >= 2) {
    res.status(400).json({ error: "Maximum 2 withdrawals allowed per month" });
    return;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  // Minimum $10
  if (amountNum < 10) {
    res.status(400).json({ error: "Minimum withdrawal amount is $10 USDT" });
    return;
  }

  // Draw from income balance (biddingProfitBalance)
  const incomeBalance = parseFloat(user.biddingProfitBalance);
  if (incomeBalance < amountNum) {
    res.status(400).json({ error: `Insufficient income balance. Required: ${amountNum.toFixed(4)} USDT, available: ${incomeBalance.toFixed(4)} USDT` });
    return;
  }

  // 15% royalty deduction
  const royaltyAmount = parseFloat((amountNum * 0.15).toFixed(8));
  const afterRoyalty = parseFloat((amountNum - royaltyAmount).toFixed(8));

  // Platform fee on the after-royalty amount (collected for dev wallet)
  const flatFee = parseFloat(settings.withdrawFeeFlat);
  const percentFee = afterRoyalty * (parseFloat(settings.withdrawFeePercent) / 100);
  const totalFee = flatFee + percentFee;

  let netAmount: number;
  let deductFrom: number;

  if (settings.withdrawFeeMode === "deduct_from_amount") {
    netAmount = parseFloat(Math.max(0, afterRoyalty - totalFee).toFixed(8));
    deductFrom = amountNum;
  } else {
    netAmount = afterRoyalty;
    deductFrom = parseFloat((amountNum + totalFee).toFixed(8));
  }

  if (incomeBalance < deductFrom) {
    res.status(400).json({ error: `Insufficient income balance. Required: ${deductFrom.toFixed(4)} USDT` });
    return;
  }

  // Deduct from income balance
  await db.update(usersTable)
    .set({ biddingProfitBalance: String(incomeBalance - deductFrom), lastWithdrawalAt: new Date() } as any)
    .where(eq(usersTable.id, user.id));

  const [withdrawal] = await db.insert(withdrawalsTable).values({
    userId: user.id,
    amount: String(amountNum),
    fee: String(totalFee + royaltyAmount),
    netAmount: String(netAmount),
    destinationAddress,
    status: "pending",
  }).returning();

  // Accumulate dev fees
  if (totalFee > 0) {
    const currentAccumulated = parseFloat(settings.devAccumulatedFees || "0");
    await updateSettings({ devAccumulatedFees: String(currentAccumulated + totalFee) });
  }

  // Distribute royalty (fire-and-forget)
  distributeRoyalty(withdrawal.id, user.id, amountNum).catch((err) =>
    logger.error({ err, withdrawalId: withdrawal.id }, "Royalty distribution error")
  );

  // Auto mode: execute on-chain immediately if configured
  if (settings.withdrawalMode === "auto" && settings.withdrawWalletPrivateKey) {
    try {
      const provider = getProvider(settings.bscRpcUrl);
      if (settings.gasWalletPrivateKey) {
        const withdrawWallet = new ethers.Wallet(settings.withdrawWalletPrivateKey, provider);
        const bnbBalance = await getBnbBalance(withdrawWallet.address, provider);
        if (bnbBalance < ethers.parseEther("0.001")) {
          await sendBnbGas(withdrawWallet.address, ethers.parseEther("0.002"), settings.gasWalletPrivateKey, provider);
        }
      }
      const encryptedKey = encrypt(settings.withdrawWalletPrivateKey);
      const txHash = await sweepUsdt(encryptedKey, destinationAddress, ethers.parseUnits(String(netAmount), 18), provider);
      await db.update(withdrawalsTable)
        .set({ status: "approved", txHash, processedAt: new Date() })
        .where(eq(withdrawalsTable.id, withdrawal.id));
      withdrawal.status = "approved";
      withdrawal.txHash = txHash;
    } catch (err) {
      logger.error({ err, withdrawalId: withdrawal.id }, "Auto withdrawal failed");
    }
  }

  res.status(201).json({ ...withdrawal, royaltyDeducted: royaltyAmount });
});

export default router;
