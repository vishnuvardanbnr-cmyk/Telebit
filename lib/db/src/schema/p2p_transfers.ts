import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const p2pTransfersTable = pgTable("p2p_transfers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertP2PTransferSchema = createInsertSchema(p2pTransfersTable).omit({ id: true, createdAt: true });
export type InsertP2PTransfer = z.infer<typeof insertP2PTransferSchema>;
export type P2PTransfer = typeof p2pTransfersTable.$inferSelect;
