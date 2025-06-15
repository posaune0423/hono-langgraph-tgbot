import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const tokens = pgTable("tokens", {
  address: text("address").primaryKey().notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  decimals: integer("decimals").notNull(),
  iconUrl: text("icon_url").notNull(),
});

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
