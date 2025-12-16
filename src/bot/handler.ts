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
  const { graph, config } = await initAgent(userId);

  const sentMessages = new Set<string>();
  const stream = await graph.stream({ messages: [new HumanMessage(userMessage)] }, config);

  for await (const event of stream) {
    for (const [_nodeName, nodeOutput] of Object.entries(event)) {
      const state = nodeOutput as { messages?: Array<{ content?: string }> };
      const content = state.messages?.[state.messages.length - 1]?.content?.toString();

      if (!content || sentMessages.has(content)) continue;

      // Send intermediate output from generalist node or final output from __end__
      sentMessages.add(content);
      await ctx.reply(content);
    }
  }
};
