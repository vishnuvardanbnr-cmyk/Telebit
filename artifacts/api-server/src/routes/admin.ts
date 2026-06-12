import { Router } from "express";
import { db, usersTable, depositsTable, withdrawalsTable, p2pTransfersTable, globalAmountsV2Table, nftsTable, nftPoolsTable } from "@workspace/db";
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
    totalDeposited: depTotal?.total ?? "0",
    totalWithdrawn: wdTotal?.total ?? "0",
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

// ─── NFT / Bidding Pool Management ────────────────────────────────────────────

router.get("/admin/nft/status", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const [global] = await db.select().from(globalAmountsV2Table).limit(1);
  const nfts = await db.select().from(nftsTable).orderBy(desc(nftsTable.createdAt));
  const pools = await db
    .select({
      id: nftPoolsTable.id,
      nftId: nftPoolsTable.nftId,
      nftTitle: nftsTable.title,
      level: nftPoolsTable.level,
      poolSize: nftPoolsTable.poolSize,
      poolLimit: nftPoolsTable.poolLimit,
      poolAmount: nftPoolsTable.poolAmount,
      dailyYield: nftPoolsTable.dailyYield,
      status: nftPoolsTable.status,
      createdAt: nftPoolsTable.createdAt,
    })
    .from(nftPoolsTable)
    .innerJoin(nftsTable, eq(nftPoolsTable.nftId, nftsTable.id))
    .orderBy(nftPoolsTable.level);
  res.json({ global: global ?? null, nfts, pools });
});

router.post("/admin/nft/seed", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const [existing] = await db.select().from(globalAmountsV2Table).limit(1);
  if (existing) {
    res.status(400).json({ error: "System already initialized" });
    return;
  }

  await db.insert(globalAmountsV2Table).values({
    buyPrice: "1.00000000",
    sellPrice: "0.90000000",
    liquidity: "0",
    expenses: "0",
    nftPool: "0",
    totalPurchase: "0",
    reserveFund: "0",
    userDistributionPercent: "0.88",
    reserveFundDistributionPercent: "0.12",
    canInvest: true,
  });

  const [nft] = await db.insert(nftsTable).values({
    title: "Telebit V2 Pool",
    image: "",
    price: "100",
    status: "active",
  }).returning();

  const poolDefs = [
    { level: 1, poolSize: "10000",  dailyYield: "1.0" },
    { level: 2, poolSize: "50000",  dailyYield: "1.5" },
    { level: 3, poolSize: "100000", dailyYield: "2.0" },
    { level: 4, poolSize: "500000", dailyYield: "3.0" },
  ];
  for (const def of poolDefs) {
    await db.insert(nftPoolsTable).values({
      nftId: nft.id,
      level: def.level,
      poolSize: def.poolSize,
      poolLimit: def.poolSize,
      poolAmount: "0",
      dailyYield: def.dailyYield,
      status: "active",
    });
  }

  res.json({ success: true, message: "System initialized with 4 pools (L1–L4)" });
});

router.patch("/admin/nft/global", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [global] = await db.select().from(globalAmountsV2Table).limit(1);
  if (!global) { res.status(404).json({ error: "System not initialized" }); return; }

  const updates: Record<string, any> = {};
  if (req.body.canInvest !== undefined) updates.canInvest = Boolean(req.body.canInvest);
  if (req.body.buyPrice) updates.buyPrice = String(req.body.buyPrice);
  if (req.body.sellPrice) updates.sellPrice = String(req.body.sellPrice);

  await db.update(globalAmountsV2Table).set(updates as any).where(eq(globalAmountsV2Table.id, global.id));
  const [updated] = await db.select().from(globalAmountsV2Table).limit(1);
  res.json(updated);
});

router.post("/admin/nft/pools", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { nftId, level, poolSize, dailyYield } = req.body as {
    nftId?: string; level?: number; poolSize?: string; dailyYield?: string;
  };
  if (!nftId || !level || !poolSize) {
    res.status(400).json({ error: "nftId, level, and poolSize are required" });
    return;
  }
  const [nft] = await db.select().from(nftsTable).where(eq(nftsTable.id, nftId));
  if (!nft) { res.status(404).json({ error: "NFT not found" }); return; }

  const [pool] = await db.insert(nftPoolsTable).values({
    nftId,
    level: Number(level),
    poolSize: String(poolSize),
    poolLimit: String(poolSize),
    poolAmount: "0",
    dailyYield: String(dailyYield ?? "0"),
    status: "active",
  }).returning();
  res.json(pool);
});

router.patch("/admin/nft/pools/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const poolId = req.params.id as string;
  const { status } = req.body as { status?: string };
  if (!status || !["active", "inactive", "completed"].includes(status)) {
    res.status(400).json({ error: "status must be active, inactive, or completed" });
    return;
  }
  const [pool] = await db.update(nftPoolsTable)
    .set({ status } as any)
    .where(eq(nftPoolsTable.id, poolId))
    .returning();
  if (!pool) { res.status(404).json({ error: "Pool not found" }); return; }
  res.json(pool);
});

export default router;
