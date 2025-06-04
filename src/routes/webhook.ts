import { Hono } from "hono";
import { setupTelegramBot } from "../lib/telegram/bot";
import { webhookCallback } from "grammy";
import { logger } from "../utils/logger";

const route = new Hono();

route.post("/webhook/telegram", async (c) => {
  try {
    // Setup the bot
    const bot = setupTelegramBot();

    // Create webhook callback
    const handleUpdate = webhookCallback(bot, "hono");

    // Process the webhook
    return await handleUpdate(c);
  } catch (error) {
    logger.error("post /webhook/telegram", "Telegram webhook error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default route;
