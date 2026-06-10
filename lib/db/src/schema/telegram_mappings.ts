import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core";

export const telegramMappingsTable = pgTable("telegram_mappings", {
  phone: text("phone").primaryKey(),
  chatId: bigint("chat_id", { mode: "bigint" }).notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TelegramMapping = typeof telegramMappingsTable.$inferSelect;
