import { pgTable, text, json, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { tokens } from "./tokens";
import { relations } from "drizzle-orm";
import { dataSource } from "./data-source";

export const signal = pgTable(
  "signal",
  {
    id: text("id").primaryKey().notNull(),
    token: text("token")
      .notNull()
      .references(() => tokens.address),
    signalType: text("signal_type").notNull(), // "HACK_NEWS", "RSI_OVERBOUGHT", etc.
    value: json("value"), // { "rsi": 72, ... } or { "headline": "...", ... }

    // ユーザー向け表示用（Telegram markdown対応）
    title: text("title").notNull(), // "🚨 $RAY Price Alert: -5.2% Drop"
    body: text("body").notNull(), // Telegram markdown + data_source links

    direction: text("direction"), // "BUY", "SELL", "NEUTRAL"（optional）
    confidence: numeric("confidence"), // 0.0-1.0
    explanation: text("explanation"), // LLM生成の自然言語説明
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("signal_token_idx").on(table.token),
    index("signal_type_idx").on(table.signalType),
    index("signal_timestamp_idx").on(table.timestamp.desc()),
  ],
);

export type Signal = typeof signal.$inferSelect;
export type NewSignal = typeof signal.$inferInsert;

export const signalRelations = relations(signal, ({ many }) => ({
  dataSources: many(dataSource, { relationName: "SignalToDataSource" }),
}));
