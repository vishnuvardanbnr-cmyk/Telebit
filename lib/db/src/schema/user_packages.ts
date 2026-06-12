import { pgTable, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const userPackagesTable = pgTable("user_packages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  packageId: text("package_id").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  daysCredited: integer("days_credited").notNull().default(0),
  totalRoiDays: integer("total_roi_days").notNull(),
  roiPercent: numeric("roi_percent", { precision: 10, scale: 4 }).notNull(),
  principalUsdt: numeric("principal_usdt", { precision: 20, scale: 8 }).notNull(),
  totalRoiCredited: numeric("total_roi_credited", { precision: 20, scale: 8 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  lastCreditedAt: timestamp("last_credited_at", { withTimezone: true }),
});

export type UserPackage = typeof userPackagesTable.$inferSelect;
