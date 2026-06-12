import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { generateWallet, generateReferralCode } from "../lib/wallet";
import { setAuthCookie, clearAuthCookie } from "../lib/auth";

const router = Router();

// ─── Check referral code validity ───────────────────────────────────────────

router.get("/auth/check-referral", async (req, res): Promise<void> => {
  const code = (req.query.code as string | undefined)?.trim().toUpperCase();
  if (!code) { res.status(400).json({ valid: false }); return; }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.referralCode, code))
    .limit(1);

  res.json({ valid: !!user });
});

// ─── Email + Password Registration ─────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, fullName, referralCode } = req.body as {
    email?: string;
    password?: string;
    fullName?: string;
    referralCode?: string;
  };

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let uplineId: string | undefined;
  if (referralCode && typeof referralCode === "string") {
    const ref = referralCode.trim().toUpperCase();
    const [upline] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, ref))
      .limit(1);
    if (upline) uplineId = upline.id;
  }

  const { address, privateKeyEncrypted } = generateWallet();
  const userReferralCode = generateReferralCode();

  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail,
      passwordHash,
      fullName: fullName?.trim() || normalizedEmail.split("@")[0],
      depositAddress: address,
      depositPrivateKeyEncrypted: privateKeyEncrypted,
      referralCode: userReferralCode,
      ...(uplineId ? { uplineId } : {}),
    })
    .returning();

  setAuthCookie(res, user.id);
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      walletBalance: user.walletBalance,
      earningsBalance: user.earningsBalance,
      depositAddress: user.depositAddress,
      referralCode: user.referralCode,
      isAdmin: user.isAdmin,
      withdrawalBlocked: user.withdrawalBlocked,
      createdAt: user.createdAt,
    },
  });
});

// ─── Email + Password Login ─────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  setAuthCookie(res, user.id);
  res.json({
    user: {
      id: user.id,
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
    },
  });
});

// ─── Demo Login ─────────────────────────────────────────────────────────────

router.post("/auth/demo", async (req, res): Promise<void> => {
  const externalId = "demo_user_telebit";
  const demoEmail = "demo@telebit.app";

  let [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.clerkId, externalId), eq(usersTable.email, demoEmail)))
    .limit(1);

  if (!user) {
    const { address, privateKeyEncrypted } = generateWallet();
    const referralCode = generateReferralCode();
    [user] = await db
      .insert(usersTable)
      .values({
        clerkId: externalId,
        email: demoEmail,
        fullName: "Demo User",
        depositAddress: address,
        depositPrivateKeyEncrypted: privateKeyEncrypted,
        referralCode,
        walletBalance: "0",
      })
      .returning();
  }

  setAuthCookie(res, user.id);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      walletBalance: user.walletBalance,
      earningsBalance: user.earningsBalance ?? "0.00",
      depositAddress: user.depositAddress,
      referralCode: user.referralCode,
      isAdmin: user.isAdmin,
      withdrawalBlocked: user.withdrawalBlocked,
      createdAt: user.createdAt,
    },
  });
});

// ─── Logout ─────────────────────────────────────────────────────────────────

router.post("/auth/logout", (req, res): void => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// ─── One-time admin bootstrap ────────────────────────────────────────────────

router.post("/auth/admin-setup", async (req, res): Promise<void> => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(503).json({ error: "No SESSION_SECRET configured" }); return; }

  const { token, email } = req.body as { token?: string; email?: string };
  if (!token || token !== secret) { res.status(403).json({ error: "Invalid token" }); return; }
  if (!email) { res.status(400).json({ error: "email is required" }); return; }

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: `${email} is now an admin` });
});

export default router;
