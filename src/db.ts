import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text, integer, timestamp, json, boolean, numeric, primaryKey } from "drizzle-orm/pg-core";
import { logger } from "./utils/logger";

// Users table based on UserProfile interface
export const users = pgTable("users", {
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
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chat history table
export const chatHistory = pgTable("chat_history", {
  messageId: text("message_id").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.userId),
  content: text("content").notNull(),
  messageType: text("message_type").notNull(), // 'human' or 'ai'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const tokens = pgTable("tokens", {
  address: text("address").primaryKey().notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  decimals: integer("decimals").notNull(),
  iconUrl: text("icon_url").notNull(),
});

export const tokenOHLCV = pgTable(
  "token_ohlcv",
  {
    token: text("token")
      .notNull()
      .references(() => tokens.address),
    timestamp: integer("timestamp").notNull(), // UNIX timestamp in seconds
    open: numeric("open").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    close: numeric("close").notNull(),
    volume: numeric("volume").notNull(),
  },
  (table) => [primaryKey({ columns: [table.token, table.timestamp] })],
);

// Technical analysis results table
export const technicalAnalysis = pgTable("technical_analysis", {
  id: text("id").primaryKey().notNull(),
  token: text("token")
    .notNull()
    .references(() => tokens.address),
  timestamp: integer("timestamp").notNull(),
  rsi: numeric("rsi"),
  macd: numeric("macd"),
  macd_signal: numeric("macd_signal"),
  macd_histogram: numeric("macd_histogram"),
  bb_upper: numeric("bb_upper"),
  bb_middle: numeric("bb_middle"),
  bb_lower: numeric("bb_lower"),
  sma_20: numeric("sma_20"),
  sma_50: numeric("sma_50"),
  ema_12: numeric("ema_12"),
  ema_26: numeric("ema_26"),
  volume_sma: numeric("volume_sma"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Trading signals table
export const tradingSignals = pgTable("trading_signals", {
  id: text("id").primaryKey().notNull(),
  token: text("token")
    .notNull()
    .references(() => tokens.address),
  signal_type: text("signal_type").notNull(), // 'BUY', 'SELL', 'HOLD'
  indicator: text("indicator").notNull(), // 'RSI', 'MACD', 'BB', 'SMA_CROSS', etc.
  strength: text("strength").notNull(), // 'WEAK', 'MODERATE', 'STRONG'
  price: numeric("price").notNull(),
  message: text("message").notNull(),
  metadata: json("metadata").$type<Record<string, any>>(),
  timestamp: integer("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Export types for use in other files
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ChatMessage = typeof chatHistory.$inferSelect;
export type NewChatMessage = typeof chatHistory.$inferInsert;

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
export type TokenOHLCV = typeof tokenOHLCV.$inferSelect;
export type NewTokenOHLCV = typeof tokenOHLCV.$inferInsert;

export type TechnicalAnalysis = typeof technicalAnalysis.$inferSelect;
export type NewTechnicalAnalysis = typeof technicalAnalysis.$inferInsert;
export type TradingSignal = typeof tradingSignals.$inferSelect;
export type NewTradingSignal = typeof tradingSignals.$inferInsert;

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDB() {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      logger.error("getDB()", "DATABASE_URL is not set");
      throw new Error("DATABASE_URL must be a Neon postgres connection string");
    }

    logger.info("getDB()", "[DB] Connecting to Neon database");
    const sql = neon(process.env.DATABASE_URL);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

const schema = { users, chatHistory, tokens, tokenOHLCV, technicalAnalysis, tradingSignals };

// Export schema for external usage
export { schema };
