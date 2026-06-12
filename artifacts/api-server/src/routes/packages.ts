import { Router } from "express";
import { db, usersTable, packagesTable, userPackagesTable, referralLevelsTable, incomeLogTable } from "@workspace/db";
import { eq, and, count, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateDailyAmounts(total: number, days: number = 15): number[] {
  if (total <= 0) return Array(days).fill(0);
  const weights = Array.from({ length: days }, () => Math.random() + 0.1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => parseFloat((w / weightSum * total).toFixed(8)));
  const fixedSum = amounts.slice(0, -1).reduce((a, b) => a + b, 0);
  amounts[amounts.length - 1] = parseFloat((total - fixedSum).toFixed(8));
  return amounts;
}

async function ensureReferralLevels() {
  const existing = await db.select().from(referralLevelsTable);
  if (existing.length === 0) {
    const defaults = Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      percent: "0",
      requiredDirects: 0,
    }));
    await db.insert(referralLevelsTable).values(defaults);
  }
}

async function ensureDefaultPackage() {
  const existing = await db.select().from(packagesTable);
  if (existing.length === 0) {
    await db.insert(packagesTable).values({
      name: "Standard Package",
      priceUsdt: "125",
      roiPercent: "1",
      roiDays: 200,
      isActive: true,
    });
  }
}

async function payReferralCommissions(purchaserId: string, userPackageId: string, principalUsdt: number) {
  await ensureReferralLevels();
  const levels = await db.select().from(referralLevelsTable).orderBy(asc(referralLevelsTable.level));

  let currentUserId = purchaserId;
  for (let lvl = 1; lvl <= 10; lvl++) {
    const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, currentUserId));
    if (!currentUser?.uplineId) break;

    const uplineId = currentUser.uplineId;
    const levelConfig = levels.find((l) => l.level === lvl);
    if (!levelConfig || parseFloat(levelConfig.percent) === 0) {
      currentUserId = uplineId;
      continue;
    }

    // Count direct activated referrals of upline (users with at least 1 active package)
    const directs = await db.select({ userId: usersTable.id }).from(usersTable).where(eq(usersTable.uplineId, uplineId));
    let activatedCount = 0;
    for (const d of directs) {
      const [pkg] = await db.select({ id: userPackagesTable.id }).from(userPackagesTable)
        .where(and(eq(userPackagesTable.userId, d.userId), eq(userPackagesTable.isActive, true)))
        .limit(1);
      if (pkg) activatedCount++;
    }

    if (activatedCount >= levelConfig.requiredDirects) {
      const commission = parseFloat((principalUsdt * parseFloat(levelConfig.percent) / 100).toFixed(8));
      if (commission > 0) {
        const [upline] = await db.select().from(usersTable).where(eq(usersTable.id, uplineId));
        if (upline) {
          await db.update(usersTable)
            .set({ biddingProfitBalance: String(parseFloat(upline.biddingProfitBalance) + commission) } as any)
            .where(eq(usersTable.id, uplineId));

          await db.insert(incomeLogTable).values({
            userId: uplineId,
            type: "referral",
            amount: String(commission),
            sourceId: userPackageId,
            fromUserId: purchaserId,
            note: `Level ${lvl} referral commission`,
          });

          logger.info({ uplineId, purchaserId, lvl, commission }, "Referral commission paid");
        }
      }
    }

    currentUserId = uplineId;
  }
}

// ─── Public: list packages ────────────────────────────────────────────────────

router.get("/packages", async (_req, res): Promise<void> => {
  await ensureDefaultPackage();
  const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.isActive, true));
  res.json(pkgs);
});

// ─── User: my packages ────────────────────────────────────────────────────────

router.get("/packages/my", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const myPkgs = await db.select().from(userPackagesTable)
    .where(eq(userPackagesTable.userId, user.id))
    .orderBy(asc(userPackagesTable.purchasedAt));
  res.json(myPkgs);
});

// ─── User: purchase package ───────────────────────────────────────────────────

router.post("/packages/purchase", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const { packageId } = req.body as { packageId?: string };

  if (!packageId) {
    res.status(400).json({ error: "packageId is required" });
    return;
  }

  const [pkg] = await db.select().from(packagesTable).where(and(eq(packagesTable.id, packageId), eq(packagesTable.isActive, true)));
  if (!pkg) {
    res.status(404).json({ error: "Package not found or inactive" });
    return;
  }

  const price = parseFloat(pkg.priceUsdt);
  const walletBalance = parseFloat(user.walletBalance);
  if (walletBalance < price) {
    res.status(400).json({ error: `Insufficient wallet balance. Required: ${price} USDT, available: ${walletBalance.toFixed(4)} USDT` });
    return;
  }

  // Deduct from wallet
  await db.update(usersTable)
    .set({ walletBalance: String(walletBalance - price) } as any)
    .where(eq(usersTable.id, user.id));

  // Create user package
  const [userPkg] = await db.insert(userPackagesTable).values({
    userId: user.id,
    packageId: pkg.id,
    totalRoiDays: pkg.roiDays,
    roiPercent: pkg.roiPercent,
    principalUsdt: pkg.priceUsdt,
    isActive: true,
  }).returning();

  // Pay referral commissions (fire-and-forget)
  payReferralCommissions(user.id, userPkg.id, price).catch((err) =>
    logger.error({ err, userId: user.id }, "Referral commission error")
  );

  logger.info({ userId: user.id, packageId, price }, "Package purchased");
  res.status(201).json(userPkg);
});

// ─── Admin: list/update packages ─────────────────────────────────────────────

router.get("/admin/packages", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  await ensureDefaultPackage();
  const pkgs = await db.select().from(packagesTable);
  res.json(pkgs);
});

router.post("/admin/packages", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, priceUsdt, roiPercent, roiDays, isActive } = req.body;
  const [pkg] = await db.insert(packagesTable).values({
    name: name ?? "Standard Package",
    priceUsdt: String(priceUsdt ?? "125"),
    roiPercent: String(roiPercent ?? "1"),
    roiDays: Number(roiDays ?? 200),
    isActive: isActive !== false,
  }).returning();
  res.status(201).json(pkg);
});

router.put("/admin/packages/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { name, priceUsdt, roiPercent, roiDays, isActive } = req.body;

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (priceUsdt !== undefined) updates.priceUsdt = String(priceUsdt);
  if (roiPercent !== undefined) updates.roiPercent = String(roiPercent);
  if (roiDays !== undefined) updates.roiDays = Number(roiDays);
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  const [pkg] = await db.update(packagesTable).set(updates as any).where(eq(packagesTable.id, id)).returning();
  if (!pkg) {
    res.status(404).json({ error: "Package not found" });
    return;
  }
  res.json(pkg);
});

// ─── Admin: referral levels ───────────────────────────────────────────────────

router.get("/admin/referral-levels", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  await ensureReferralLevels();
  const levels = await db.select().from(referralLevelsTable).orderBy(asc(referralLevelsTable.level));
  res.json(levels);
});

router.put("/admin/referral-levels", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { levels } = req.body as { levels: Array<{ level: number; percent: string; requiredDirects: number }> };
  if (!Array.isArray(levels)) {
    res.status(400).json({ error: "levels must be an array" });
    return;
  }

  for (const l of levels) {
    await db.update(referralLevelsTable)
      .set({ percent: String(l.percent), requiredDirects: Number(l.requiredDirects) } as any)
      .where(eq(referralLevelsTable.level, l.level));
  }

  const updated = await db.select().from(referralLevelsTable).orderBy(asc(referralLevelsTable.level));
  res.json(updated);
});

// ─── User: count active packages (for directs check) ─────────────────────────

router.get("/packages/active-count", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const [result] = await db.select({ cnt: count() }).from(userPackagesTable)
    .where(and(eq(userPackagesTable.userId, user.id), eq(userPackagesTable.isActive, true)));
  res.json({ count: Number(result?.cnt ?? 0) });
});

export { payReferralCommissions, generateDailyAmounts };
export default router;
