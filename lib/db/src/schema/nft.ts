import { pgTable, text, numeric, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const globalAmountsV2Table = pgTable("global_amounts_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  buyPrice: numeric("buy_price", { precision: 20, scale: 8 }).notNull().default("1"),
  sellPrice: numeric("sell_price", { precision: 20, scale: 8 }).notNull().default("0.9"),
  liquidity: numeric("liquidity", { precision: 20, scale: 8 }).notNull().default("0"),
  expenses: numeric("expenses", { precision: 20, scale: 8 }).notNull().default("0"),
  nftPool: numeric("nft_pool", { precision: 20, scale: 8 }).notNull().default("0"),
  totalPurchase: numeric("total_purchase", { precision: 20, scale: 8 }).notNull().default("0"),
  reserveFund: numeric("reserve_fund", { precision: 20, scale: 8 }).notNull().default("0"),
  userDistributionPercent: numeric("user_distribution_percent", { precision: 10, scale: 6 }).notNull().default("0.88"),
  reserveFundDistributionPercent: numeric("reserve_fund_distribution_percent", { precision: 10, scale: 6 }).notNull().default("0.12"),
  canInvest: boolean("can_invest").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const nftsTable = pgTable("nfts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  image: text("image").notNull().default(""),
  price: numeric("price", { precision: 20, scale: 8 }).notNull().default("100"),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const nftPoolsTable = pgTable("nft_pools", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nftId: text("nft_id").notNull().references(() => nftsTable.id),
  level: integer("level").notNull().default(1),
  poolSize: numeric("pool_size", { precision: 20, scale: 8 }).notNull(),
  poolLimit: numeric("pool_limit", { precision: 20, scale: 8 }).notNull(),
  poolAmount: numeric("pool_amount", { precision: 20, scale: 8 }).notNull().default("0"),
  dailyYield: numeric("daily_yield", { precision: 10, scale: 4 }).notNull().default("0"),
  status: text("status", { enum: ["active", "inactive", "completed"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const nftPoolContributedUsersTable = pgTable("nft_pool_contributed_users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  poolId: text("pool_id").notNull().references(() => nftPoolsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nftHoldingsTable = pgTable("nft_holdings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  poolRewardAvailable: numeric("pool_reward_available", { precision: 20, scale: 8 }).notNull().default("0"),
  poolRewardClaimed: numeric("pool_reward_claimed", { precision: 20, scale: 8 }).notNull().default("0"),
  poolRewardClaimedUsdt: numeric("pool_reward_claimed_usdt", { precision: 20, scale: 8 }).notNull().default("0"),
  referralRewardAvailable: numeric("referral_reward_available", { precision: 20, scale: 8 }).notNull().default("0"),
  referralRewardClaimed: numeric("referral_reward_claimed", { precision: 20, scale: 8 }).notNull().default("0"),
  referralRewardClaimedUsdt: numeric("referral_reward_claimed_usdt", { precision: 20, scale: 8 }).notNull().default("0"),
  levelRewardAvailable: numeric("level_reward_available", { precision: 20, scale: 8 }).notNull().default("0"),
  levelRewardClaimed: numeric("level_reward_claimed", { precision: 20, scale: 8 }).notNull().default("0"),
  levelRewardClaimedUsdt: numeric("level_reward_claimed_usdt", { precision: 20, scale: 8 }).notNull().default("0"),
  lifetimePurchased: numeric("lifetime_purchased", { precision: 20, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const nftIncomeQueuesTable = pgTable("nft_income_queues", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  poolId: text("pool_id").notNull().unique().references(() => nftPoolsTable.id),
  status: text("status", { enum: ["pending", "processing", "completed", "error"] }).notNull().default("pending"),
  distributionAmount: numeric("distribution_amount", { precision: 20, scale: 8 }).notNull().default("0"),
  distributedAmount: numeric("distributed_amount", { precision: 20, scale: 8 }).notNull().default("0"),
  tries: integer("tries").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const nftPurchaseTransactionsTable = pgTable("nft_purchase_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  tokensReceived: numeric("tokens_received", { precision: 20, scale: 8 }).notNull(),
  buyPrice: numeric("buy_price", { precision: 20, scale: 8 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GlobalAmountV2 = typeof globalAmountsV2Table.$inferSelect;
export type Nft = typeof nftsTable.$inferSelect;
export type NftPool = typeof nftPoolsTable.$inferSelect;
export type NftPoolContributedUser = typeof nftPoolContributedUsersTable.$inferSelect;
export type NftHolding = typeof nftHoldingsTable.$inferSelect;
export type NftIncomeQueue = typeof nftIncomeQueuesTable.$inferSelect;
export type NftPurchaseTransaction = typeof nftPurchaseTransactionsTable.$inferSelect;
