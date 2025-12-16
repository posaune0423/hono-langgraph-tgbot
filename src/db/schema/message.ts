import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./user";

export const messages = sqliteTable("messages", {
  messageId: text("message_id")
    .primaryKey()
    .notNull()
    .default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id")
    .notNull()
    .references(() => users.userId),
  content: text("content").notNull(),
  messageType: text("message_type").notNull(), // 'human' or 'ai'
  timestamp: integer("timestamp")
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
