import { pgTable, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId: text("clerk_id").unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  telegramUsername: text("telegram_username"),
  telegramPhotoUrl: text("telegram_photo_url"),
  telegramChatId: text("telegram_chat_id"),
  parentUserId: text("parent_user_id"),
  walletBalance: numeric("wallet_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  earningsBalance: numeric("earnings_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  depositAddress: text("deposit_address").notNull().unique(),
  depositPrivateKeyEncrypted: text("deposit_private_key_encrypted").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  uplineId: text("upline_id"),
  investedUsdt: numeric("invested_usdt", { precision: 20, scale: 8 }).notNull().default("0"),
  userDepositedAmount: numeric("user_deposited_amount", { precision: 20, scale: 8 }).notNull().default("0"),
  biddingProfitBalance: numeric("bidding_profit_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  biddingRewardEarned: numeric("bidding_reward_earned", { precision: 20, scale: 8 }).notNull().default("0"),
  totalIncomeEarned: numeric("total_income_earned", { precision: 20, scale: 8 }).notNull().default("0"),
  subscriptionActive: boolean("subscription_active").notNull().default(false),
  lastWithdrawalAt: timestamp("last_withdrawal_at", { withTimezone: true }),
  isAdmin: boolean("is_admin").notNull().default(false),
  passwordHash: text("password_hash"),
  // ── Blocking controls ───────────────────────────────────────────────────────
  isBlocked: boolean("is_blocked").notNull().default(false),
  withdrawalBlocked: boolean("withdrawal_blocked").notNull().default(false),
  p2pBlocked: boolean("p2p_blocked").notNull().default(false),
  investmentBlocked: boolean("investment_blocked").notNull().default(false),
  blockReason: text("block_reason"),
  withdrawalBlockReason: text("withdrawal_block_reason"),
  p2pBlockReason: text("p2p_block_reason"),
  investmentBlockReason: text("investment_block_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
