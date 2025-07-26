import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * ユーザーテーブル - Telegramユーザーのプロフィール情報
 */
export const users = pgTable(
  "users",
  {
    userId: text("user_id").primaryKey().notNull(), // Telegram user ID
    firstName: text("first_name"),
    lastName: text("last_name"),
    username: text("username"),
    languageCode: text("language_code"), // User's language preference

    // Bot interaction state
    isActive: boolean("is_active").default(true),

    // Timestamps
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // インデックス定義（クエリパフォーマンス向上）
    index("users_username_idx").on(table.username),
    index("users_is_active_idx").on(table.isActive),
    index("users_created_at_idx").on(table.createdAt),
  ],
);

/**
 * 型定義（Drizzle推奨の型推論を活用）
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * 部分的更新用の型定義
 */
export type UpdateUser = Partial<Omit<NewUser, "userId" | "createdAt">>;
