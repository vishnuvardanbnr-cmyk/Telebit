import { pgTable, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const royaltyDistributionsTable = pgTable("royalty_distributions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  withdrawalId: text("withdrawal_id").notNull(),
  uplineUserId: text("upline_user_id").notNull(),
  level: integer("level").notNull(),
  totalAmount: numeric("total_amount", { precision: 20, scale: 8 }).notNull(),
  paidDays: integer("paid_days").notNull().default(0),
  totalDays: integer("total_days").notNull().default(15),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const royaltyDailyPayoutsTable = pgTable("royalty_daily_payouts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  distributionId: text("distribution_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  isPaid: boolean("is_paid").notNull().default(false),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
});

export type RoyaltyDistribution = typeof royaltyDistributionsTable.$inferSelect;
export type RoyaltyDailyPayout = typeof royaltyDailyPayoutsTable.$inferSelect;
