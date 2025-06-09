import { Bot } from "grammy";
import { setupHandler } from "./handler";
import { setupCommands } from "./command";

/**
 * Initialize and configure the Telegram bot
 * @returns webhookCallback handler
 */
export const setupTelegramBot = () => {
  // get Telegram bot token
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable not found.");
  }

  // create bot
  const bot = new Bot(token);

  // commands
  setupCommands(bot);

  // text message handler
  setupHandler(bot);

  return bot;
};
