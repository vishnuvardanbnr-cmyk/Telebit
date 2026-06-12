import { Router } from "express";
import crypto from "node:crypto";
import { db, usersTable, telegramMappingsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { getSettings } from "../lib/settings";
import { generateWallet, generateReferralCode } from "../lib/wallet";
import { setAuthCookie, clearAuthCookie } from "../lib/auth";
import { generateOtp, storeOtp, verifyOtp, hasRecentOtp, generateAndStoreTgCode, verifyTgCode } from "../lib/otp-store";
import { sendTelegramMessage, normalizePhone, setTelegramWebhook, fetchTelegramPhotoUrl } from "../lib/telegram-bot";
import * as mtproto from "../lib/mtproto-sessions";

const router = Router();

// ─── Official Telegram MTProto phone auth ──────────────────────────────────

router.get("/auth/mtproto/config", (_req, res): void => {
  res.json({ configured: mtproto.isConfigured() });
});

router.post("/auth/mtproto/send-code", async (req, res): Promise<void> => {
  if (!mtproto.isConfigured()) {
    res.status(503).json({ error: "Telegram API credentials not configured" });
    return;
  }
  const { phone } = req.body as { phone?: string };
  if (!phone || typeof phone !== "string") {
    res.status(400).json({ error: "phone is required" });
    return;
  }
  try {
    await mtproto.sendCode(phone.trim());
    res.json({ success: true });
  } catch (err: any) {
    const msg: string = err?.error_message ?? err?.message ?? "Failed to send code";
    res.status(502).json({ error: msg });
  }
});

router.post("/auth/mtproto/sign-in", async (req, res): Promise<void> => {
  if (!mtproto.isConfigured()) {
    res.status(503).json({ error: "Telegram API credentials not configured" });
    return;
  }
  const { phone, code, referralCode } = req.body as {
    phone?: string; code?: string; referralCode?: string;
  };
  if (!phone || !code) {
    res.status(400).json({ error: "phone and code are required" });
    return;
  }

  let tgInfo: Awaited<ReturnType<typeof mtproto.signIn>>;
  try {
    tgInfo = await mtproto.signIn(phone.trim(), code.trim());
  } catch (err: any) {
    const msg: string = err?.error_message ?? err?.message ?? "Sign-in failed";
    const status = msg.includes("2FA") || msg.includes("SESSION_PASSWORD") ? 403
      : msg.includes("expired") || msg.includes("PHONE_CODE") ? 401
      : 502;
    res.status(status).json({ error: msg });
    return;
  }

  const externalId = `tg_${tgInfo.telegramId}`;
  const email = `tg_${tgInfo.telegramId}@telebit.internal`;
  const fullName = [tgInfo.firstName, tgInfo.lastName].filter(Boolean).join(" ")
    || tgInfo.username
    || `tg${tgInfo.telegramId}`;

  let [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.clerkId, externalId), eq(usersTable.email, email)))
    .limit(1);

  if (!user) {
    const { address, privateKeyEncrypted } = generateWallet();
    const userReferralCode = generateReferralCode();

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

    [user] = await db
      .insert(usersTable)
      .values({
        clerkId: externalId,
        email,
        fullName,
        telegramUsername: tgInfo.username ?? null,
        telegramPhotoUrl: tgInfo.photoDataUrl ?? null,
        telegramChatId: tgInfo.telegramId,
        depositAddress: address,
        depositPrivateKeyEncrypted: privateKeyEncrypted,
        referralCode: userReferralCode,
        ...(uplineId ? { uplineId } : {}),
      })
      .returning();
  } else {
    const updates: Record<string, any> = {};
    if (user.clerkId !== externalId) updates.clerkId = externalId;
    if (tgInfo.username && user.telegramUsername !== tgInfo.username) updates.telegramUsername = tgInfo.username;
    if (!user.telegramChatId) updates.telegramChatId = tgInfo.telegramId;
    // Always refresh the photo on each sign-in (in case they changed it)
    if (tgInfo.photoDataUrl) updates.telegramPhotoUrl = tgInfo.photoDataUrl;
    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates as any).where(eq(usersTable.id, user.id));
      user = { ...user, ...updates };
    }
  }

  setAuthCookie(res, user.id);
  res.json({
    user: {
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
    },
  });
});

// ─── Legacy bot OTP (phone via bot contact share) ──────────────────────────

router.post("/auth/otp/send", async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!phone || typeof phone !== "string") {
    res.status(400).json({ error: "Phone number is required" });
    return;
  }

  const normalized = normalizePhone(phone);
  if (normalized.length < 7 || normalized.length > 15) {
    res.status(400).json({ error: "Invalid phone number format" });
    return;
  }

  if (hasRecentOtp(normalized)) {
    res.status(429).json({ error: "Please wait before requesting another code" });
    return;
  }

  const settings = await getSettings();
  if (!settings.telegramBotToken) {
    res.status(503).json({ error: "Telegram bot is not configured" });
    return;
  }

  const [mapping] = await db
    .select()
    .from(telegramMappingsTable)
    .where(eq(telegramMappingsTable.phone, normalized))
    .limit(1);

  if (!mapping) {
    res.status(404).json({
      error: "Phone number not found",
      hint: "Please start the bot first",
      botUsername: settings.telegramBotUsername,
    });
    return;
  }

  const code = generateOtp();
  storeOtp(normalized, code);

  try {
    await sendTelegramMessage(
      settings.telegramBotToken,
      mapping.chatId,
      `Your Telebit verification code: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(502).json({ error: "Failed to send OTP via Telegram" });
  }
});

router.post("/auth/otp/verify", async (req, res): Promise<void> => {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) {
    res.status(400).json({ error: "Phone and code are required" });
    return;
  }

  const normalized = normalizePhone(phone);
  const result = verifyOtp(normalized, code.trim());

  if (result === "expired") {
    res.status(401).json({ error: "Code expired. Please request a new one." });
    return;
  }
  if (result === "too_many_attempts") {
    res.status(429).json({ error: "Too many attempts. Please request a new code." });
    return;
  }
  if (result === "invalid") {
    res.status(401).json({ error: "Invalid code. Please try again." });
    return;
  }

  const [mapping] = await db
    .select()
    .from(telegramMappingsTable)
    .where(eq(telegramMappingsTable.phone, normalized))
    .limit(1);

  if (!mapping) {
    res.status(404).json({ error: "Phone number not found" });
    return;
  }

  const telegramId = String(mapping.chatId);
  const externalId = `tg_${telegramId}`;
  const telegramEmail = `tg_${telegramId}@telebit.internal`;

  let [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.clerkId, externalId), eq(usersTable.email, telegramEmail)))
    .limit(1);

  const settings = await getSettings();
  const photoUrl = settings.telegramBotToken
    ? await fetchTelegramPhotoUrl(settings.telegramBotToken, mapping.chatId)
    : mapping.photoUrl ?? null;

  const telegramUsername = mapping.username ?? null;
  const fullName = [mapping.firstName, mapping.lastName].filter(Boolean).join(" ") || telegramUsername || `tg${telegramId}`;

  if (!user) {
    const { address, privateKeyEncrypted } = generateWallet();
    const referralCode = generateReferralCode();
    [user] = await db
      .insert(usersTable)
      .values({
        clerkId: externalId,
        email: telegramEmail,
        fullName,
        telegramUsername,
        telegramPhotoUrl: photoUrl,
        telegramChatId: telegramId,
        depositAddress: address,
        depositPrivateKeyEncrypted: privateKeyEncrypted,
        referralCode,
      })
      .returning();
  } else {
    const updates: Record<string, any> = {};
    if (user.clerkId !== externalId) updates.clerkId = externalId;
    if (telegramUsername && user.telegramUsername !== telegramUsername) updates.telegramUsername = telegramUsername;
    if (photoUrl && user.telegramPhotoUrl !== photoUrl) updates.telegramPhotoUrl = photoUrl;
    if (!user.telegramChatId) updates.telegramChatId = telegramId;
    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates as any).where(eq(usersTable.id, user.id));
      user = { ...user, ...updates };
    }
  }

  setAuthCookie(res, user.id);
  res.json({
    user: {
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
    },
  });
});

// ─── Bot OTP code flow ──────────────────────────────────────────────────────

router.post("/auth/tg-code/verify", async (req, res): Promise<void> => {
  const { code, referralCode } = req.body as { code?: string; referralCode?: string };
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Code is required" });
    return;
  }

  const result = verifyTgCode(code.trim());
  if (!result.ok) {
    const msg = result.reason === "expired"
      ? "Code expired. Open the bot and send any message to get a new one."
      : "Invalid code. Please try again.";
    res.status(401).json({ error: msg });
    return;
  }

  const { chatId } = result;
  const syntheticPhone = `tg_${chatId}`;
  const externalId = `tg_${chatId}`;
  const telegramEmail = `tg_${chatId}@telebit.internal`;

  const [mapping] = await db
    .select()
    .from(telegramMappingsTable)
    .where(eq(telegramMappingsTable.phone, syntheticPhone))
    .limit(1);

  const settings = await getSettings();
  const photoUrl = settings.telegramBotToken
    ? await fetchTelegramPhotoUrl(settings.telegramBotToken, BigInt(chatId)).catch(() => null)
    : mapping?.photoUrl ?? null;

  const telegramUsername = mapping?.username ?? null;
  const fullName =
    [mapping?.firstName, mapping?.lastName].filter(Boolean).join(" ") ||
    telegramUsername ||
    `tg${chatId}`;

  let [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.clerkId, externalId), eq(usersTable.email, telegramEmail)))
    .limit(1);

  if (!user) {
    const { address, privateKeyEncrypted } = generateWallet();
    const userReferralCode = generateReferralCode();

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

    [user] = await db
      .insert(usersTable)
      .values({
        clerkId: externalId,
        email: telegramEmail,
        fullName,
        telegramUsername,
        telegramPhotoUrl: photoUrl,
        telegramChatId: chatId,
        depositAddress: address,
        depositPrivateKeyEncrypted: privateKeyEncrypted,
        referralCode: userReferralCode,
        ...(uplineId ? { uplineId } : {}),
      })
      .returning();
  } else {
    const updates: Record<string, any> = {};
    if (user.clerkId !== externalId) updates.clerkId = externalId;
    if (telegramUsername && user.telegramUsername !== telegramUsername) updates.telegramUsername = telegramUsername;
    if (photoUrl && user.telegramPhotoUrl !== photoUrl) updates.telegramPhotoUrl = photoUrl;
    if (!user.telegramChatId) updates.telegramChatId = chatId;
    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates as any).where(eq(usersTable.id, user.id));
      user = { ...user, ...updates };
    }
  }

  setAuthCookie(res, user.id);
  res.json({
    user: {
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
    },
  });
});

// ─── Bot Webhook ────────────────────────────────────────────────────────────

router.post("/auth/bot-webhook", async (req, res): Promise<void> => {
  const settings = await getSettings();
  if (!settings.telegramBotToken) {
    res.sendStatus(200);
    return;
  }

  const update = req.body as TelegramUpdate;
  const message = update.message;

  if (!message) {
    res.sendStatus(200);
    return;
  }

  const chatId = message.chat.id;
  const from = message.from;

  // Upsert profile info into telegramMappings so verify can retrieve it
  if (from) {
    const syntheticPhone = `tg_${chatId}`;
    await db
      .insert(telegramMappingsTable)
      .values({
        phone: syntheticPhone,
        chatId: BigInt(chatId),
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        username: from.username ?? null,
        photoUrl: null,
      })
      .onConflictDoUpdate({
        target: telegramMappingsTable.phone,
        set: {
          firstName: from.first_name ?? null,
          lastName: from.last_name ?? null,
          username: from.username ?? null,
          updatedAt: new Date(),
        },
      })
      .catch(() => {});
  }

  // Generate a fresh login code for any message (including /start)
  const code = generateAndStoreTgCode(String(chatId));

  const isStart = message.text === "/start";
  const text = isStart
    ? `Welcome to Telebit! 👋\n\nYour login code is:\n\n🔑 ${code}\n\nEnter this on the sign-in page. Valid for 5 minutes — do not share it.`
    : `Your Telebit login code:\n\n🔑 ${code}\n\nEnter this on the sign-in page. Valid for 5 minutes — do not share it.`;

  await sendTelegramMessage(settings.telegramBotToken, chatId, text).catch(() => {});

  res.sendStatus(200);
});

router.post("/auth/bot-webhook/setup", async (req, res): Promise<void> => {
  const settings = await getSettings();
  if (!settings.telegramBotToken) {
    res.status(503).json({ error: "Bot token not configured" });
    return;
  }

  const { webhookUrl } = req.body as { webhookUrl?: string };
  if (!webhookUrl) {
    res.status(400).json({ error: "webhookUrl is required" });
    return;
  }

  try {
    const result = await setTelegramWebhook(settings.telegramBotToken, webhookUrl);
    res.json({ success: true, description: result.description });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? "Unknown error from Telegram" });
  }
});

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
  } else {
    const updates: Record<string, string> = { walletBalance: "0" };
    if (user.clerkId !== externalId) updates.clerkId = externalId;
    await db.update(usersTable).set(updates as any).where(eq(usersTable.id, user.id));
    user = { ...user, ...updates };
  }

  setAuthCookie(res, user.id);
  res.json({
    user: {
      id: user.id,
      clerkId: user.clerkId,
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

router.post("/auth/logout", (req, res): void => {
  clearAuthCookie(res);
  res.json({ success: true });
});

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: { id: number };
    text?: string;
    contact?: {
      phone_number: string;
      first_name?: string;
      last_name?: string;
      user_id?: number;
    };
  };
}

// ─── Telegram Login Widget (kept for backward compat) ──────────────────────

router.get("/auth/bot-info", async (req, res): Promise<void> => {
  const settings = await getSettings();
  res.json({
    botUsername: settings.telegramBotUsername || null,
    configured: !!settings.telegramBotUsername,
  });
});

router.post("/auth/telegram/login", async (req, res): Promise<void> => {
  const settings = await getSettings();
  if (!settings.telegramBotToken) {
    res.status(503).json({ error: "Telegram bot not configured" });
    return;
  }

  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body as {
    id?: string; first_name?: string; last_name?: string;
    username?: string; photo_url?: string; auth_date?: string; hash?: string;
  };

  if (!id || !hash || !auth_date) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const secretKey = crypto.createHash("sha256").update(settings.telegramBotToken).digest();
  const pairs: Record<string, string> = { auth_date, id };
  if (first_name) pairs.first_name = first_name;
  if (last_name) pairs.last_name = last_name;
  if (username) pairs.username = username;
  if (photo_url) pairs.photo_url = photo_url;

  const dataCheckString = Object.entries(pairs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (hash !== expectedHash) {
    res.status(401).json({ error: "Invalid Telegram authentication" });
    return;
  }

  if (Date.now() / 1000 - Number(auth_date) > 86400) {
    res.status(401).json({ error: "Authentication expired — please try again" });
    return;
  }

  const telegramChatId = BigInt(id);
  const syntheticPhone = `tg_${id}`;
  const externalId = `tg_${id}`;
  const email = `${syntheticPhone}@telegram.user`;

  let [mapping] = await db.select().from(telegramMappingsTable)
    .where(eq(telegramMappingsTable.phone, syntheticPhone));

  let user;
  if (mapping) {
    [user] = await db.select().from(usersTable)
      .where(or(eq(usersTable.clerkId, externalId), eq(usersTable.email, email)));
    await db.update(telegramMappingsTable)
      .set({ firstName: first_name ?? null, lastName: last_name ?? null, username: username ?? null, photoUrl: photo_url ?? null })
      .where(eq(telegramMappingsTable.phone, syntheticPhone));
  }

  if (!user) {
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || username || `User ${id}`;
    const { address, privateKeyEncrypted } = generateWallet();
    const referralCode = generateReferralCode();
    [user] = await db.insert(usersTable).values({
      clerkId: externalId,
      email,
      fullName,
      depositAddress: address,
      depositPrivateKeyEncrypted: privateKeyEncrypted,
      referralCode,
      walletBalance: "0",
    }).returning();

    await db.insert(telegramMappingsTable).values({
      phone: syntheticPhone,
      chatId: telegramChatId,
      firstName: first_name ?? null,
      lastName: last_name ?? null,
      username: username ?? null,
      photoUrl: photo_url ?? null,
    }).onConflictDoNothing();
  }

  setAuthCookie(res, user.id);
  res.json({
    user: {
      id: user.id,
      clerkId: user.clerkId,
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

// ─── One-time admin bootstrap ──────────────────────────────────────────────
router.post("/auth/admin-setup", async (req, res): Promise<void> => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(503).json({ error: "No SESSION_SECRET configured" }); return; }

  const { token, email } = req.body as { token?: string; email?: string };
  if (!token || token !== secret) { res.status(403).json({ error: "Invalid token" }); return; }
  if (!email) { res.status(400).json({ error: "email is required" }); return; }

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin })
    .from(usersTable).where(eq(usersTable.email, email));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: `${email} is now an admin` });
});

export default router;
