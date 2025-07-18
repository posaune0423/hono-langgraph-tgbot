import { boolean, index, integer, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * ユーザーテーブル - Telegramユーザーのプロフィール情報
 */
export const users = pgTable(
  "users",
  {
    userId: text("user_id").primaryKey().notNull(), // Telegram user ID
    walletAddress: text("wallet_address").notNull(),

    firstName: text("first_name"),
    lastName: text("last_name"),
    username: text("username"),

    // Demographics
    age: integer("age"),

    // Financial info
    cryptoRiskTolerance: integer("crypto_risk_tolerance"), // 1-10 scale
    totalAssets: integer("total_assets"),
    cryptoAssets: integer("crypto_assets"),

    // Emotional state
    panicLevel: integer("panic_level"), // 1-10 scale
    heartRate: integer("heart_rate"), // From wearable devices

    // Interests array stored as JSON
    interests: json("interests").$type<string[]>(),

    // Setup tracking
    currentSetupStep: text("current_setup_step"),
    setupCompleted: boolean("setup_completed").default(false),
    waitingForInput: text("waiting_for_input"),

    // Timestamps
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // インデックス定義（クエリパフォーマンス向上）
    index("users_wallet_address_idx").on(table.walletAddress),
    index("users_setup_completed_idx").on(table.setupCompleted),
    index("users_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Relations定義は循環参照を避けるため、
 * 別のファイルまたは後で定義する必要があります
 */

/**
 * 型定義（Drizzle推奨の型推論を活用）
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * 部分的更新用の型定義
 */
export type UpdateUser = Partial<Omit<NewUser, "userId" | "createdAt">>;

/**
 * クエリ用の型定義（リレーション含む）
 * Note: Relations定義後にimportして使用
 */
// export type UserWithTokenHoldings = User & {
//   tokenHoldings: Array<typeof userTokenHoldings.$inferSelect>;
// };
