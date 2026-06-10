import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { shopProducts } from "./shop_products";

export const shopCartItems = pgTable("shop_cart_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => shopProducts.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  priceUsdt: numeric("price_usdt", { precision: 18, scale: 6 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
