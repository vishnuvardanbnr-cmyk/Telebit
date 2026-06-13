import { Router } from "express";
import { db, usersTable, depositsTable, withdrawalsTable } from "@workspace/db";
import { eq, sum, and, or, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { setAuthCookie } from "../lib/auth";
import { generateWallet, generateReferralCode } from "../lib/wallet";

const router = Router();

function serializeUser(user: any) {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    fullName: user.fullName,
    telegramUsername: user.telegramUsername ?? null,
    telegramPhotoUrl: user.telegramPhotoUrl ?? null,
    telegramChatId: user.telegramChatId ?? null,
    parentUserId: user.parentUserId ?? null,
    walletBalance: user.walletBalance,
    earningsBalance: user.earningsBalance,
    incomeBalance: user.incomeBalance ?? "0",
    investedUsdt: user.investedUsdt ?? "0",
    totalIncomeEarned: user.totalIncomeEarned ?? "0",
    subscriptionActive: user.subscriptionActive ?? false,
    depositAddress: user.depositAddress,
    referralCode: user.referralCode,
    isAdmin: user.isAdmin,
    withdrawalBlocked: user.withdrawalBlocked,
    uplineId: user.uplineId ?? null,
    createdAt: user.createdAt,
  };
}

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  res.set("Cache-Control", "no-store");
  res.json(serializeUser(user));
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
    pendingWithdrawals: pendingWithdrawals?.[0]?.total ?? "0",
    recentDeposits,
    recentWithdrawals,
    recentP2P: [],
  });
});

router.get("/users/accounts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;

  if (!user.telegramChatId) {
    res.json([{ ...serializeUser(user), isCurrentAccount: true }]);
    return;
  }

  const accounts = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.telegramChatId, user.telegramChatId),
        or(
          eq(usersTable.parentUserId, user.id),
          eq(usersTable.id, user.id),
          user.parentUserId ? eq(usersTable.id, user.parentUserId) : undefined,
          user.parentUserId ? eq(usersTable.parentUserId, user.parentUserId) : undefined,
        ) as any,
      )
    );

  res.json(
    accounts.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      telegramUsername: a.telegramUsername ?? null,
      telegramPhotoUrl: a.telegramPhotoUrl ?? null,
      telegramChatId: a.telegramChatId ?? "",
      walletBalance: a.walletBalance,
      isCurrentAccount: a.id === user.id,
    }))
  );
});

router.post("/users/accounts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { alias, initialFund } = req.body as { alias?: string; initialFund?: number };

  if (!alias || typeof alias !== "string" || alias.trim().length === 0) {
    res.status(400).json({ error: "alias is required" });
    return;
  }

  if (!user.telegramChatId) {
    res.status(400).json({ error: "Sub-accounts require a Telegram-linked account" });
    return;
  }

  const fund = typeof initialFund === "number" && initialFund > 0 ? initialFund : 0;
  const currentBalance = parseFloat(user.walletBalance ?? "0");
  if (fund > 0 && fund > currentBalance) {
    res.status(400).json({ error: "Insufficient balance for initial fund" });
    return;
  }

  const rootUserId = user.parentUserId ?? user.id;

  const { address, privateKeyEncrypted } = generateWallet();
  const referralCode = generateReferralCode();
  const subEmail = `sub_${crypto.randomUUID()}@telebit.internal`;

  const [subAccount] = await db.insert(usersTable).values({
    email: subEmail,
    fullName: alias.trim(),
    telegramUsername: user.telegramUsername,
    telegramPhotoUrl: user.telegramPhotoUrl,
    telegramChatId: user.telegramChatId,
    parentUserId: rootUserId,
    depositAddress: address,
    depositPrivateKeyEncrypted: privateKeyEncrypted,
    referralCode,
    walletBalance: fund > 0 ? String(fund) : "0",
  }).returning();

  if (fund > 0) {
    await db
      .update(usersTable)
      .set({ walletBalance: String(currentBalance - fund) } as any)
      .where(eq(usersTable.id, user.id));
  }

  res.status(201).json({
    id: subAccount.id,
    fullName: subAccount.fullName,
    telegramUsername: subAccount.telegramUsername ?? null,
    telegramPhotoUrl: subAccount.telegramPhotoUrl ?? null,
    telegramChatId: subAccount.telegramChatId ?? "",
    walletBalance: subAccount.walletBalance,
    isCurrentAccount: false,
  });
});

router.post("/users/accounts/switch/:accountId", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const accountId = req.params.accountId as string;

  if (!user.telegramChatId) {
    res.status(403).json({ error: "No Telegram identity" });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.id, accountId),
        eq(usersTable.telegramChatId, user.telegramChatId),
      )
    )
    .limit(1);

  if (!target) {
    res.status(403).json({ error: "Account not found or not owned by you" });
    return;
  }

  setAuthCookie(res, target.id);
  res.json(serializeUser(target));
});

router.get("/users/me/referrals", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;

  const referred = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      telegramUsername: usersTable.telegramUsername,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.uplineId, user.id))
    .orderBy(usersTable.createdAt);

  res.json({
    count: referred.length,
    users: referred.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      telegramUsername: u.telegramUsername ?? null,
      joinedAt: u.createdAt,
    })),
  });
});

router.get("/users/me/network", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;

  const rows = await db.execute(
    `WITH RECURSIVE network AS (
      SELECT
        id, full_name, telegram_username, telegram_photo_url,
        created_at, invested_usdt, 1 AS level
      FROM users
      WHERE upline_id = $1
      UNION ALL
      SELECT
        u.id, u.full_name, u.telegram_username, u.telegram_photo_url,
        u.created_at, u.invested_usdt, n.level + 1
      FROM users u
      INNER JOIN network n ON u.upline_id = n.id
      WHERE n.level < 10
    )
    SELECT * FROM network ORDER BY level, created_at` as any,
    [user.id]
  );

  type Row = {
    id: string;
    full_name: string | null;
    telegram_username: string | null;
    telegram_photo_url: string | null;
    created_at: string;
    invested_usdt: string;
    level: number;
  };

  const allRows = (rows as any).rows as Row[];

  // Group by level
  const byLevel: Record<number, Row[]> = {};
  for (const row of allRows) {
    const lvl = Number(row.level);
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(row);
  }

  const levels = Array.from({ length: 10 }, (_, i) => {
    const lvl = i + 1;
    const members = (byLevel[lvl] ?? []).map((u) => ({
      id: u.id,
      fullName: u.full_name,
      telegramUsername: u.telegram_username ?? null,
      telegramPhotoUrl: u.telegram_photo_url ?? null,
      joinedAt: u.created_at,
      investedUsdt: u.invested_usdt ?? "0",
    }));
    return { level: lvl, count: members.length, members };
  });

  res.json({
    totalCount: allRows.length,
    levels,
  });
});

export default router;
