import { pgTable, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const packagesTable = pgTable("packages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().default("Standard Package"),
  priceUsdt: numeric("price_usdt", { precision: 20, scale: 8 }).notNull().default("125"),
  roiPercent: numeric("roi_percent", { precision: 10, scale: 4 }).notNull().default("1"),
  roiDays: integer("roi_days").notNull().default(200),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Package = typeof packagesTable.$inferSelect;
