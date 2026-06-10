import { Router } from "express";
import { db, usersTable, depositsTable, withdrawalsTable, p2pTransfersTable } from "@workspace/db";
import { eq, desc, like, or, sum, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getSettings, updateSettings } from "../lib/settings";
import { getProvider, sweepUsdt, sendBnbGas, getBnbBalance } from "../lib/wallet";
import { encrypt } from "../lib/crypto";
import { ethers } from "ethers";
import { logger } from "../lib/logger";

const router = Router();

router.get("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const search = req.query.search as string | undefined;

  const users = await db.select().from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const filtered = search
    ? users.filter(u => u.email.includes(search) || (u.fullName?.includes(search)))
    : users;

  const result = await Promise.all(filtered.map(async (u) => {
    const [depTotal] = await db.select({ total: sum(depositsTable.netAmount) }).from(depositsTable).where(eq(depositsTable.userId, u.id));
    const [wdTotal] = await db.select({ total: sum(withdrawalsTable.netAmount) }).from(withdrawalsTable).where(eq(withdrawalsTable.userId, u.id));
    return {
      id: u.id,
      clerkId: u.clerkId,
      email: u.email,
      fullName: u.fullName,
      walletBalance: u.walletBalance,
      earningsBalance: u.earningsBalance,
      depositAddress: u.depositAddress,
      referralCode: u.referralCode,
      isAdmin: u.isAdmin,
      withdrawalBlocked: u.withdrawalBlocked,
      createdAt: u.createdAt,
      totalDeposited: depTotal?.total ?? "0",
      totalWithdrawn: wdTotal?.total ?? "0",
    };
  }));

  res.json(result);
});

router.patch("/admin/users/:userId/block", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { blocked } = req.body;

  const [user] = await db.update(usersTable)
    .set({ withdrawalBlocked: Boolean(blocked) })
    .where(eq(usersTable.id, raw))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

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
    totalDeposited: "0",
    totalWithdrawn: "0",
  });
});

router.get("/admin/deposits", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status as string | undefined;

  let query = db.select().from(depositsTable).orderBy(desc(depositsTable.createdAt)).limit(limit).offset(offset);
  if (status) {
    const deposits = await db.select().from(depositsTable).where(eq(depositsTable.status, status)).orderBy(desc(depositsTable.createdAt)).limit(limit).offset(offset);
    res.json(deposits);
    return;
  }
  const deposits = await query;
  res.json(deposits);
});

router.get("/admin/withdrawals", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status as string | undefined;

  let withdrawals;
  if (status) {
    withdrawals = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.status, status)).orderBy(desc(withdrawalsTable.createdAt)).limit(limit).offset(offset);
  } else {
    withdrawals = await db.select().from(withdrawalsTable).orderBy(desc(withdrawalsTable.createdAt)).limit(limit).offset(offset);
  }

  res.json(withdrawals);
});

router.post("/admin/withdrawals/:id/approve", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, raw));
  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "Withdrawal is not pending" });
    return;
  }

  const settings = await getSettings();
  let txHash: string | null = null;

  if (settings.withdrawWalletPrivateKey && settings.bscRpcUrl) {
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
      txHash = await sweepUsdt(encryptedKey, withdrawal.destinationAddress, ethers.parseUnits(withdrawal.netAmount, 18), provider);
    } catch (err) {
      logger.error({ err, withdrawalId: raw }, "On-chain withdrawal failed");
    }
  }

  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "approved", txHash, processedAt: new Date() })
    .where(eq(withdrawalsTable.id, raw))
    .returning();

  res.json(updated);
});

router.post("/admin/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, raw));
  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "Withdrawal is not pending" });
    return;
  }

  // Refund balance
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, withdrawal.userId));
  if (user) {
    const currentBalance = parseFloat(user.walletBalance);
    const refundAmount = parseFloat(withdrawal.amount);
    await db.update(usersTable)
      .set({ walletBalance: String(currentBalance + refundAmount) })
      .where(eq(usersTable.id, user.id));
  }

  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "rejected", processedAt: new Date() })
    .where(eq(withdrawalsTable.id, raw))
    .returning();

  res.json(updated);
});

router.get("/admin/settings", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const settings = await getSettings();
  res.json({
    minDepositUsdt: settings.minDepositUsdt,
    depositFeeFlat: settings.depositFeeFlat,
    depositFeePercent: settings.depositFeePercent,
    withdrawFeeFlat: settings.withdrawFeeFlat,
    withdrawFeePercent: settings.withdrawFeePercent,
    withdrawFeeMode: settings.withdrawFeeMode,
    withdrawalMode: settings.withdrawalMode,
    withdrawalEnabled: settings.withdrawalEnabled,
    otpWithdrawalEnabled: settings.otpWithdrawalEnabled,
    adminMasterWallet: settings.adminMasterWallet,
    bscRpcUrl: settings.bscRpcUrl,
    gasWalletAddress: null,
    telegramBotToken: settings.telegramBotToken,
    telegramBotUsername: settings.telegramBotUsername,
  });
});

router.put("/admin/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await updateSettings(req.body);
  const settings = await getSettings();
  res.json({
    minDepositUsdt: settings.minDepositUsdt,
    depositFeeFlat: settings.depositFeeFlat,
    depositFeePercent: settings.depositFeePercent,
    withdrawFeeFlat: settings.withdrawFeeFlat,
    withdrawFeePercent: settings.withdrawFeePercent,
    withdrawFeeMode: settings.withdrawFeeMode,
    withdrawalMode: settings.withdrawalMode,
    withdrawalEnabled: settings.withdrawalEnabled,
    otpWithdrawalEnabled: settings.otpWithdrawalEnabled,
    adminMasterWallet: settings.adminMasterWallet,
    bscRpcUrl: settings.bscRpcUrl,
    gasWalletAddress: null,
    telegramBotToken: settings.telegramBotToken,
    telegramBotUsername: settings.telegramBotUsername,
  });
});

router.get("/admin/stats", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [depTotal] = await db.select({ total: sum(depositsTable.netAmount), cnt: count() }).from(depositsTable);
  const [wdTotal] = await db.select({ total: sum(withdrawalsTable.netAmount), cnt: count() }).from(withdrawalsTable);
  const [pendingWd] = await db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending"));
  const [p2pTotal] = await db.select({ total: sum(p2pTransfersTable.amount) }).from(p2pTransfersTable);

  const recentDeposits = await db.select().from(depositsTable).orderBy(desc(depositsTable.createdAt)).limit(5);
  const recentWithdrawals = await db.select().from(withdrawalsTable).orderBy(desc(withdrawalsTable.createdAt)).limit(5);

  res.json({
    totalUsers: Number(userCount?.count ?? 0),
    totalDeposited: depTotal?.total ?? "0",
    totalWithdrawn: wdTotal?.total ?? "0",
    pendingWithdrawals: pendingWd?.total ?? "0",
    totalP2P: p2pTotal?.total ?? "0",
    depositCount: Number(depTotal?.cnt ?? 0),
    withdrawalCount: Number(wdTotal?.cnt ?? 0),
    recentDeposits,
    recentWithdrawals,
  });
});

export default router;
