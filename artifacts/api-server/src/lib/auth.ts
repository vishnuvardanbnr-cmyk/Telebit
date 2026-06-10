import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateWallet, generateReferralCode } from "./wallet";
import type { Request, Response, NextFunction } from "express";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // JIT provision user
  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    const { address, privateKeyEncrypted } = generateWallet();
    const referralCode = generateReferralCode();
    const email = auth.sessionClaims?.email as string | undefined ?? `${clerkId}@clerk.local`;

    [user] = await db.insert(usersTable).values({
      clerkId,
      email,
      depositAddress: address,
      depositPrivateKeyEncrypted: privateKeyEncrypted,
      referralCode,
    }).returning();
  }

  (req as any).dbUser = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).dbUser;
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
