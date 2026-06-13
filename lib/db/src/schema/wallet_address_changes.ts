import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const walletAddressChangesTable = pgTable("wallet_address_changes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  oldAddress: text("old_address").notNull(),
  newAddress: text("new_address").notNull(),
  changedBy: text("changed_by").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
