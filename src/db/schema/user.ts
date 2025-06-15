import { pgTable, text, integer, timestamp, json, boolean } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
