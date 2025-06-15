import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { signal } from "./signal";

export const dataSource = pgTable(
  "data_source",
  {
    id: text("id").primaryKey().notNull(),
    type: text("type").notNull(), // "twitter", "news", "onchain", "discord", etc.
    url: text("url"), // 情報源のURL
    summary: text("summary"), // 要約やタイトル
    publishedAt: timestamp("published_at"), // 情報がpublicになった時刻
    rawContent: text("raw_content"), // 取得時の生データ（optional）
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("data_source_type_idx").on(table.type),
    index("data_source_published_at_idx").on(table.publishedAt.desc()),
  ],
);

export type DataSource = typeof dataSource.$inferSelect;
export type NewDataSource = typeof dataSource.$inferInsert;

export const dataSourceRelations = relations(dataSource, ({ many }) => ({
  signals: many(signal, { relationName: "SignalToDataSource" }),
}));
