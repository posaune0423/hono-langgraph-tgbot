import { Bot } from "grammy";
import { setupCommands } from "./commands";
import { setupHandler } from "./handler";

// Singleton bot instance
let botInstance: Bot | null = null;

export const getBotInstance = () => {
  if (!botInstance) {
    botInstance = new Bot(process.env.TELEGRAM_BOT_TOKEN as string);
  }
  return botInstance;
};

export const initBot = async () => {
  const bot = getBotInstance();
  await bot.init();

  setupHandler(bot);
  setupCommands(bot);

  return bot;
};
