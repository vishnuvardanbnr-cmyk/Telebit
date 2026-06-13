import { db, usersTable, userPackagesTable, ranksTable, userRankAchievementsTable, incomeLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";

// ─── Default ranks seeded once ────────────────────────────────────────────────

const DEFAULT_RANKS = [
  { name: "Bronze Leader",      targetUsdt: "1000",     rewardUsdt: "100",     position: 1 },
  { name: "Silver Leader",      targetUsdt: "5000",     rewardUsdt: "500",     position: 2 },
  { name: "Gold Leader",        targetUsdt: "25000",    rewardUsdt: "2000",    position: 3 },
  { name: "Platinum Leader",    targetUsdt: "50000",    rewardUsdt: "5000",    position: 4 },
  { name: "Diamond Director",   targetUsdt: "100000",   rewardUsdt: "10000",   position: 5 },
  { name: "Blue Diamond",       targetUsdt: "250000",   rewardUsdt: "25000",   position: 6 },
  { name: "Crown Diamond",      targetUsdt: "500000",   rewardUsdt: "50000",   position: 7 },
  { name: "Royal Ambassador",   targetUsdt: "1500000",  rewardUsdt: "200000",  position: 8 },
  { name: "Global Chairman",    targetUsdt: "5000000",  rewardUsdt: "500000",  position: 9 },
  { name: "Legacy Chairman",    targetUsdt: "20000000", rewardUsdt: "5000000", position: 10 },
];

export async function ensureRanksSeeded() {
  const existing = await db.select({ id: ranksTable.id }).from(ranksTable).limit(1);
  if (existing.length === 0) {
    await db.insert(ranksTable).values(DEFAULT_RANKS);
    logger.info("Ranks seeded");
  }
}

// ─── Subtree volume via recursive CTE ─────────────────────────────────────────

/**
 * Returns total principal invested by all users in the subtree rooted at rootUserId
 * (excluding rootUserId themselves — only their downline).
 */
async function subtreeVolume(rootUserId: string): Promise<number> {
  const result = await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM users WHERE upline_id = ${rootUserId}
      UNION ALL
      SELECT u.id FROM users u
      INNER JOIN subtree s ON u.upline_id = s.id
    )
    SELECT COALESCE(SUM(up.principal_usdt), 0)::numeric AS total
    FROM user_packages up
    WHERE up.user_id IN (SELECT id FROM subtree)
  `);
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  return parseFloat(row?.total ?? "0");
}

// ─── Compute qualifying volume for a user (40/30/30 rule) ─────────────────────

export interface LegBreakdown {
  totalLegs: number;
  p1: number;
  p2: number;
  others: number;
  qualifyingVolume: number;
}

export async function computeQualifyingVolume(userId: string, targetUsdt: number): Promise<LegBreakdown> {
  const directs = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.uplineId, userId));

  if (directs.length === 0) {
    return { totalLegs: 0, p1: 0, p2: 0, others: 0, qualifyingVolume: 0 };
  }

  const legVolumes: number[] = await Promise.all(
    directs.map((d) => subtreeVolume(d.id))
  );

  legVolumes.sort((a, b) => b - a);

  const p1 = legVolumes[0] ?? 0;
  const p2 = legVolumes[1] ?? 0;
  const others = legVolumes.slice(2).reduce((s, v) => s + v, 0);

  const p1Cap    = targetUsdt * 0.4;
  const p2Cap    = targetUsdt * 0.3;
  const otherCap = targetUsdt * 0.3;

  const qualifyingVolume =
    Math.min(p1, p1Cap) +
    Math.min(p2, p2Cap) +
    Math.min(others, otherCap);

  return { totalLegs: directs.length, p1, p2, others, qualifyingVolume };
}

// ─── Check ranks and award newly achieved ones ────────────────────────────────

export async function checkAndAwardRanks(userId: string): Promise<void> {
  await ensureRanksSeeded();

  const allRanks = await db.select().from(ranksTable)
    .orderBy(ranksTable.position);

  const alreadyAchieved = await db.select({ rankId: userRankAchievementsTable.rankId })
    .from(userRankAchievementsTable)
    .where(eq(userRankAchievementsTable.userId, userId));

  const achievedSet = new Set(alreadyAchieved.map((r) => r.rankId));

  for (const rank of allRanks) {
    if (achievedSet.has(rank.id)) continue;

    const target = parseFloat(rank.targetUsdt);
    const { qualifyingVolume } = await computeQualifyingVolume(userId, target);

    if (qualifyingVolume >= target) {
      const reward = parseFloat(rank.rewardUsdt);

      await db.insert(userRankAchievementsTable).values({
        userId,
        rankId: rank.id,
        rewardPaid: String(reward),
      });

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (user) {
        const newBalance = parseFloat(user.incomeBalance) + reward;
        const newTotal   = parseFloat(user.totalIncomeEarned) + reward;
        await db.update(usersTable)
          .set({
            incomeBalance: String(newBalance),
            totalIncomeEarned:    String(newTotal),
          } as any)
          .where(eq(usersTable.id, userId));

        await db.insert(incomeLogTable).values({
          userId,
          type:   "rank_reward",
          amount: String(reward),
          note:   `Rank achievement reward: ${rank.name}`,
        });

        logger.info({ userId, rank: rank.name, reward }, "Rank achieved and reward paid");
      }
    }
  }
}

// ─── Get user rank progress snapshot ─────────────────────────────────────────

export interface RankProgress {
  rank: typeof allRanks[0];
  achieved: boolean;
  achievedAt?: Date;
  qualifyingVolume: number;
  breakdown: LegBreakdown;
  progressPct: number;
}

// Expose all ranks type
type RankRow = { id: string; name: string; targetUsdt: string; rewardUsdt: string; position: number; createdAt: Date };
let allRanks: RankRow[] = [];

export async function getUserRankProgress(userId: string): Promise<{
  currentRank: RankRow | null;
  nextRank: RankRow | null;
  progress: Array<{
    rank: RankRow;
    achieved: boolean;
    achievedAt?: string;
    rewardPaid?: string;
    qualifyingVolume: number;
    breakdown: LegBreakdown;
    progressPct: number;
  }>;
}> {
  await ensureRanksSeeded();

  const ranks = await db.select().from(ranksTable).orderBy(ranksTable.position);
  allRanks = ranks as any;

  const achievements = await db.select()
    .from(userRankAchievementsTable)
    .where(eq(userRankAchievementsTable.userId, userId));

  const achievedMap = new Map(achievements.map((a) => [a.rankId, a]));

  const progress = await Promise.all(
    ranks.map(async (rank) => {
      const ach = achievedMap.get(rank.id);
      const target = parseFloat(rank.targetUsdt);
      const breakdown = await computeQualifyingVolume(userId, target);
      const progressPct = Math.min(100, (breakdown.qualifyingVolume / target) * 100);
      return {
        rank,
        achieved: !!ach,
        achievedAt: ach?.achievedAt?.toISOString(),
        rewardPaid: ach?.rewardPaid,
        qualifyingVolume: breakdown.qualifyingVolume,
        breakdown,
        progressPct,
      };
    })
  );

  const lastAchieved = progress.filter((p) => p.achieved).at(-1)?.rank ?? null;
  const nextRank = progress.find((p) => !p.achieved)?.rank ?? null;

  return { currentRank: lastAchieved, nextRank, progress };
}
