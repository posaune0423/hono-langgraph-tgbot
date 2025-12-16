import { HumanMessage } from "@langchain/core/messages";
import type { Bot, Context } from "grammy";
import { initAgent } from "../agents/telegram";
import { logger } from "../utils/logger";
import { processGraphStream } from "../utils/stream";
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
  const { graph, config } = await initAgent(userId);

  const stream = await graph.stream({ messages: [new HumanMessage(userMessage)] }, config);

  await processGraphStream(stream, content => ctx.reply(content).then(() => {}));
};
