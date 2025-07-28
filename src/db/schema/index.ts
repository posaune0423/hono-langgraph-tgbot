import { relations } from "drizzle-orm";

export * from "./message";
export * from "./user";

// Define relations between tables
export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.userId],
  }),
}));

// Import tables for relations
import { messages } from "./message";
import { users } from "./user";
