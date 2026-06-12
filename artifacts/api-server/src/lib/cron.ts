import { db, usersTable, userPackagesTable, incomeLogTable, royaltyDistributionsTable, royaltyDailyPayoutsTable } from "@workspace/db";
import { eq, and, lte, lt } from "drizzle-orm";
import { logger } from "./logger";
import { getSettings, updateSettings } from "./settings";

// ─── ROI daily credit ─────────────────────────────────────────────────────────

export async function runDailyRoiCredit() {
  logger.info("Running daily ROI credit job");
  const now = new Date();
  const yesterday = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 23h to allow drift

  const activePackages = await db.select().from(userPackagesTable)
    .where(and(eq(userPackagesTable.isActive, true), lt(userPackagesTable.daysCredited, userPackagesTable.totalRoiDays)));

  let credited = 0;
  for (const pkg of activePackages) {
    // Skip if credited today already
    if (pkg.lastCreditedAt && pkg.lastCreditedAt > yesterday) continue;

    if (pkg.daysCredited >= pkg.totalRoiDays) {
      // Expire the package
      await db.update(userPackagesTable)
        .set({ isActive: false } as any)
        .where(eq(userPackagesTable.id, pkg.id));
      continue;
    }

    const dailyRoi = parseFloat((parseFloat(pkg.principalUsdt) * parseFloat(pkg.roiPercent) / 100).toFixed(8));
    if (dailyRoi <= 0) continue;

    // Credit to user income balance
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, pkg.userId));
    if (!user) continue;

    await db.update(usersTable)
      .set({ biddingProfitBalance: String(parseFloat(user.biddingProfitBalance) + dailyRoi) } as any)
      .where(eq(usersTable.id, pkg.userId));

    // Update package
    const newDaysCredited = pkg.daysCredited + 1;
    await db.update(userPackagesTable)
      .set({
        daysCredited: newDaysCredited,
        totalRoiCredited: String(parseFloat(pkg.totalRoiCredited) + dailyRoi),
        lastCreditedAt: now,
        isActive: newDaysCredited < pkg.totalRoiDays,
      } as any)
      .where(eq(userPackagesTable.id, pkg.id));

    // Log income
    await db.insert(incomeLogTable).values({
      userId: pkg.userId,
      type: "roi",
      amount: String(dailyRoi),
      sourceId: pkg.id,
      note: `ROI Day ${newDaysCredited}/${pkg.totalRoiDays}`,
    });

    credited++;
  }

  logger.info({ credited }, "Daily ROI credit job complete");
}

// ─── Royalty daily payout ─────────────────────────────────────────────────────

export async function runRoyaltyDailyPayout() {
  logger.info("Running royalty daily payout job");
  const now = new Date();

  const pendingPayouts = await db.select().from(royaltyDailyPayoutsTable)
    .where(and(eq(royaltyDailyPayoutsTable.isPaid, false), lte(royaltyDailyPayoutsTable.scheduledFor, now)))
    .limit(500);

  let paid = 0;
  for (const payout of pendingPayouts) {
    const [dist] = await db.select().from(royaltyDistributionsTable)
      .where(eq(royaltyDistributionsTable.id, payout.distributionId));
    if (!dist || dist.isComplete) continue;

    const amount = parseFloat(payout.amount);
    if (amount <= 0) continue;

    const [upline] = await db.select().from(usersTable).where(eq(usersTable.id, dist.uplineUserId));
    if (!upline) continue;

    // Credit upline
    await db.update(usersTable)
      .set({ biddingProfitBalance: String(parseFloat(upline.biddingProfitBalance) + amount) } as any)
      .where(eq(usersTable.id, dist.uplineUserId));

    // Mark payout as paid
    await db.update(royaltyDailyPayoutsTable)
      .set({ isPaid: true, paidAt: now } as any)
      .where(eq(royaltyDailyPayoutsTable.id, payout.id));

    // Update distribution progress
    const newPaidDays = dist.paidDays + 1;
    await db.update(royaltyDistributionsTable)
      .set({
        paidDays: newPaidDays,
        isComplete: newPaidDays >= dist.totalDays,
      } as any)
      .where(eq(royaltyDistributionsTable.id, dist.id));

    // Log income
    await db.insert(incomeLogTable).values({
      userId: dist.uplineUserId,
      type: "royalty",
      amount: String(amount),
      sourceId: dist.withdrawalId,
      note: `Royalty day ${payout.dayNumber} of 15 (level ${dist.level})`,
    });

    paid++;
  }

  logger.info({ paid }, "Royalty daily payout complete");
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let roiLastRun = 0;
let royaltyLastRun = 0;

const ROI_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ROYALTY_INTERVAL_MS = 60 * 60 * 1000;   // 1 hour (to process pending payouts)

export function startCronJobs() {
  logger.info("Starting cron jobs");

  // Run royalty every hour
  setInterval(async () => {
    const now = Date.now();
    if (now - royaltyLastRun >= ROYALTY_INTERVAL_MS) {
      royaltyLastRun = now;
      runRoyaltyDailyPayout().catch((err) => logger.error({ err }, "Royalty cron error"));
    }
  }, 5 * 60 * 1000); // check every 5 minutes

  // Run ROI once per day
  setInterval(async () => {
    const now = Date.now();
    if (now - roiLastRun >= ROI_INTERVAL_MS) {
      roiLastRun = now;
      runDailyRoiCredit().catch((err) => logger.error({ err }, "ROI cron error"));
    }
  }, 5 * 60 * 1000); // check every 5 minutes

  // Run immediately on startup after a short delay
  setTimeout(() => {
    runRoyaltyDailyPayout().catch((err) => logger.error({ err }, "Royalty cron startup error"));
  }, 10_000);
}
