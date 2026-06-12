import { pgTable, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";

export const ranksTable = pgTable("ranks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  targetUsdt: numeric("target_usdt", { precision: 24, scale: 4 }).notNull(),
  rewardUsdt: numeric("reward_usdt", { precision: 20, scale: 4 }).notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRankAchievementsTable = pgTable("user_rank_achievements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  rankId: text("rank_id").notNull(),
  achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull().defaultNow(),
  rewardPaid: numeric("reward_paid", { precision: 20, scale: 8 }).notNull().default("0"),
});

export type Rank = typeof ranksTable.$inferSelect;
export type UserRankAchievement = typeof userRankAchievementsTable.$inferSelect;
