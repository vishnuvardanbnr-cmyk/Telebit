import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const incomeLogTable = pgTable("income_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // 'roi' | 'referral' | 'royalty'
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  sourceId: text("source_id"), // userPackageId for roi/referral, withdrawalId for royalty
  fromUserId: text("from_user_id"), // for referral: purchaser; for royalty: withdrawer
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IncomeLog = typeof incomeLogTable.$inferSelect;
