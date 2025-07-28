import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { getUserMessages, upsertUser } from "../../utils/db";
import { logger } from "../../utils/logger";

const ALL_COMMANDS: { command: string; description: string }[] = [
  {
    command: "start",
    description: "Show this welcome message",
  },
  {
    command: "help",
    description: "Get help information",
  },
  {
    command: "stats",
    description: "View your usage statistics",
  },
  {
    command: "ping",
    description: "Test bot responsiveness",
  },
];

// Common message generators
const getHelpMessage = () => `
🆘 *Help - Bot Commands*

*Basic Commands:*
• /start - Show welcome message
• /help - Show this help message
• /stats - View your message statistics
• /ping - Test bot responsiveness

*Features:*
• Send me any text message and I'll respond
• I can handle photos, voice messages, and documents (with basic responses)
• All conversations are stored in the database
• Built with modern TypeScript and serverless technology

*Need Support?*
This is a template bot for developers. Check the repository for documentation and examples.
`;

const getStatsMessage = async (userId: string) => {
  const messagesResult = await getUserMessages(userId, 1000);

  if (messagesResult.isErr()) {
    throw new Error("Error retrieving statistics");
  }

  const messages = messagesResult.value;
  const humanMessages = messages.filter((m) => m.messageType === "human");
  const aiMessages = messages.filter((m) => m.messageType === "ai");

  const firstMessage = messages.at(-1);
  const lastMessage = messages.at(0);

  return `
📊 *Your Bot Statistics*

💬 *Messages Sent:* ${humanMessages.length}
🤖 *Bot Responses:* ${aiMessages.length}
📅 *First Message:* ${firstMessage?.timestamp ? new Date(firstMessage.timestamp).toLocaleDateString() : "N/A"}
🕐 *Last Activity:* ${lastMessage?.timestamp ? new Date(lastMessage.timestamp).toLocaleString() : "N/A"}

Thanks for using the bot! 🎉
  `;
};

const getPingMessage = (responseTime: number) =>
  `🏓 **Pong!**\n\n⚡ Response time: ${responseTime}ms\n🕐 Server time: ${new Date().toLocaleString()}`;

// Common handlers
const handleHelp = async (replyFn: (text: string, options?: any) => Promise<any>) => {
  await replyFn(getHelpMessage(), { parse_mode: "Markdown" });
};

const handleStats = async (userId: string | undefined, replyFn: (text: string, options?: any) => Promise<any>) => {
  if (!userId) {
    await replyFn("Could not retrieve user information.");
    return;
  }

  try {
    const statsMessage = await getStatsMessage(userId);
    await replyFn(statsMessage, { parse_mode: "Markdown" });
  } catch (error) {
    logger.error("Error getting user stats", error);
    await replyFn("Error retrieving your statistics. Please try again.");
  }
};

const handlePing = async (replyFn: (text: string, options?: any) => Promise<any>) => {
  const startTime = Date.now();
  const message = await replyFn("🏓 Pinging...");
  const endTime = Date.now();
  const responseTime = endTime - startTime;

  return { message, responseTime };
};

export const setupCommands = (bot: Bot) => {
  bot.api.setMyCommands(ALL_COMMANDS);

  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id.toString();
    const firstName = ctx.from?.first_name;
    const username = ctx.from?.username;

    if (!userId) {
      await ctx.reply("Could not retrieve user information. Please try again.");
      return;
    }

    // Create or update user profile
    await upsertUser({
      userId,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      username: ctx.from?.username,
      languageCode: ctx.from?.language_code,
    });

    const welcomeMessage = `
🤖 *Welcome to the Telegram Bot Template!*

Hello ${firstName || username || "there"}! 👋

This is a simple bot template built with:
• *TypeScript* for type safety
• *Hono* for web framework
• *grammY* for Telegram Bot API
• *Cloudflare Workers* for serverless deployment
• *Drizzle ORM* for database operations

*Available Commands:*
• /start - Show this welcome message
• /help - Get help information
• /stats - View your usage statistics
• /ping - Test bot responsiveness

Try sending me any message and I'll respond! ✨
    `;

    const keyboard = new InlineKeyboard()
      .text("📊 View Stats", "stats")
      .text("🏓 Ping", "ping")
      .row()
      .text("ℹ️ Help", "help");

    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    logger.info("User started bot", { userId, username });
  });

  bot.command("help", async (ctx) => {
    await handleHelp((text, options) => ctx.reply(text, options));
  });

  bot.command("stats", async (ctx) => {
    await handleStats(ctx.from?.id.toString(), (text, options) => ctx.reply(text, options));
  });

  bot.command("ping", async (ctx) => {
    const result = await handlePing((text) => ctx.reply(text));

    if (!ctx.chat?.id || !result) {
      await ctx.reply("Error: Chat ID not available.");
      return;
    }

    await ctx.api.editMessageText(ctx.chat.id, result.message.message_id, getPingMessage(result.responseTime), {
      parse_mode: "Markdown",
    });
  });

  // Callback query handlers for inline keyboard buttons
  bot.callbackQuery("help", async (ctx) => {
    await ctx.answerCallbackQuery("Calling help...");
    await handleHelp((text, options) => ctx.editMessageText(text, options));
  });

  bot.callbackQuery("stats", async (ctx) => {
    await ctx.answerCallbackQuery("Calling stats...");
    await handleStats(ctx.from?.id.toString(), (text, options) => ctx.editMessageText(text, options));
  });

  bot.callbackQuery("ping", async (ctx) => {
    await ctx.answerCallbackQuery("Calling ping...");

    const result = await handlePing((text) => ctx.editMessageText(text));

    if (!result) return;

    await ctx.editMessageText(getPingMessage(result.responseTime), { parse_mode: "Markdown" });
  });
};
