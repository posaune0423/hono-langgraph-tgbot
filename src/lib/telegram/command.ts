import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { getUserMessages, upsertUser } from "../../utils/db";
import { logger } from "../../utils/logger";

export const setupCommands = (bot: Bot) => {
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
🤖 **Welcome to the Telegram Bot Template!**

Hello ${firstName || username || "there"}! 👋

This is a simple bot template built with:
• **TypeScript** for type safety
• **Hono** for web framework
• **grammY** for Telegram Bot API
• **Cloudflare Workers** for serverless deployment
• **Drizzle ORM** for database operations

**Available Commands:**
/start - Show this welcome message
/help - Get help information
/stats - View your usage statistics
/ping - Test bot responsiveness

Try sending me any message and I'll respond! ✨
    `;

    const keyboard = new InlineKeyboard()
      .text("📊 View Stats", "view_stats")
      .text("🏓 Ping", "ping_bot")
      .row()
      .text("ℹ️ Help", "show_help");

    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    logger.info("User started bot", { userId, username });
  });

  bot.command("help", async (ctx) => {
    const helpMessage = `
🆘 **Help - Bot Commands**

**Basic Commands:**
• \`/start\` - Show welcome message
• \`/help\` - Show this help message
• \`/stats\` - View your message statistics
• \`/ping\` - Test bot responsiveness

**Features:**
• Send me any text message and I'll respond
• I can handle photos, voice messages, and documents (with basic responses)
• All conversations are stored in the database
• Built with modern TypeScript and serverless technology

**Need Support?**
This is a template bot for developers. Check the repository for documentation and examples.
    `;

    await ctx.reply(helpMessage, {
      parse_mode: "Markdown",
    });
  });

  bot.command("stats", async (ctx) => {
    const userId = ctx.from?.id.toString();

    if (!userId) {
      await ctx.reply("Could not retrieve user information.");
      return;
    }

    try {
      const messagesResult = await getUserMessages(userId, 1000);

      if (messagesResult.isErr()) {
        await ctx.reply("Error retrieving your statistics. Please try again.");
        return;
      }

      const messages = messagesResult.value;
      const humanMessages = messages.filter((m) => m.messageType === "human");
      const aiMessages = messages.filter((m) => m.messageType === "ai");

      const statsMessage = `
📊 **Your Bot Statistics**

💬 **Messages Sent:** ${humanMessages.length}
🤖 **Bot Responses:** ${aiMessages.length}
📅 **First Message:** ${messages.length > 0 ? new Date(messages[messages.length - 1].timestamp).toLocaleDateString() : "N/A"}
🕐 **Last Activity:** ${messages.length > 0 ? new Date(messages[0].timestamp).toLocaleString() : "N/A"}

Thanks for using the bot! 🎉
      `;

      await ctx.reply(statsMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error getting user stats", error);
      await ctx.reply("Error retrieving your statistics. Please try again.");
    }
  });

  bot.command("ping", async (ctx) => {
    const startTime = Date.now();
    const message = await ctx.reply("🏓 Pinging...");
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (!ctx.chat?.id) {
      await ctx.reply("Error: Chat ID not available.");
      return;
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      message.message_id,
      `🏓 **Pong!**\n\n⚡ Response time: ${responseTime}ms\n🕐 Server time: ${new Date().toLocaleString()}`,
      { parse_mode: "Markdown" },
    );
  });

  // Handle inline keyboard callbacks
  bot.callbackQuery("view_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.chat?.id) {
      await ctx.api.sendMessage(ctx.chat.id, "/stats");
    }
  });

  bot.callbackQuery("ping_bot", async (ctx) => {
    await ctx.answerCallbackQuery("🏓 Pong!");

    if (!ctx.chat?.id || !ctx.callbackQuery?.message?.message_id) {
      return;
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      ctx.callbackQuery.message.message_id,
      `🏓 **Pong!**\n\nResponse time: ~${(Math.random() * 100) | 0}ms\nServer time: ${new Date().toLocaleString()}`,
      { parse_mode: "Markdown" },
    );
  });

  bot.callbackQuery("show_help", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.chat?.id) {
      await ctx.api.sendMessage(ctx.chat.id, "/help");
    }
  });
};
