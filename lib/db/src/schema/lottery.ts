import { pgTable, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const lotteriesTable = pgTable("lotteries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  type: text("type", { enum: ["random", "custom"] }).notNull().default("random"),
  status: text("status", { enum: ["draft", "active", "completed", "cancelled"] })
    .notNull()
    .default("draft"),
  showOnDashboard: boolean("show_on_dashboard").notNull().default(false),
  ticketPrice: numeric("ticket_price", { precision: 18, scale: 8 }).notNull().default("0"),
  maxTickets: integer("max_tickets").notNull(),
  soldTickets: integer("sold_tickets").notNull().default(0),
  prizePool: numeric("prize_pool", { precision: 18, scale: 8 }).notNull().default("0"),
  numberOfWinners: integer("number_of_winners").notNull().default(1),
  drawDate: timestamp("draw_date", { withTimezone: true }),
  winnerId: text("winner_id").references(() => usersTable.id),
  winnerTicket: text("winner_ticket"),
  currency: text("currency").notNull().default("USDT"),
  adminId: text("admin_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lotteryTicketsTable = pgTable("lottery_tickets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  lotteryId: text("lottery_id")
    .notNull()
    .references(() => lotteriesTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  ticketNumber: text("ticket_number").notNull(),
  status: text("status", { enum: ["purchased", "winning", "losing"] })
    .notNull()
    .default("purchased"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Lottery = typeof lotteriesTable.$inferSelect;
export type LotteryTicket = typeof lotteryTicketsTable.$inferSelect;
