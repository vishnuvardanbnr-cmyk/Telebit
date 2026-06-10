import { pgTable, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId: text("clerk_id").unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  walletBalance: numeric("wallet_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  earningsBalance: numeric("earnings_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  depositAddress: text("deposit_address").notNull().unique(),
  depositPrivateKeyEncrypted: text("deposit_private_key_encrypted").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  withdrawalBlocked: boolean("withdrawal_blocked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
