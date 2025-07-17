import { err, ok, type Result } from "neverthrow";
import type { User } from "../../db";
import type { BroadcastResult, MessageSentResult, TelegramBroadcastError, TelegramError } from "../../types";
import { sleep } from "../../utils";
import { getUserIds } from "../../utils/db";
import { logger } from "../../utils/logger";
import { getBotInstance } from "./bot";

/**
 * Send message to single user with detailed error handling
 */
const sendToSingleUser = async (
  userId: string,
  message: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    disable_notification?: boolean;
  },
): Promise<Result<MessageSentResult, TelegramError>> => {
  try {
    const bot = getBotInstance();

    const result = await bot.api.sendMessage(userId, message, {
      parse_mode: options?.parse_mode,
      disable_notification: options?.disable_notification ?? false,
    });

    logger.info(`Message sent to user ${userId}`, {
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

    logger.warn(`Failed to send message to user ${userId}`, {
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
 * Process batch of users with parallel execution
 */
const processBatch = async (
  userIds: string[],
  message: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    disable_notification?: boolean;
  },
): Promise<
  Array<{
    userId: string;
    success: boolean;
    messageId?: number;
    error?: string;
  }>
> => {
  const promises = userIds.map((userId) => sendToSingleUser(userId, message, options));
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
 * Send message to specific users with batch processing and rate limiting
 *
 * @param userIds - Target user IDs
 * @param message - Message to send
 * @param options - Send options including batch size and delay
 * @returns Send result
 */
export const sendMessage = async (
  userIds: string[],
  message: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    disable_notification?: boolean;
    batchSize?: number;
    batchDelayMs?: number;
  },
): Promise<Result<BroadcastResult, TelegramError>> => {
  try {
    const { batchSize = 25, batchDelayMs = 1000, ...sendOptions } = options ?? {};

    logger.info("Starting message send to specific users", {
      totalUsers: userIds.length,
      messageLength: message.length,
      parseMode: sendOptions.parse_mode,
    });

    if (userIds.length === 0) {
      logger.warn("No users provided for message send");
      return ok({
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        failedUsers: [],
        results: [],
      });
    }

    // Create batches
    const batches: string[][] = [];
    for (let i = 0; i < userIds.length; i += batchSize) {
      batches.push(userIds.slice(i, i + batchSize));
    }

    logger.info(`Processing ${batches.length} batches of up to ${batchSize} users each`);

    const allResults: Array<{
      userId: string;
      success: boolean;
      messageId?: number;
      error?: string;
    }> = [];

    // Process batches sequentially with parallel processing within each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} users)`);

      const batchResults = await processBatch(batch, message, sendOptions);
      allResults.push(...batchResults);

      // Add delay between batches (except for the last one)
      if (i < batches.length - 1) {
        await sleep(batchDelayMs);
      }
    }

    const successCount = allResults.filter((r) => r.success).length;
    const failureCount = allResults.filter((r) => !r.success).length;
    const failedUsers = allResults.filter((r) => !r.success).map((r) => r.userId);

    const result: BroadcastResult = {
      totalUsers: userIds.length,
      successCount,
      failureCount,
      failedUsers,
      results: allResults,
    };

    logger.info("Message send completed", {
      totalUsers: result.totalUsers,
      successCount: result.successCount,
      failureCount: result.failureCount,
      successRate: result.totalUsers > 0 ? ((result.successCount / result.totalUsers) * 100).toFixed(1) + "%" : "0%",
    });

    return ok(result);
  } catch (error) {
    return err({
      type: "bot_error",
      message: error instanceof Error ? error.message : "Unknown bot error",
    });
  }
};

/**
 * Broadcast message to all users with batch processing and rate limiting
 *
 * @param message - Message to broadcast
 * @param options - Broadcast options
 * @returns Broadcast result
 */
export const broadcastMessage = async (
  message: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    disable_notification?: boolean;
    excludeUserIds?: string[];
    batchSize?: number;
    batchDelayMs?: number;
  },
): Promise<Result<BroadcastResult, TelegramError>> => {
  try {
    logger.info("Starting broadcast to all users");

    const userIds = await getUserIds(options?.excludeUserIds);

    if (userIds.length === 0) {
      logger.info("No users found for broadcast");
      return ok({
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        failedUsers: [],
        results: [],
      });
    }

    logger.info(`Broadcasting message to ${userIds.length} users`);

    return await sendMessage(userIds, message, options);
  } catch (error) {
    return err({
      type: "bot_error",
      message: error instanceof Error ? error.message : "Failed to fetch users",
    });
  }
};

// Legacy compatibility functions for existing code
/**
 * @deprecated Use sendMessage instead
 */
export const broadcastToUsers = async (
  users: User[],
  message: string,
  options?: { parse_mode?: "Markdown" | "HTML"; disable_notification?: boolean },
): Promise<
  Result<
    { totalUsers: number; successCount: number; failureCount: number; failedUsers: string[] },
    TelegramBroadcastError
  >
> => {
  const userIds = users.map((user) => user.userId);

  const result = await sendMessage(userIds, message, {
    parse_mode: options?.parse_mode === "Markdown" ? "Markdown" : options?.parse_mode,
    disable_notification: options?.disable_notification,
  });

  return result.match(
    (success) =>
      ok({
        totalUsers: success.totalUsers,
        successCount: success.successCount,
        failureCount: success.failureCount,
        failedUsers: success.failedUsers,
      }),
    (error) =>
      err({
        type: "send_error" as const,
        message: error.message,
        failedUsers: [],
      }),
  );
};

/**
 * @deprecated Use broadcastMessage instead
 */
export const broadcastToAllUsers = broadcastMessage;
