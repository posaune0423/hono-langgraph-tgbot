import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text, integer, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { logger } from "./utils/logger";

// Users table based on UserProfile interface
export const users = pgTable("users", {
  userId: text("user_id").primaryKey().notNull(), // Telegram user ID
  walletAddress: text("wallet_address").notNull(),

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
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const tokens = pgTable("tokens", {
  address: text("address").primaryKey().notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  decimals: integer("decimals").notNull(),
  logoURI: text("logo_uri").notNull(),
});

export const tokenOHLCV = pgTable("token_ohlcv", {
  token: text("token")
    .notNull()
    .references(() => tokens.address),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  open: integer("open").notNull(),
  high: integer("high").notNull(),
  low: integer("low").notNull(),
  close: integer("close").notNull(),
  volume: integer("volume").notNull(),
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

const schema = { users, chatHistory, tokens, tokenOHLCV };

// Export schema for external usage
export { schema };
