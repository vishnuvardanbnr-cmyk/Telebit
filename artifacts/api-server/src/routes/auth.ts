import { Router } from "express";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSettings } from "../lib/settings";
import { generateWallet, generateReferralCode } from "../lib/wallet";
import { clerkClient } from "@clerk/express";

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

  // Reject auth data older than 1 hour
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
  const telegramEmail = `tg_${telegramId}@cryptovault.internal`;

  // Find or create Clerk user by externalId = telegramId
  let clerkUserId: string;
  try {
    const { data: existingUsers } = await clerkClient.users.getUserList({
      externalId: [telegramId],
    });

    if (existingUsers.length > 0) {
      clerkUserId = existingUsers[0].id;
    } else {
      // Create new Clerk user
      const newUser = await clerkClient.users.createUser({
        externalId: telegramId,
        emailAddress: [telegramEmail],
        firstName: authData.first_name,
        lastName: authData.last_name ?? "",
        username: authData.username
          ? authData.username
          : `tg${telegramId}`,
        skipPasswordRequirement: true,
      });
      clerkUserId = newUser.id;
    }
  } catch (err: any) {
    req.log.error({ err }, "Failed to create/find Clerk user for Telegram auth");
    res.status(500).json({ error: "Authentication failed" });
    return;
  }

  // JIT-provision platform user record (same as requireAuth middleware)
  const [existingDbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkUserId))
    .limit(1);

  if (!existingDbUser) {
    const { address, privateKeyEncrypted } = generateWallet();
    const referralCode = generateReferralCode();
    await db.insert(usersTable).values({
      clerkId: clerkUserId,
      email: telegramEmail,
      depositAddress: address,
      depositPrivateKeyEncrypted: privateKeyEncrypted,
      referralCode,
    });
  }

  // Create a Clerk sign-in token so the client can complete sign-in
  try {
    const signInToken = await clerkClient.signInTokens.createSignInToken({
      userId: clerkUserId,
      expiresInSeconds: 300,
    });

    res.json({
      token: signInToken.token,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create Clerk sign-in token");
    res.status(500).json({ error: "Failed to create session" });
  }
});

export default router;
