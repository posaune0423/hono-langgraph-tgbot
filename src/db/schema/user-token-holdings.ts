import { pgTable, text, timestamp, primaryKey, decimal, index, unique } from "drizzle-orm/pg-core";

// references()で実際の値が必要なため、通常のimportを使用
import { users } from "./user";
import { tokens } from "./tokens";

/**
 * ユーザーとトークンの保有関係を管理するテーブル
 * - APIリクエストを削減するためのキャッシュテーブル
 * - 各ユーザーが保有するトークンの情報を保存
 */
export const userTokenHoldings = pgTable(
  "user_token_holdings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    tokenAddress: text("token_address")
      .notNull()
      .references(() => tokens.address, { onDelete: "cascade" }),

    // 保有量（大きな数値を扱うためstring形式）
    amount: decimal("amount", { precision: 36, scale: 18 }).default("0"),

    // 最後に検証された時刻
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).defaultNow().notNull(),

    // レコード作成時刻
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    // レコード更新時刻（自動更新）
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    // 複合主キー
    primaryKey({ columns: [table.userId, table.tokenAddress] }),

    // インデックス定義（クエリパフォーマンス向上）
    index("user_token_holdings_user_id_idx").on(table.userId),
    index("user_token_holdings_token_address_idx").on(table.tokenAddress),
    index("user_token_holdings_last_verified_at_idx").on(table.lastVerifiedAt),

    // 複合インデックス（よく使われるクエリパターン用）
    index("user_token_holdings_user_verified_idx").on(table.userId, table.lastVerifiedAt),

    // ユニーク制約（複合主キーで既に保証されているが、明示的に定義）
    unique("user_token_holdings_user_token_unique").on(table.userId, table.tokenAddress),
  ],
);

/**
 * Relations定義は循環参照を避けるため、
 * relations.tsファイルで定義されています
 */

/**
 * 型定義（Drizzle推奨の型推論を活用）
 */
export type UserTokenHolding = typeof userTokenHoldings.$inferSelect;
export type NewUserTokenHolding = typeof userTokenHoldings.$inferInsert;

/**
 * 部分的更新用の型定義
 */
export type UpdateUserTokenHolding = Partial<Omit<NewUserTokenHolding, "userId" | "tokenAddress">>;
