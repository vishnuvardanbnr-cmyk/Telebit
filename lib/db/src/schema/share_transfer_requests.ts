import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const shareTransferRequestsTable = pgTable("share_transfer_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  userPackageId: text("user_package_id"),
  dematAccountId: text("demat_account_id").notNull(),
  sharesCount: integer("shares_count").notNull().default(50),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  transferredAt: timestamp("transferred_at", { withTimezone: true }),
  adminNote: text("admin_note"),
});

export type ShareTransferRequest = typeof shareTransferRequestsTable.$inferSelect;
