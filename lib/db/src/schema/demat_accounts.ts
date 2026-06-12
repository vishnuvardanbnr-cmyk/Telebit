import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const dematAccountsTable = pgTable("demat_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  holderName: text("holder_name").notNull(),
  dpId: text("dp_id").notNull(),
  clientId: text("client_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DematAccount = typeof dematAccountsTable.$inferSelect;
