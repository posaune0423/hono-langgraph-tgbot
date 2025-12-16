import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { initBot } from "../bot";
import { TIMEOUT_MS } from "../constants";
import { logger } from "../utils/logger";

const route = new Hono<{ Bindings: CloudflareBindings }>();

route.post("/telegram", async c => {
  try {
    // BOT_TOKENが設定されているか確認
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.error("post /webhook/telegram", "TELEGRAM_BOT_TOKEN not found");
      return c.json({ error: "Bot token not configured" }, 500);
    }

    // Setup the bot with database
    const bot = await initBot();

    // Create webhook callback with reduced timeout
    const handleUpdate = webhookCallback(bot, "hono", {
      timeoutMilliseconds: TIMEOUT_MS,
    });

    // Process the webhook
    return await handleUpdate(c);
  } catch (error) {
    logger.error("post /webhook/telegram", "Telegram webhook error", error);

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
