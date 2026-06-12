import { Router } from "express";
import { db, ranksTable, userRankAchievementsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getUserRankProgress, ensureRanksSeeded, computeQualifyingVolume } from "../lib/ranks";

const router = Router();

// ─── Public: list all ranks ───────────────────────────────────────────────────

router.get("/ranks", async (_req, res): Promise<void> => {
  await ensureRanksSeeded();
  const ranks = await db.select().from(ranksTable).orderBy(ranksTable.position);
  res.json(ranks);
});

// ─── User: my rank progress ───────────────────────────────────────────────────

router.get("/ranks/my-progress", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).dbUser;
  const data = await getUserRankProgress(user.id);
  res.json(data);
});

// ─── Admin: all user rank stats ───────────────────────────────────────────────

router.get("/admin/ranks/achievements", requireAdmin, async (_req, res): Promise<void> => {
  await ensureRanksSeeded();
  const achievements = await db.select({
    id:         userRankAchievementsTable.id,
    userId:     userRankAchievementsTable.userId,
    rankId:     userRankAchievementsTable.rankId,
    achievedAt: userRankAchievementsTable.achievedAt,
    rewardPaid: userRankAchievementsTable.rewardPaid,
    rankName:   ranksTable.name,
    userEmail:  usersTable.email,
    userName:   usersTable.fullName,
  })
  .from(userRankAchievementsTable)
  .leftJoin(ranksTable, eq(userRankAchievementsTable.rankId, ranksTable.id))
  .leftJoin(usersTable, eq(userRankAchievementsTable.userId, usersTable.id))
  .orderBy(desc(userRankAchievementsTable.achievedAt));

  res.json(achievements);
});

// ─── Admin: manually trigger rank check for a user ───────────────────────────

router.post("/admin/ranks/check/:userId", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };
  const { checkAndAwardRanks } = await import("../lib/ranks");
  await checkAndAwardRanks(userId);
  const data = await getUserRankProgress(userId);
  res.json(data);
});

export default router;
