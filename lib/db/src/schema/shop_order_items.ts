import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { shopOrders } from "./shop_orders";
import { shopProducts } from "./shop_products";

export const shopOrderItems = pgTable("shop_order_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id")
    .notNull()
    .references(() => shopOrders.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => shopProducts.id),
  productName: text("product_name").notNull(),
  productImageUrl: text("product_image_url"),
  quantity: integer("quantity").notNull(),
  priceUsdt: numeric("price_usdt", { precision: 18, scale: 6 }).notNull(),
  subtotal: numeric("subtotal", { precision: 18, scale: 6 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
