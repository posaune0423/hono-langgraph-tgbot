import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./user";

export const chatMessages = pgTable("chat_messages", {
  messageId: text("message_id").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.userId),
  content: text("content").notNull(),
  messageType: text("message_type").notNull(), // 'human' or 'ai'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
