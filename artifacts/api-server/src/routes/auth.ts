import { Router } from "express";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { getSettings } from "../lib/settings";
import { generateWallet, generateReferralCode } from "../lib/wallet";
import { setAuthCookie, clearAuthCookie } from "../lib/auth";

const router = Router();

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function verifyTelegramHash(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...rest } = data;
  const checkArr = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const checkString = checkArr.join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  return hmac === hash;
}

router.post("/auth/telegram", async (req, res): Promise<void> => {
  const settings = await getSettings();
  const botToken = settings.telegramBotToken;

  if (!botToken) {
    res.status(503).json({ error: "Telegram login is not configured" });
    return;
  }

  const authData = req.body as TelegramAuthData;

  if (!authData.id || !authData.hash || !authData.auth_date) {
    res.status(400).json({ error: "Invalid Telegram auth data" });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authData.auth_date > 3600) {
    res.status(401).json({ error: "Telegram auth data expired" });
    return;
  }

  if (!verifyTelegramHash(authData, botToken)) {
    res.status(401).json({ error: "Invalid Telegram signature" });
    return;
  }

  const telegramId = String(authData.id);
  const externalId = `tg_${telegramId}`;
  const telegramEmail = `tg_${telegramId}@cryptovault.internal`;

  let [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.clerkId, externalId), eq(usersTable.email, telegramEmail)))
    .limit(1);

  if (!user) {
    const { address, privateKeyEncrypted } = generateWallet();
    const referralCode = generateReferralCode();
    const username = authData.username ?? `tg${telegramId}`;
    [user] = await db
      .insert(usersTable)
      .values({
        clerkId: externalId,
        email: telegramEmail,
        fullName: [authData.first_name, authData.last_name].filter(Boolean).join(" ") || username,
        depositAddress: address,
        depositPrivateKeyEncrypted: privateKeyEncrypted,
        referralCode,
      })
      .returning();
  } else if (user.clerkId !== externalId) {
    await db.update(usersTable).set({ clerkId: externalId }).where(eq(usersTable.id, user.id));
  }

  setAuthCookie(res, user.id);
  res.json({ success: true });
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
        walletBalance: "100.00",
      })
      .returning();
  } else if (user.clerkId !== externalId) {
    await db.update(usersTable).set({ clerkId: externalId }).where(eq(usersTable.id, user.id));
    user = { ...user, clerkId: externalId };
  }

  setAuthCookie(res, user.id);
  res.json({ success: true });
});

router.post("/auth/logout", (req, res): void => {
  clearAuthCookie(res);
  res.json({ success: true });
});

export default router;
