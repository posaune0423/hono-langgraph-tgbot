import { Bot } from "grammy";
import type {
  AdminBroadcastRequest,
  AdminBroadcastResponse,
  AdminSendMessageRequest,
  AdminSendMessageResponse,
} from "../../types";
import { setupCommands } from "./command";
import { setupHandler } from "./handler";
import { broadcastMessage, sendMessage } from "./utils";

// Singleton bot instance
let botInstance: Bot | null = null;

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

  // create bot if not exists
  if (!botInstance) {
    botInstance = new Bot(token);

    // commands
    setupCommands(botInstance);

    // text message handler
    setupHandler(botInstance);
  }

  return botInstance;
};

/**
 * Get bot instance for admin operations
 */
export const getBotInstance = (): Bot => {
  if (!botInstance) {
    setupTelegramBot();
  }
  return botInstance!;
};

/**
 * Send message to specific user (legacy interface for admin API)
 */
export const sendAdminMessage = async (request: AdminSendMessageRequest): Promise<AdminSendMessageResponse> => {
  const result = await sendMessage([request.userId], request.message, {
    parse_mode: request.parseMode,
  });

  return result.match(
    (success) => ({
      success: true,
      messageId: success.results[0]?.messageId,
    }),
    (error) => ({
      success: false,
      error: error.message,
    }),
  );
};

/**
 * Send broadcast message (legacy interface for admin API)
 */
export const sendBroadcastMessage = async (request: AdminBroadcastRequest): Promise<AdminBroadcastResponse> => {
  const result = await broadcastMessage(request.message, {
    parse_mode: request.parseMode,
    excludeUserIds: request.excludeUserIds,
  });

  return result.match(
    (success) => ({
      success: true,
      totalUsers: success.totalUsers,
      results: success.results,
    }),
    (error) => ({
      success: false,
      error: error.message,
      totalUsers: 0,
      results: [],
    }),
  );
};
