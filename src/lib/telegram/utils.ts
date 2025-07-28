import { InlineKeyboard } from "grammy";
import { err, ok, type Result } from "neverthrow";
import type { BroadcastResult, MessageSentResult, TelegramError } from "../../types";
import { sleep } from "../../utils";
import { type DatabaseError, getUserIds } from "../../utils/db";
import { logger } from "../../utils/logger";
import { getBotInstance } from "./bot";

/**
 * Enhanced Telegram button configuration
 */
export interface TelegramButton {
  readonly text: string;
  readonly url?: string;
  readonly callback_data?: string;
}

/**
 * Message sending options with enhanced typing
 */
export interface MessageSendOptions {
  readonly parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  readonly disable_notification?: boolean;
  readonly buttons?: readonly TelegramButton[];
  readonly batchSize?: number;
  readonly batchDelayMs?: number;
}

/**
 * Broadcast options extending message send options
 */
export interface BroadcastOptions extends MessageSendOptions {
  readonly excludeUserIds?: readonly string[];
}

/**
 * Enhanced error categorization for Telegram operations
 */
const categorizeTelegramError = (error: unknown): TelegramError["type"] => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("Forbidden") || errorMessage.includes("blocked")) {
    return "forbidden";
  }

  if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
    return "rate_limit";
  }

  if (errorMessage.includes("400") || errorMessage.includes("Bad Request")) {
    return "invalid_user";
  }

  if (errorMessage.includes("network") || errorMessage.includes("timeout") || errorMessage.includes("ECONNRESET")) {
    return "network";
  }

  return "unknown";
};

/**
 * Create inline keyboard from button configuration
 */
const createInlineKeyboard = (buttons: readonly TelegramButton[]): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  buttons.forEach((button, index) => {
    if (button.url) {
      keyboard.url(button.text, button.url);
    } else if (button.callback_data) {
      keyboard.text(button.text, button.callback_data);
    }

    // Start new row after every 2 buttons for better mobile UX
    if (index % 2 === 1 && index < buttons.length - 1) {
      keyboard.row();
    }
  });

  return keyboard;
};

/**
 * Validate message content
 */
const validateMessage = (message: string): Result<string, TelegramError> => {
  if (!message?.trim()) {
    return err({
      type: "invalid_user",
      message: "Message content cannot be empty",
    });
  }

  if (message.length > 4096) {
    return err({
      type: "invalid_user",
      message: `Message too long: ${message.length} characters (max: 4096)`,
    });
  }

  return ok(message);
};

/**
 * Validate user ID format
 */
const validateUserId = (userId: string): Result<string, TelegramError> => {
  if (!userId?.trim()) {
    return err({
      type: "invalid_user",
      message: "User ID cannot be empty",
    });
  }

  // Basic numeric validation for Telegram user IDs
  if (!/^\d+$/.test(userId)) {
    return err({
      type: "invalid_user",
      message: "Invalid user ID format",
      userId,
    });
  }

  return ok(userId);
};

/**
 * Send message to single user with comprehensive error handling
 */
const sendToSingleUser = async (
  userId: string,
  message: string,
  options: MessageSendOptions = {},
): Promise<Result<MessageSentResult, TelegramError>> => {
  // Validate inputs
  const userIdValidation = validateUserId(userId);
  if (userIdValidation.isErr()) {
    return err(userIdValidation.error);
  }

  const messageValidation = validateMessage(message);
  if (messageValidation.isErr()) {
    return err(messageValidation.error);
  }

  try {
    const bot = getBotInstance();

    // Create inline keyboard if buttons are provided
    const reply_markup =
      options.buttons && options.buttons.length > 0 ? createInlineKeyboard(options.buttons) : undefined;

    const result = await bot.api.sendMessage(userId, message, {
      parse_mode: options.parse_mode,
      disable_notification: options.disable_notification ?? false,
      reply_markup,
    });

    logger.debug("Message sent successfully", {
      userId,
      messageId: result.message_id,
      messageLength: message.length,
      buttonsCount: options.buttons?.length || 0,
      parseMode: options.parse_mode,
    });

    return ok({
      userId,
      messageId: result.message_id,
    });
  } catch (error) {
    const errorType = categorizeTelegramError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.warn("Failed to send message to user", {
      userId,
      error: errorMessage,
      errorType,
      messageLength: message.length,
    });

    return err({
      type: errorType,
      message: errorMessage,
      userId,
    });
  }
};

/**
 * Process batch of users with parallel execution and comprehensive error tracking
 */
const processBatch = async (
  userIds: readonly string[],
  message: string,
  options: MessageSendOptions = {},
): Promise<
  readonly {
    readonly userId: string;
    readonly success: boolean;
    readonly messageId?: number;
    readonly error?: string;
  }[]
> => {
  const promises = userIds.map((userId) => sendToSingleUser(userId, message, options));
  const results = await Promise.allSettled(promises);

  return results.map((result, index) => {
    const userId = userIds[index];

    if (!userId) {
      return {
        userId: "unknown",
        success: false,
        error: `Invalid user ID at index ${index}`,
      } as const;
    }

    if (result.status === "fulfilled" && result.value.isOk()) {
      const success = result.value.value;
      return {
        userId: success.userId,
        success: true,
        messageId: success.messageId,
      } as const;
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
    } as const;
  });
};

/**
 * Validate batch configuration
 */
const validateBatchConfig = (batchSize: number, batchDelayMs: number): Result<void, TelegramError> => {
  if (batchSize <= 0 || batchSize > 100) {
    return err({
      type: "invalid_user",
      message: `Invalid batch size: ${batchSize} (must be between 1 and 100)`,
    });
  }

  if (batchDelayMs < 0) {
    return err({
      type: "invalid_user",
      message: `Invalid batch delay: ${batchDelayMs} (must be >= 0)`,
    });
  }

  return ok(undefined);
};

/**
 * Create batches from user IDs
 */
const createBatches = (userIds: readonly string[], batchSize: number): (readonly string[])[] => {
  const batches: (readonly string[])[] = [];
  for (let i = 0; i < userIds.length; i += batchSize) {
    batches.push(userIds.slice(i, i + batchSize));
  }
  return batches;
};

/**
 * Send message to specific users with batch processing and rate limiting
 */
export const sendMessage = async (
  userIds: readonly string[],
  message: string,
  options: MessageSendOptions = {},
): Promise<Result<BroadcastResult, TelegramError>> => {
  // Validate message first
  const messageValidation = validateMessage(message);
  if (messageValidation.isErr()) {
    return err(messageValidation.error);
  }

  // Extract options with defaults
  const { batchSize = 25, batchDelayMs = 1000, ...sendOptions } = options;

  // Validate batch configuration
  const batchValidation = validateBatchConfig(batchSize, batchDelayMs);
  if (batchValidation.isErr()) {
    return err(batchValidation.error);
  }

  logger.info("Starting targeted message send", {
    totalUsers: userIds.length,
    messageLength: message.length,
    parseMode: sendOptions.parse_mode,
    buttonsCount: sendOptions.buttons?.length || 0,
    batchSize,
    batchDelayMs,
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

  try {
    // Create batches
    const batches = createBatches(userIds, batchSize);

    logger.info(`Processing ${batches.length} batches of up to ${batchSize} users each`);

    const allResults: Array<{
      readonly userId: string;
      readonly success: boolean;
      readonly messageId?: number;
      readonly error?: string;
    }> = [];

    // Process batches sequentially with parallel processing within each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;

      logger.debug(`Processing batch ${i + 1}/${batches.length} (${batch.length} users)`);

      const batchResults = await processBatch(batch, message, sendOptions);
      allResults.push(...batchResults);

      // Add delay between batches (except for the last one)
      if (i < batches.length - 1 && batchDelayMs > 0) {
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

    logger.info("Targeted message send completed", {
      totalUsers: result.totalUsers,
      successCount: result.successCount,
      failureCount: result.failureCount,
      successRate: result.totalUsers > 0 ? `${((result.successCount / result.totalUsers) * 100).toFixed(1)}%` : "0%",
    });

    return ok(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error during message send", {
      error: errorMessage,
      userCount: userIds.length,
    });

    return err({
      type: "bot_error",
      message: errorMessage,
    });
  }
};

/**
 * Broadcast message to all users with enhanced error handling
 */
export const broadcastMessage = async (
  message: string,
  options: BroadcastOptions = {},
): Promise<Result<BroadcastResult, TelegramError | DatabaseError>> => {
  // Validate message first
  const messageValidation = validateMessage(message);
  if (messageValidation.isErr()) {
    return err(messageValidation.error);
  }

  logger.info("Starting broadcast to all users", {
    messageLength: message.length,
    excludeCount: options.excludeUserIds?.length || 0,
  });

  try {
    const userIds = await getUserIds(options.excludeUserIds ? [...options.excludeUserIds] : undefined);

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

    // Use sendMessage function for actual broadcasting
    const result = await sendMessage(userIds, message, options);

    if (result.isErr()) {
      return err(result.error);
    }

    return ok(result.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to fetch users for broadcast", { error: errorMessage });

    return err({
      type: "bot_error",
      message: `Failed to fetch users: ${errorMessage}`,
    });
  }
};
