import { pgTable, numeric, integer, timestamp } from "drizzle-orm/pg-core";

export const referralLevelsTable = pgTable("referral_levels", {
  level: integer("level").primaryKey(),
  percent: numeric("percent", { precision: 10, scale: 4 }).notNull().default("0"),
  requiredDirects: integer("required_directs").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ReferralLevel = typeof referralLevelsTable.$inferSelect;
