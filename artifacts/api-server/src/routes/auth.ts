import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or, count } from "drizzle-orm";
import { generateWallet, generateReferralCode } from "../lib/wallet";
import { setAuthCookie, clearAuthCookie } from "../lib/auth";
import { getSettings } from "../lib/settings";
import { generateOtp, storeOtp, verifyOtp, hasRecentOtp } from "../lib/otp-store";
import { sendOtpEmail, sendWelcomeEmail } from "../lib/mailer";

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

// ─── Send Email OTP (registration) ─────────────────────────────────────────

router.post("/auth/send-email-otp", async (req, res): Promise<void> => {
  const { email, purpose } = req.body as { email?: string; purpose?: string };

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (purpose !== "register" && purpose !== "login" && purpose !== "password_reset") {
    res.status(400).json({ error: "Invalid purpose" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const settings = await getSettings();

  if (purpose === "register") {
    if (!settings.emailVerificationEnabled) {
      res.status(400).json({ error: "Email verification is not enabled" });
      return;
    }
    // Don't allow sending OTP to already-registered email
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
  }

  // Use namespaced key for password_reset OTPs to avoid collisions
  const otpKey = purpose === "password_reset" ? `reset:${normalizedEmail}` : normalizedEmail;

  // Rate limit: don't allow resend if a code was sent recently
  if (hasRecentOtp(otpKey)) {
    res.status(429).json({ error: "A code was already sent. Please wait before requesting a new one." });
    return;
  }

  const code = generateOtp();
  storeOtp(otpKey, code);

  try {
    await sendOtpEmail(normalizedEmail, code, purpose as "register" | "login" | "password_reset");
  } catch (err: any) {
    res.status(503).json({ error: err?.message ?? "Failed to send email" });
    return;
  }

  res.json({ success: true });
});

// ─── Forgot Password ─────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const otpKey = `reset:${normalizedEmail}`;

  // Always return success to avoid email enumeration
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (!user) {
    res.json({ success: true });
    return;
  }

  if (hasRecentOtp(otpKey)) {
    res.status(429).json({ error: "A reset code was already sent. Please wait a moment before trying again." });
    return;
  }

  const code = generateOtp();
  storeOtp(otpKey, code);

  try {
    await sendOtpEmail(normalizedEmail, code, "password_reset");
  } catch (err: any) {
    res.status(503).json({ error: err?.message ?? "Failed to send reset email. Check SMTP settings." });
    return;
  }

  res.json({ success: true });
});

// ─── Reset Password ───────────────────────────────────────────────────────────

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { email, otpCode, newPassword } = req.body as {
    email?: string;
    otpCode?: string;
    newPassword?: string;
  };

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (!otpCode || typeof otpCode !== "string") {
    res.status(400).json({ error: "Reset code is required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otpKey = `reset:${normalizedEmail}`;

  const result = verifyOtp(otpKey, otpCode.trim());
  if (result === "expired") {
    res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    return;
  }
  if (result === "too_many_attempts") {
    res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });
    return;
  }
  if (result === "invalid") {
    res.status(400).json({ error: "Incorrect reset code. Please try again." });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

// ─── First-user check ───────────────────────────────────────────────────────

router.get("/auth/first-user", async (_req, res): Promise<void> => {
  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  res.json({ isFirstUser: Number(total) === 0 });
});

// ─── Email + Password Registration ─────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, fullName, referralCode, otpCode } = req.body as {
    email?: string;
    password?: string;
    fullName?: string;
    referralCode?: string;
    otpCode?: string;
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
  const settings = await getSettings();

  // Verify OTP if email verification is enabled
  if (settings.emailVerificationEnabled) {
    if (!otpCode) {
      res.status(400).json({ error: "Email verification code is required" });
      return;
    }
    const result = verifyOtp(normalizedEmail, otpCode.trim());
    if (result === "expired") {
      res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      return;
    }
    if (result === "too_many_attempts") {
      res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });
      return;
    }
    if (result === "invalid") {
      res.status(400).json({ error: "Incorrect verification code. Please try again." });
      return;
    }
  }

  // Check if this is the very first user (will become admin, no referral needed)
  const [{ total: userCount }] = await db.select({ total: count() }).from(usersTable);
  const isFirstUser = Number(userCount) === 0;

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
  if (!isFirstUser && referralCode && typeof referralCode === "string") {
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
      ...(isFirstUser ? { isAdmin: true } : {}),
      ...(uplineId ? { uplineId } : {}),
    })
    .returning();

  setAuthCookie(res, user.id);

  // Send welcome email (fire-and-forget)
  sendWelcomeEmail(user.email, user.fullName ?? user.email).catch(() => {});

  const { signToken: signTok } = await import("../lib/auth.js");
  res.status(201).json({
    token: signTok(user.id),
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
  const { email, password, otpCode } = req.body as {
    email?: string;
    password?: string;
    otpCode?: string;
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

  const settings = await getSettings();

  if (settings.loginOtpEnabled) {
    if (!otpCode) {
      // Send OTP and signal that OTP is required
      const code = generateOtp();
      storeOtp(normalizedEmail, code);
      try {
        await sendOtpEmail(normalizedEmail, code, "login");
      } catch (err: any) {
        res.status(503).json({ error: err?.message ?? "Failed to send verification email" });
        return;
      }
      res.json({ otpRequired: true });
      return;
    }

    // Verify OTP
    const result = verifyOtp(normalizedEmail, otpCode.trim());
    if (result === "expired") {
      res.status(400).json({ error: "Verification code has expired. Please sign in again." });
      return;
    }
    if (result === "too_many_attempts") {
      res.status(400).json({ error: "Too many incorrect attempts. Please sign in again." });
      return;
    }
    if (result === "invalid") {
      res.status(400).json({ error: "Incorrect verification code. Please try again." });
      return;
    }
  }

  setAuthCookie(res, user.id);
  const { signToken } = await import("../lib/auth.js");
  res.json({
    token: signToken(user.id),
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
  const { signToken: signDemoTok } = await import("../lib/auth.js");
  res.json({
    token: signDemoTok(user.id),
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
