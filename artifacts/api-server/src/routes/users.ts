import { Router } from "express";
import { db, usersTable, depositsTable, withdrawalsTable } from "@workspace/db";
import { eq, sum, and, or } from "drizzle-orm";
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
    depositAddress: user.depositAddress,
    referralCode: user.referralCode,
    isAdmin: user.isAdmin,
    withdrawalBlocked: user.withdrawalBlocked,
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

export default router;
