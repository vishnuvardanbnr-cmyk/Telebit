import { pgTable, text, timestamp, numeric, integer, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const shopP2pSideEnum = pgEnum("shop_p2p_side", ["buy", "sell"]);
export const shopP2pAdStatusEnum = pgEnum("shop_p2p_ad_status", ["active", "paused", "completed", "cancelled"]);
export const shopP2pOrderStatusEnum = pgEnum("shop_p2p_order_status", [
  "pending",
  "paid",
  "released",
  "cancelled",
  "disputed",
  "resolved",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const shopP2pAdsTable = pgTable("shop_p2p_ads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  displayName: text("display_name").notNull().default(""),
  side: shopP2pSideEnum("side").notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  minAmount: numeric("min_amount", { precision: 20, scale: 8 }).notNull(),
  maxAmount: numeric("max_amount", { precision: 20, scale: 8 }).notNull(),
  availableAmount: numeric("available_amount", { precision: 20, scale: 8 }).notNull(),
  paymentMethods: text("payment_methods").array().notNull().default([]),
  paymentWindow: integer("payment_window").notNull().default(15),
  terms: text("terms"),
  status: shopP2pAdStatusEnum("status").notNull().default("active"),
  completedOrders: integer("completed_orders").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shop_p2p_ads_user_idx").on(t.userId),
  index("shop_p2p_ads_side_status_idx").on(t.side, t.status),
]);

export const shopP2pOrdersTable = pgTable("shop_p2p_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  adId: text("ad_id").notNull().references(() => shopP2pAdsTable.id),
  buyerUserId: text("buyer_user_id").notNull(),
  sellerUserId: text("seller_user_id").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentNote: text("payment_note"),
  status: shopP2pOrderStatusEnum("status").notNull().default("pending"),
  paymentDeadline: timestamp("payment_deadline", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  disputeReason: text("dispute_reason"),
  disputeDescription: text("dispute_description"),
  resolvedBy: text("resolved_by"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shop_p2p_orders_buyer_idx").on(t.buyerUserId),
  index("shop_p2p_orders_seller_idx").on(t.sellerUserId),
  index("shop_p2p_orders_ad_idx").on(t.adId),
  index("shop_p2p_orders_status_idx").on(t.status),
]);

export const shopP2pMessagesTable = pgTable("shop_p2p_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().references(() => shopP2pOrdersTable.id),
  senderUserId: text("sender_user_id").notNull(),
  senderName: text("sender_name").notNull().default(""),
  content: text("content").notNull().default(""),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shop_p2p_messages_order_idx").on(t.orderId, t.createdAt),
]);

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const insertShopP2pAdSchema = createInsertSchema(shopP2pAdsTable).omit({
  id: true, createdAt: true, updatedAt: true, completedOrders: true, status: true,
});

export const insertShopP2pOrderSchema = createInsertSchema(shopP2pOrdersTable).omit({
  id: true, createdAt: true, updatedAt: true, status: true,
  paidAt: true, releasedAt: true, cancelledAt: true,
});

export const insertShopP2pMessageSchema = createInsertSchema(shopP2pMessagesTable).omit({
  id: true, createdAt: true,
});

export const createP2pAdRequestSchema = z.object({
  side: z.enum(["buy", "sell"]),
  price: z.string().regex(/^\d+(\.\d+)?$/, "Invalid price"),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid min amount"),
  maxAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid max amount"),
  availableAmount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid available amount"),
  paymentMethods: z.array(z.string()).min(1, "At least one payment method required"),
  paymentWindow: z.number().int().min(5).max(120).default(15),
  terms: z.string().max(500).optional(),
});

export const createP2pOrderRequestSchema = z.object({
  adId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  paymentMethod: z.string().min(1, "Payment method required"),
  paymentNote: z.string().max(500).optional(),
});

export type ShopP2pAd = typeof shopP2pAdsTable.$inferSelect;
export type ShopP2pOrder = typeof shopP2pOrdersTable.$inferSelect;
export type ShopP2pMessage = typeof shopP2pMessagesTable.$inferSelect;
