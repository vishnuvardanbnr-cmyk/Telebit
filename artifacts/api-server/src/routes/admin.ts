import { Router } from "express";
import { sendWithdrawalStatusEmail } from "../lib/mailer";
import { db, usersTable, depositsTable, withdrawalsTable, p2pTransfersTable, incomeLogTable, walletAddressChangesTable } from "@workspace/db";
import { eq, desc, sum, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getSettings, updateSettings } from "../lib/settings";
import { getProvider, sweepUsdt, sendBnbGas, getBnbBalance, generateWallet } from "../lib/wallet";
import { encrypt } from "../lib/crypto";
import { ethers } from "ethers";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helper: serialize user for admin responses ───────────────────────────────

function userToAdminResponse(user: typeof usersTable.$inferSelect, extra?: { totalDeposited?: string; totalWithdrawn?: string }) {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    fullName: user.fullName,
    walletBalance: user.walletBalance,
    earningsBalance: user.earningsBalance,
    depositAddress: user.depositAddress,
    referralCode: user.referralCode,
    isAdmin: user.isAdmin,
    // ── Blocking ────────────────────────────────────────────────────────────
    isBlocked: user.isBlocked ?? false,
    withdrawalBlocked: user.withdrawalBlocked,
    p2pBlocked: user.p2pBlocked ?? false,
    investmentBlocked: user.investmentBlocked ?? false,
    blockReason: user.blockReason ?? null,
    withdrawalBlockReason: user.withdrawalBlockReason ?? null,
    p2pBlockReason: user.p2pBlockReason ?? null,
    investmentBlockReason: user.investmentBlockReason ?? null,
    createdAt: user.createdAt,
    totalDeposited: extra?.totalDeposited ?? "0",
    totalWithdrawn: extra?.totalWithdrawn ?? "0",
  };
}

// ─── GET /admin/users ─────────────────────────────────────────────────────────

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
    return userToAdminResponse(u, { totalDeposited: depTotal?.total ?? "0", totalWithdrawn: wdTotal?.total ?? "0" });
  }));

  res.json(result);
});

// ─── PATCH /admin/users/:userId/block ────────────────────────────────────────

router.patch("/admin/users/:userId/block", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;
  const {
    blocked,
    isBlocked,
    p2pBlocked,
    investmentBlocked,
    blockReason,
    withdrawalBlockReason,
    p2pBlockReason,
    investmentBlockReason,
  } = req.body;

  const updates: Partial<typeof usersTable.$inferInsert> = {};

  // Legacy single-field support
  if (typeof blocked === "boolean") updates.withdrawalBlocked = blocked;

  // Granular block fields
  if (typeof isBlocked === "boolean") updates.isBlocked = isBlocked;
  if (typeof blocked === "boolean" && typeof isBlocked === "undefined") updates.withdrawalBlocked = blocked;
  if (typeof req.body.withdrawalBlocked === "boolean") updates.withdrawalBlocked = req.body.withdrawalBlocked;
  if (typeof p2pBlocked === "boolean") updates.p2pBlocked = p2pBlocked;
  if (typeof investmentBlocked === "boolean") updates.investmentBlocked = investmentBlocked;
  if (blockReason !== undefined) updates.blockReason = blockReason || null;
  if (withdrawalBlockReason !== undefined) updates.withdrawalBlockReason = withdrawalBlockReason || null;
  if (p2pBlockReason !== undefined) updates.p2pBlockReason = p2pBlockReason || null;
  if (investmentBlockReason !== undefined) updates.investmentBlockReason = investmentBlockReason || null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [user] = await db.update(usersTable)
    .set(updates as any)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(userToAdminResponse(user));
});

// ─── POST /admin/users/:userId/add-balance ────────────────────────────────────

router.post("/admin/users/:userId/add-balance", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;
  const { amount, note } = req.body as { amount?: string; note?: string };

  const parsed = parseFloat(amount ?? "");
  if (!amount || isNaN(parsed) || parsed <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const newBalance = (parseFloat(existing.walletBalance) + parsed).toFixed(8);
  const newDeposited = (parseFloat((existing as any).userDepositedAmount ?? "0") + parsed).toFixed(8);
  const [user] = await db.update(usersTable)
    .set({ walletBalance: newBalance, userDepositedAmount: newDeposited } as any)
    .where(eq(usersTable.id, userId))
    .returning();

  logger.info({ userId, amount: parsed, note, newBalance }, "Admin credited balance");

  const [depTotal] = await db.select({ total: sum(depositsTable.netAmount) }).from(depositsTable).where(eq(depositsTable.userId, user.id));
  const [wdTotal] = await db.select({ total: sum(withdrawalsTable.netAmount) }).from(withdrawalsTable).where(eq(withdrawalsTable.userId, user.id));

  res.json(userToAdminResponse(user, { totalDeposited: depTotal?.total ?? "0", totalWithdrawn: wdTotal?.total ?? "0" }));
});

// ─── GET /admin/deposits ──────────────────────────────────────────────────────

router.get("/admin/deposits", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status as string | undefined;

  if (status) {
    const deposits = await db.select().from(depositsTable).where(eq(depositsTable.status, status)).orderBy(desc(depositsTable.createdAt)).limit(limit).offset(offset);
    res.json(deposits);
    return;
  }
  const deposits = await db.select().from(depositsTable).orderBy(desc(depositsTable.createdAt)).limit(limit).offset(offset);
  res.json(deposits);
});

// ─── GET /admin/withdrawals ───────────────────────────────────────────────────

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

// ─── POST /admin/withdrawals/:id/approve ─────────────────────────────────────

router.post("/admin/withdrawals/:id/approve", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, raw));
  if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
  if (withdrawal.status !== "pending") { res.status(400).json({ error: "Withdrawal is not pending" }); return; }

  const settings = await getSettings();
  let txHash: string | null = null;

  if (settings.withdrawWalletPrivateKey && settings.bscRpcUrl) {
    try {
      const provider = getProvider(settings.bscRpcUrl);

      // Dev fee = stored fee minus the 15% royalty portion (fee = devFee + royalty)
      const royaltyPortion = parseFloat(withdrawal.amount) * 0.15;
      const devFeeAmount = Math.max(0, parseFloat(withdrawal.fee) - royaltyPortion);
      const hasDevFee = devFeeAmount > 0 && !!settings.devWallet;

      if (settings.gasWalletPrivateKey) {
        const withdrawWallet = new ethers.Wallet(settings.withdrawWalletPrivateKey, provider);
        const bnbBalance = await getBnbBalance(withdrawWallet.address, provider);
        // Need BNB for 1 transfer (user) + 1 if dev fee
        const neededBnb = ethers.parseEther(hasDevFee ? "0.002" : "0.001");
        if (bnbBalance < neededBnb) {
          await sendBnbGas(withdrawWallet.address, ethers.parseEther("0.003"), settings.gasWalletPrivateKey, provider);
        }
      }

      const encryptedKey = encrypt(settings.withdrawWalletPrivateKey);

      // 1. Send net amount to user
      txHash = await sweepUsdt(encryptedKey, withdrawal.destinationAddress, ethers.parseUnits(withdrawal.netAmount, 18), provider);

      // 2. Send dev fee on-chain immediately
      if (hasDevFee) {
        await sweepUsdt(encryptedKey, settings.devWallet, ethers.parseUnits(devFeeAmount.toFixed(8), 18), provider);
        logger.info({ devFeeAmount, devWallet: settings.devWallet, withdrawalId: raw }, "Withdrawal dev fee transferred on-chain (manual approval)");
      }
    } catch (err) {
      logger.error({ err, withdrawalId: raw }, "On-chain withdrawal failed");
    }
  }

  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "approved", txHash, processedAt: new Date() })
    .where(eq(withdrawalsTable.id, raw))
    .returning();

  db.select().from(usersTable).where(eq(usersTable.id, withdrawal.userId)).limit(1).then((rows: any[]) => {
    const u = rows[0];
    if (u) sendWithdrawalStatusEmail(u.email, u.fullName ?? u.email, "approved", withdrawal.amount).catch(() => {});
  }).catch(() => {});

  res.json(updated);
});

// ─── POST /admin/withdrawals/:id/reject ──────────────────────────────────────

router.post("/admin/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, raw));
  if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
  if (withdrawal.status !== "pending") { res.status(400).json({ error: "Withdrawal is not pending" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, withdrawal.userId));
  if (user) {
    const currentBalance = parseFloat(user.biddingProfitBalance);
    const refundAmount = parseFloat(withdrawal.amount);
    await db.update(usersTable)
      .set({ biddingProfitBalance: String(currentBalance + refundAmount) } as any)
      .where(eq(usersTable.id, user.id));
  }

  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "rejected", processedAt: new Date() })
    .where(eq(withdrawalsTable.id, raw))
    .returning();

  if (user) sendWithdrawalStatusEmail(user.email, user.fullName ?? user.email, "rejected", withdrawal.amount).catch(() => {});

  res.json(updated);
});

// ─── GET /admin/settings ──────────────────────────────────────────────────────

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
    smtpEnabled: settings.smtpEnabled,
    emailVerificationEnabled: settings.emailVerificationEnabled,
    loginOtpEnabled: settings.loginOtpEnabled,
    welcomeEmailEnabled: settings.welcomeEmailEnabled,
    orderConfirmEmailEnabled: settings.orderConfirmEmailEnabled,
    depositCreditEmailEnabled: settings.depositCreditEmailEnabled,
    withdrawalStatusEmailEnabled: settings.withdrawalStatusEmailEnabled,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpPass: settings.smtpPass,
    smtpFromEmail: settings.smtpFromEmail,
    smtpFromName: settings.smtpFromName,
  });
});

// ─── PUT /admin/settings ──────────────────────────────────────────────────────

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
    smtpEnabled: settings.smtpEnabled,
    emailVerificationEnabled: settings.emailVerificationEnabled,
    loginOtpEnabled: settings.loginOtpEnabled,
    welcomeEmailEnabled: settings.welcomeEmailEnabled,
    orderConfirmEmailEnabled: settings.orderConfirmEmailEnabled,
    depositCreditEmailEnabled: settings.depositCreditEmailEnabled,
    withdrawalStatusEmailEnabled: settings.withdrawalStatusEmailEnabled,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpPass: settings.smtpPass,
    smtpFromEmail: settings.smtpFromEmail,
    smtpFromName: settings.smtpFromName,
  });
});

// ─── GET /admin/stats ─────────────────────────────────────────────────────────

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

// ─── GET /admin/server-status ─────────────────────────────────────────────────

router.get("/admin/server-status", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const mem = process.memoryUsage();
  res.json({
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// ─── GET /admin/wallet-stats ──────────────────────────────────────────────────

router.get("/admin/wallet-stats", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select({ id: usersTable.id, depositAddress: usersTable.depositAddress }).from(usersTable);
  const changes = await db.select().from(walletAddressChangesTable).orderBy(desc(walletAddressChangesTable.createdAt)).limit(50);

  res.json({
    totalUsers: users.length,
    totalWithAddress: users.filter(u => u.depositAddress).length,
    recentChanges: changes,
  });
});

// ─── POST /admin/regenerate-addresses ────────────────────────────────────────
// Regenerates deposit wallets for ALL non-admin users and logs the old→new change.

router.post("/admin/regenerate-addresses", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const admin = (req as any).dbUser;
  const { confirm } = req.body as { confirm?: string };

  if (confirm !== "REGENERATE") {
    res.status(400).json({ error: 'Send { "confirm": "REGENERATE" } to proceed' });
    return;
  }

  const users = await db.select().from(usersTable);
  let regenerated = 0;

  for (const user of users) {
    const { address: newAddress, privateKeyEncrypted } = generateWallet();
    await db.update(usersTable)
      .set({ depositAddress: newAddress, depositPrivateKeyEncrypted: privateKeyEncrypted } as any)
      .where(eq(usersTable.id, user.id));

    await db.insert(walletAddressChangesTable).values({
      userId: user.id,
      oldAddress: user.depositAddress,
      newAddress,
      changedBy: admin.id,
      reason: "admin_regenerate",
    });

    regenerated++;
  }

  logger.info({ adminId: admin.id, regenerated }, "Admin regenerated deposit addresses");

  res.json({ regenerated, message: `Successfully regenerated ${regenerated} deposit addresses.` });
});

// ─── POST /admin/reset-for-live ───────────────────────────────────────────────
// Nuclear: clears all non-admin transactional data and resets admin credentials.

router.post("/admin/reset-for-live", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { confirm, newEmail, newPassword } = req.body as { confirm?: string; newEmail?: string; newPassword?: string };

  if (confirm !== "RESET FOR LIVE") {
    res.status(400).json({ error: 'Send { confirm: "RESET FOR LIVE", newEmail, newPassword } to proceed' });
    return;
  }
  if (!newEmail || !newEmail.includes("@")) {
    res.status(400).json({ error: "Valid newEmail is required" });
    return;
  }
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "newPassword must be at least 6 characters" });
    return;
  }

  const { sql } = await import("drizzle-orm");
  const { userPackagesTable, incomeLogTable: incomeLog, royaltyDistributionsTable } = await import("@workspace/db");
  const bcrypt = await import("bcryptjs");

  // Clear all transactional data
  await db.delete(withdrawalsTable);
  await db.delete(depositsTable);
  await db.delete(userPackagesTable);
  await db.delete(incomeLog);
  if (royaltyDistributionsTable) await db.delete(royaltyDistributionsTable).catch(() => {});
  await db.execute(sql`DELETE FROM income_log`);
  await db.execute(sql`DELETE FROM p2p_transfers`);
  await db.execute(sql`DELETE FROM wallet_address_changes`);
  await db.execute(sql`DELETE FROM otp_codes`);

  // Delete all non-admin users
  await db.delete(usersTable).where(eq(usersTable.isAdmin, false));

  // Reset admin credentials
  const passwordHash = await bcrypt.default.hash(newPassword, 12);
  await db.update(usersTable)
    .set({
      email: newEmail,
      passwordHash,
      walletBalance: "0",
      earningsBalance: "0",
      totalIncomeEarned: "0",
      biddingProfitBalance: "0",
    } as any)
    .where(eq(usersTable.isAdmin, true));

  logger.warn({ newEmail }, "Admin triggered RESET FOR LIVE — all non-admin data cleared");

  res.json({ success: true, message: "All non-admin data cleared and admin credentials updated." });
});

export default router;
