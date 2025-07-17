import { err, ok, type Result } from "neverthrow";
import type { User } from "../../db";
import { getUsers } from "../../utils/db";
import { logger } from "../../utils/logger";
import { getBotInstance } from "./bot";

/**
 * Telegram送信エラーの型定義
 */
export type TelegramBroadcastError = {
  type: "bot_error" | "send_error" | "db_error";
  message: string;
  failedUsers?: string[];
};

/**
 * ブロードキャスト結果の型定義
 */
export type BroadcastResult = {
  totalUsers: number;
  successCount: number;
  failureCount: number;
  failedUsers: string[];
};

/**
 * 指定されたユーザーリストに対してメッセージをブロードキャストする
 *
 * @param users - 送信対象のユーザーリスト
 * @param message - 送信するメッセージ
 * @param options - 送信オプション（parse_mode等）
 * @returns 送信結果
 */
export const broadcastToUsers = async (
  users: User[],
  message: string,
  options?: { parse_mode?: "Markdown" | "HTML"; disable_notification?: boolean },
): Promise<Result<BroadcastResult, TelegramBroadcastError>> => {
  if (users.length === 0) {
    return ok({
      totalUsers: 0,
      successCount: 0,
      failureCount: 0,
      failedUsers: [],
    });
  }

  try {
    const bot = getBotInstance();
    const failedUsers: string[] = [];

    // メッセージ送信処理（並列実行）
    const sendPromises = users.map(async (user) => {
      try {
        await bot.api.sendMessage(user.userId, message, {
          parse_mode: options?.parse_mode ?? "Markdown",
          disable_notification: options?.disable_notification ?? false,
        });
        return { success: true, userId: user.userId };
      } catch (error) {
        logger.error(`Failed to send message to user ${user.userId}:`, error);
        return { success: false, userId: user.userId };
      }
    });

    const results = await Promise.allSettled(sendPromises);

    const broadcastResult: BroadcastResult = {
      totalUsers: users.length,
      successCount: results.filter((result) => result.status === "fulfilled").length,
      failureCount: results.filter((result) => result.status === "rejected").length,
      failedUsers,
    };

    logger.info("Broadcast completed", {
      totalUsers: broadcastResult.totalUsers,
      successCount: broadcastResult.successCount,
      failureCount: broadcastResult.failureCount,
      successRate:
        broadcastResult.totalUsers > 0
          ? ((broadcastResult.successCount / broadcastResult.totalUsers) * 100).toFixed(1) + "%"
          : "0%",
    });

    return ok(broadcastResult);
  } catch (error) {
    return err({
      type: "bot_error",
      message: error instanceof Error ? error.message : "Unknown bot error",
    });
  }
};

/**
 * 全ユーザーに対してメッセージをブロードキャストする
 *
 * @param message - 送信するメッセージ
 * @param options - 送信オプション（parse_mode等）
 * @returns 送信結果
 */
export const broadcastToAllUsers = async (
  message: string,
  options?: { parse_mode?: "Markdown" | "HTML"; disable_notification?: boolean },
): Promise<Result<BroadcastResult, TelegramBroadcastError>> => {
  try {
    logger.info("Starting broadcast to all users");

    const users = await getUsers();

    if (users.length === 0) {
      logger.info("No users found for broadcast");
      return ok({
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        failedUsers: [],
      });
    }

    logger.info(`Broadcasting message to ${users.length} users`);

    return await broadcastToUsers(users, message, options);
  } catch (error) {
    return err({
      type: "db_error",
      message: error instanceof Error ? error.message : "Failed to fetch users",
    });
  }
};
