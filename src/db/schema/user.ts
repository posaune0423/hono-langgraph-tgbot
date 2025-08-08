import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { messages } from "./message";

/**
 * ユーザーテーブル - Telegramユーザーのプロフィール情報
 */
export const users = sqliteTable("users", {
  userId: integer("user_id").primaryKey().notNull(), // Telegram user ID
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username"),
  languageCode: text("language_code"), // User's language preference
  walletAddress: text("wallet_address"),

  // Timestamps (SQLite uses INTEGER for Unix timestamps)
  lastActiveAt: integer("last_active_at")
    .default(sql`(strftime('%s', 'now'))`)
    .notNull()
    .$onUpdateFn(() => Math.floor(Date.now() / 1000)),
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`).notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  messages: many(messages),
}));

/**
 * 型定義（Drizzle推奨の型推論を活用）
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * 部分的更新用の型定義
 */
export type UpdateUser = Partial<Omit<NewUser, "userId" | "createdAt">>;
