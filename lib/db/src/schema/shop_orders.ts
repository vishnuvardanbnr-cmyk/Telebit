import { pgTable, text, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const shopOrders = pgTable("shop_orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  status: text("status", {
    enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
  })
    .notNull()
    .default("pending"),
  totalUsdt: numeric("total_usdt", { precision: 18, scale: 6 }).notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
