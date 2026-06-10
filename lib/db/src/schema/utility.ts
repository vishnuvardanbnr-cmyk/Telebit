import { pgTable, serial, text, numeric, varchar, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const utilityTransactionsTable = pgTable("utility_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  serviceType: varchar("service_type", { length: 30 }).notNull(),
  operatorCode: varchar("operator_code", { length: 60 }),
  operatorName: varchar("operator_name", { length: 120 }),
  consumerNumber: varchar("consumer_number", { length: 100 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  apiRefId: varchar("api_ref_id", { length: 100 }),
  externalRefId: varchar("external_ref_id", { length: 100 }),
  description: text("description"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UtilityTransaction = typeof utilityTransactionsTable.$inferSelect;

export const rechargePlansTable = pgTable("recharge_plans", {
  id: serial("id").primaryKey(),
  operator: varchar("operator", { length: 50 }).notNull(),
  operatorCode: varchar("operator_code", { length: 20 }).notNull(),
  serviceType: varchar("service_type", { length: 20 }).notNull().default("mobile"),
  amount: integer("amount").notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  planName: varchar("plan_name", { length: 255 }),
  validity: varchar("validity", { length: 80 }),
  data: varchar("data", { length: 120 }),
  calls: varchar("calls", { length: 120 }),
  sms: varchar("sms", { length: 100 }),
  description: text("description"),
  extraBenefits: text("extra_benefits"),
  isPopular: boolean("is_popular").default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RechargePlan = typeof rechargePlansTable.$inferSelect;
