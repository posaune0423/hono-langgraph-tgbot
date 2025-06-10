import { Hono } from "hono";
import { webhookCallback } from "grammy";
import { setupTelegramBot } from "../lib/telegram/bot";
import { logger } from "../utils/logger";
import { TIMEOUT_MS } from "../constants";

const route = new Hono();

route.post("/telegram", async (c) => {
  try {
    logger.info("post /webhook/telegram", "Received Telegram webhook");

    // BOT_TOKENが設定されているか確認
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.error("post /webhook/telegram", "TELEGRAM_BOT_TOKEN not found");
      return c.json({ error: "Bot token not configured" }, 500);
    }

    // Setup the bot
    const bot = setupTelegramBot();

    // botを初期化（必須）
    await bot.init();

    // Create webhook callback
    const handleUpdate = webhookCallback(bot, "hono", {
      timeoutMilliseconds: TIMEOUT_MS,
    });

    // Process the webhook
    return await handleUpdate(c);
  } catch (error) {
    logger.error("post /webhook/telegram", "Telegram webhook error", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    });

    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export default route;
