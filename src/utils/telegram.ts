import type { Context } from "grammy";
import { logger } from "./logger";

export const extractUserInfo = (ctx: Context) => {
  if (!ctx.from?.id) {
    logger.error("extractUserInfo", "User ID not found");
    throw new Error("User ID not found");
  }

  return {
    userId: ctx.from?.id,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
    languageCode: ctx.from?.language_code,
  };
};
