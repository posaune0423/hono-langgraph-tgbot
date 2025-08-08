import { HumanMessage } from "@langchain/core/messages";
import type { Bot, Context } from "grammy";
import { initAgent } from "../agents/telegram";
import { logger } from "../utils/logger";
import { extractUserInfo } from "../utils/telegram";

export const setupHandler = (bot: Bot) => {
  bot.on("message", handleMessage);
};

const handleMessage = async (ctx: Context) => {
  const userMessage = ctx.message?.text;
  if (!userMessage) {
    logger.error("handleMessage", "User message not found");
    return;
  }

  const { userId } = extractUserInfo(ctx);
  const { graph } = await initAgent(userId);
  const result = await graph.invoke({ messages: [new HumanMessage(userMessage)] });
  const response = result.messages[result.messages.length - 1]?.content.toString();

  if (!response) {
    logger.error("handleMessage", "Response not found");
    return;
  }

  await ctx.reply(response.toString());
};
