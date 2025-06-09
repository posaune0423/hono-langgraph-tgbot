import { Bot } from "grammy";
import { setupHandler } from "./handler";
import { setupCommands } from "./command";
import { logger } from "../../utils/logger";
import { getDB, users } from "../../db";
import { ok, err, Result } from "neverthrow";
import type {
  AdminSendMessageRequest,
  AdminSendMessageResponse,
  AdminBroadcastRequest,
  AdminBroadcastResponse,
  BroadcastResult,
  TelegramError,
  DatabaseError,
  MessageSentResult,
  UserListResult,
} from "../../types";
import { sleep } from "../../utils";
import { getUserIds } from "../../utils/db";

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
 * Send message to specific user with neverthrow error handling
 */
const sendMessageToUser = async (
  userId: string,
  message: string,
  parseMode?: "HTML" | "Markdown" | "MarkdownV2",
): Promise<Result<MessageSentResult, TelegramError>> => {
  const bot = getBotInstance();

  try {
    const result = await bot.api.sendMessage(userId, message, {
      parse_mode: parseMode,
    });

    logger.info("sendMessageToUser", `Message sent to user ${userId}`, {
      messageId: result.message_id,
      message: message.substring(0, 50) + "...",
    });

    return ok({
      userId,
      messageId: result.message_id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Categorize Telegram errors
    let errorType: TelegramError["type"] = "unknown";
    if (errorMessage.includes("Forbidden")) {
      errorType = "forbidden";
    } else if (errorMessage.includes("429")) {
      errorType = "rate_limit";
    } else if (errorMessage.includes("400")) {
      errorType = "invalid_user";
    } else if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
      errorType = "network";
    }

    logger.warn("sendMessageToUser", `Failed to send message to user ${userId}`, {
      error: errorMessage,
      type: errorType,
    });

    return err({
      type: errorType,
      message: errorMessage,
      userId,
    });
  }
};

/**
 * Process batch of users with Promise.allSettled for parallel processing
 */
const processBatch = async (
  userIds: string[],
  message: string,
  parseMode?: "HTML" | "Markdown" | "MarkdownV2",
): Promise<BroadcastResult[]> => {
  const promises = userIds.map((userId) => sendMessageToUser(userId, message, parseMode));

  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    const userId = userIds[index];

    if (result.status === "fulfilled" && result.value.isOk()) {
      const success = result.value.value;
      return {
        userId: success.userId,
        success: true,
        messageId: success.messageId,
      };
    }

    // Handle both rejection and error results
    let errorMessage: string;
    if (result.status === "rejected") {
      errorMessage = result.reason?.message || "Promise rejected";
    } else if (result.value.isErr()) {
      errorMessage = result.value.error.message;
    } else {
      errorMessage = "Unknown error";
    }

    return {
      userId,
      success: false,
      error: errorMessage,
    };
  });
};

/**
 * Send message to specific user from admin (legacy interface)
 */
export const sendAdminMessage = async (request: AdminSendMessageRequest): Promise<AdminSendMessageResponse> => {
  const result = await sendMessageToUser(request.userId, request.message, request.parseMode);

  return result.match(
    (success) => ({
      success: true,
      messageId: success.messageId,
    }),
    (error) => ({
      success: false,
      error: error.message,
    }),
  );
};

/**
 * Send broadcast message with efficient batch processing and neverthrow
 */
export const sendBroadcastMessage = async (request: AdminBroadcastRequest): Promise<AdminBroadcastResponse> => {
  logger.info("sendBroadcastMessage", "Starting broadcast", {
    messageLength: request.message.length,
    parseMode: request.parseMode,
    excludeCount: request.excludeUserIds?.length ?? 0,
  });

  // Get user list with early return pattern
  const userIds = await getUserIds(request.excludeUserIds);

  // Early return for empty user list
  if (userIds.length === 0) {
    logger.warn("sendBroadcastMessage", "No users found for broadcast");
    return {
      success: true,
      totalUsers: 0,
      results: [],
    };
  }

  // Process users in batches to respect rate limits
  const BATCH_SIZE = 25; // 25 concurrent messages per batch
  const BATCH_DELAY_MS = 1000; // 1 second between batches = 25 msg/sec
  const batches: string[][] = [];

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    batches.push(userIds.slice(i, i + BATCH_SIZE));
  }

  logger.info("sendBroadcastMessage", `Processing ${batches.length} batches of up to ${BATCH_SIZE} users each`);

  const allResults: BroadcastResult[] = [];

  // Process batches sequentially with parallel processing within each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    logger.info("sendBroadcastMessage", `Processing batch ${i + 1}/${batches.length} (${batch.length} users)`);

    const batchResults = await processBatch(batch, request.message, request.parseMode);
    allResults.push(...batchResults);

    // Add delay between batches (except for the last one)
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return {
    success: true,
    totalUsers: userIds.length,
    results: allResults,
  };
};
