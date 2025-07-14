import { relations } from "drizzle-orm";
import { users } from "./user";
import { tokens } from "./tokens";
import { userTokenHoldings } from "./user-token-holdings";
import { chatMessages } from "./chat-message";

/**
 * 全てのテーブルのRelations定義を集約
 * 循環参照を避けるため、別ファイルに分離
 */

/**
 * Users Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  tokenHoldings: many(userTokenHoldings, {
    relationName: "userHoldings",
  }),
  chatMessages: many(chatMessages),
}));

/**
 * Tokens Relations
 */
export const tokensRelations = relations(tokens, ({ many }) => ({
  userHoldings: many(userTokenHoldings, {
    relationName: "tokenHoldings",
  }),
}));

/**
 * UserTokenHoldings Relations
 */
export const userTokenHoldingsRelations = relations(userTokenHoldings, ({ one }) => ({
  user: one(users, {
    fields: [userTokenHoldings.userId],
    references: [users.userId],
    relationName: "userHoldings",
  }),
  token: one(tokens, {
    fields: [userTokenHoldings.tokenAddress],
    references: [tokens.address],
    relationName: "tokenHoldings",
  }),
}));

/**
 * ChatMessages Relations
 */
export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.userId],
  }),
}));

/**
 * 型定義（Relations含む）
 * 全てのスキーマがimportされた後に定義
 */
export type UserWithTokenHoldings = typeof users.$inferSelect & {
  tokenHoldings: Array<typeof userTokenHoldings.$inferSelect>;
};

export type TokenWithHoldings = typeof tokens.$inferSelect & {
  userHoldings: Array<typeof userTokenHoldings.$inferSelect>;
};

export type UserTokenHoldingWithRelations = typeof userTokenHoldings.$inferSelect & {
  user: typeof users.$inferSelect;
  token: typeof tokens.$inferSelect;
};
