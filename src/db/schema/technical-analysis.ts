import { pgTable, text, integer, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { tokens } from "./tokens";

export const technicalAnalysis = pgTable("technical_analysis", {
  id: text("id").primaryKey().notNull(),
  token: text("token")
    .notNull()
    .references(() => tokens.address),
  timestamp: integer("timestamp").notNull(),

  vwap: numeric("vwap"),
  vwap_deviation: numeric("vwap_deviation"),
  obv: numeric("obv"),
  obv_zscore: numeric("obv_zscore"),
  percent_b: numeric("percent_b"),
  bb_width: numeric("bb_width"),
  atr: numeric("atr"),
  atr_percent: numeric("atr_percent"),
  adx: numeric("adx"),
  adx_direction: text("adx_direction"),
  rsi: numeric("rsi"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TechnicalAnalysis = typeof technicalAnalysis.$inferSelect;
export type NewTechnicalAnalysis = typeof technicalAnalysis.$inferInsert;
