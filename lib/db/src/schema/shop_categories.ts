import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const shopCategories = pgTable("shop_categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  productCount: integer("product_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
