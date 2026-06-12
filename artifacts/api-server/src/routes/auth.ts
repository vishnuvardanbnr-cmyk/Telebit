import { Router } from "express";
import crypto from "node:crypto";
import { db, usersTable, telegramMappingsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { getSettings } from "../lib/settings";
import { generateWallet, generateReferralCode } from "../lib/wallet";
import { setAuthCookie, clearAuthCookie } from "../lib/auth";
import { generateOtp, storeOtp, verifyOtp, hasRecentOtp } from "../lib/otp-store";
import { sendTelegramMessage, normalizePhone, setTelegramWebhook, fetchTelegramPhotoUrl } from "../lib/telegram-bot";

const router = Router();

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
      `Your Telebit verification code: *${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
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

  if (message.text === "/start") {
    await sendTelegramMessage(
      settings.telegramBotToken,
      chatId,
      "Welcome to Telebit! 👋\n\nTo enable phone-based login, please share your phone number by tapping the button below.",
    ).catch(() => {});

    const keyboard = JSON.stringify({
      keyboard: [[{ text: "📱 Share my phone number", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });

    const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Tap the button to share your phone number:",
        reply_markup: keyboard,
      }),
    }).catch(() => {});

    res.sendStatus(200);
    return;
  }

  if (message.contact) {
    const contact = message.contact;
    const phone = normalizePhone(contact.phone_number);

    const photoUrl = settings.telegramBotToken
      ? await fetchTelegramPhotoUrl(settings.telegramBotToken, chatId)
      : null;

    await db
      .insert(telegramMappingsTable)
      .values({
        phone,
        chatId: BigInt(chatId),
        firstName: from?.first_name ?? contact.first_name ?? null,
        lastName: from?.last_name ?? contact.last_name ?? null,
        username: from?.username ?? null,
        photoUrl,
      })
      .onConflictDoUpdate({
        target: telegramMappingsTable.phone,
        set: {
          chatId: BigInt(chatId),
          firstName: from?.first_name ?? contact.first_name ?? null,
          lastName: from?.last_name ?? contact.last_name ?? null,
          username: from?.username ?? null,
          photoUrl: photoUrl ?? undefined,
          updatedAt: new Date(),
        },
      });

    const removeKeyboard = JSON.stringify({ remove_keyboard: true });
    const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ Phone number registered! You can now sign in to Telebit using your phone number.",
        reply_markup: removeKeyboard,
      }),
    }).catch(() => {});

    res.sendStatus(200);
    return;
  }

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

// ─── Telegram Login Widget ─────────────────────────────────────────────────

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

  // Verify Telegram hash: secret_key = SHA256(bot_token), then HMAC-SHA256 of sorted k=v pairs
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

  // Reject stale auth (older than 24 hours)
  if (Date.now() / 1000 - Number(auth_date) > 86400) {
    res.status(401).json({ error: "Authentication expired — please try again" });
    return;
  }

  const telegramChatId = BigInt(id);
  const syntheticPhone = `tg_${id}`;
  const externalId = `tg_${id}`;
  const email = `${syntheticPhone}@telegram.user`;

  // Look up by synthetic phone (set on first widget login)
  let [mapping] = await db.select().from(telegramMappingsTable)
    .where(eq(telegramMappingsTable.phone, syntheticPhone));

  let user;
  if (mapping) {
    [user] = await db.select().from(usersTable)
      .where(or(eq(usersTable.clerkId, externalId), eq(usersTable.email, email)));
    // Refresh profile info
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
// Requires the SESSION_SECRET as a bearer token. Safe to leave in permanently
// because without the secret it does nothing.
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
