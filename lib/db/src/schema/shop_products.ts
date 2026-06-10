import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { shopCategories } from "./shop_categories";

export const shopProducts = pgTable("shop_products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  priceUsdt: numeric("price_usdt", { precision: 18, scale: 6 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 18, scale: 6 }),
  stock: integer("stock").notNull().default(0),
  categoryId: text("category_id")
    .notNull()
    .references(() => shopCategories.id),
  imageUrls: text("image_urls").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 })
    .notNull()
    .default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
