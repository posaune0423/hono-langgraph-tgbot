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

/**
 * Extract error message from union error types
 */
const getErrorMessage = (error: { type: string; message?: string; entity?: string; id?: string }): string => {
  if ("message" in error && error.message) {
    return error.message;
  }
  if (error.type === "not_found" && "entity" in error && "id" in error) {
    return `${error.entity} with ID ${error.id} not found`;
  }
  return `Error: ${error.type}`;
};

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

    // commands (only if database is provided)
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
  if (!botInstance) {
    throw new Error("Failed to initialize Telegram bot");
  }
  return botInstance;
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
      error: getErrorMessage(error),
      totalUsers: 0,
      results: [],
    }),
  );
};
