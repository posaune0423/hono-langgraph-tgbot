import type { Bot } from "grammy";
import { getDB, users } from "../db";
import { logger } from "../utils/logger";

const ALL_COMMANDS: { command: string; description: string }[] = [
  {
    command: "start",
    description: "Show this welcome message",
  },
  {
    command: "help",
    description: "Get help information",
  },
];

export const setupCommands = (bot: Bot) => {
  bot.api.setMyCommands(ALL_COMMANDS);

  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;
    const username = ctx.from?.username;
    const languageCode = ctx.from?.language_code;

    // Create or update user profile
    const db = getDB();
    await db
      .insert(users)
      .values({
        userId,
        firstName,
        lastName,
        username,
        languageCode,
        lastActiveAt: Math.floor(Date.now() / 1000),
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          lastActiveAt: Math.floor(Date.now() / 1000),
        },
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

Try sending me any message and I'll respond! ✨
    `;

    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
    });

    logger.info("User started bot", { userId, username });
  });
};
