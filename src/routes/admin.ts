import { Hono } from "hono";
import { adminAuth } from "../utils/auth";
import { sendAdminMessage, sendBroadcastMessage } from "../lib/telegram/bot";
import { logger } from "../utils/logger";
import type { AdminSendMessageRequest, AdminBroadcastRequest } from "../types";
import { cleanupAllTokensOHLCVByCount, cleanupOldOHLCVData } from "../utils/db";
import { OHLCV_RETENTION } from "../constants/database";

const route = new Hono();

// Apply admin authentication middleware to all routes
route.use("*", adminAuth);

/**
 * Send message to specific user
 * POST /admin/send-message
 */
route.post("/send-message", async (c) => {
  try {
    // Parse request body (support both JSON and form data)
    const contentType = c.req.header("content-type") || "";
    let body: AdminSendMessageRequest;

    try {
      if (contentType.includes("application/json")) {
        // Parse JSON
        body = (await c.req.json()) as AdminSendMessageRequest;
      } else if (
        contentType.includes("multipart/form-data") ||
        contentType.includes("application/x-www-form-urlencoded")
      ) {
        // Parse form data
        const formData = await c.req.parseBody();
        body = {
          userId: formData.userId as string,
          message: formData.message as string,
          parseMode: formData.parseMode as "HTML" | "Markdown" | "MarkdownV2" | undefined,
        };
      } else {
        logger.warn("Unsupported Content-Type header", {
          contentType,
        });
        return c.json(
          {
            success: false,
            error: "Unsupported Content-Type",
            details: "Please use 'application/json', 'multipart/form-data', or 'application/x-www-form-urlencoded'",
          },
          400,
        );
      }
    } catch (parseError) {
      logger.warn("Failed to parse request body", {
        error: parseError instanceof Error ? parseError.message : "Unknown parse error",
        contentType,
      });
      return c.json(
        {
          success: false,
          error: "Failed to parse request body",
          details: "Please ensure the request body is properly formatted",
        },
        400,
      );
    }

    // Validate body is an object
    if (!body || typeof body !== "object") {
      logger.warn("Request body is not an object", {
        bodyType: typeof body,
      });
      return c.json(
        {
          success: false,
          error: "Request body must be an object",
        },
        400,
      );
    }

    // Early return for missing userId
    if (!body.userId) {
      logger.warn("Missing userId", { body });
      return c.json(
        {
          error: "Missing required fields",
          required: ["userId", "message"],
        },
        400,
      );
    }

    // Validate message
    const messageValidation = validateMessage(body.message);
    if (!messageValidation.valid) {
      logger.warn("Message validation failed", {
        error: messageValidation.error,
        details: messageValidation.details,
      });
      return c.json(
        {
          error: messageValidation.error,
          ...messageValidation.details,
        },
        400,
      );
    }

    // Validate parseMode
    const parseModeValidation = validateParseMode(body.parseMode);
    if (!parseModeValidation.valid) {
      logger.warn("ParseMode validation failed", {
        parseMode: body.parseMode,
      });
      return c.json(
        {
          error: parseModeValidation.error,
          ...parseModeValidation.details,
        },
        400,
      );
    }

    logger.info("Attempting to send message", {
      userId: body.userId,
      messageLength: body.message.length,
      parseMode: body.parseMode,
    });

    // Send message via Telegram
    const result = await sendAdminMessage(body);

    if (!result.success) {
      logger.error("Failed to send message", {
        userId: body.userId,
        error: result.error,
      });
      return c.json(result, 500);
    }

    logger.info("Message sent successfully", {
      userId: body.userId,
      messageId: result.messageId,
    });

    return c.json(result, 200);
  } catch (error) {
    logger.error("Unexpected error occurred", error);
    return c.json(
      {
        success: false,
        error: "Internal server error",
      },
      500,
    );
  }
});

/**
 * Broadcast message to all users
 * POST /admin/broadcast
 */
route.post("/broadcast", async (c) => {
  try {
    // Parse request body (support both JSON and form data)
    const contentType = c.req.header("content-type") || "";
    let body: AdminBroadcastRequest;

    try {
      if (contentType.includes("application/json")) {
        // Parse JSON
        body = (await c.req.json()) as AdminBroadcastRequest;
      } else if (
        contentType.includes("multipart/form-data") ||
        contentType.includes("application/x-www-form-urlencoded")
      ) {
        // Parse form data
        const formData = await c.req.parseBody();
        body = {
          message: formData.message as string,
          parseMode: formData.parseMode as "HTML" | "Markdown" | "MarkdownV2" | undefined,
          excludeUserIds: formData.excludeUserIds
            ? (formData.excludeUserIds as string)
                .split(",")
                .map((id) => id.trim())
                .filter((id) => id)
            : undefined,
        };
      } else {
        logger.warn("admin/broadcast", "Unsupported Content-Type header", {
          contentType,
        });
        return c.json(
          {
            success: false,
            error: "Unsupported Content-Type",
            details: "Please use 'application/json', 'multipart/form-data', or 'application/x-www-form-urlencoded'",
          },
          400,
        );
      }
    } catch (parseError) {
      logger.warn("admin/broadcast", "Failed to parse request body", {
        error: parseError instanceof Error ? parseError.message : "Unknown parse error",
        contentType,
      });
      return c.json(
        {
          success: false,
          error: "Failed to parse request body",
          details: "Please ensure the request body is properly formatted",
        },
        400,
      );
    }

    // Validate body is an object
    if (!body || typeof body !== "object") {
      logger.warn("admin/broadcast", "Request body is not an object", {
        bodyType: typeof body,
      });
      return c.json(
        {
          success: false,
          error: "Request body must be an object",
        },
        400,
      );
    }

    // Validate message
    const messageValidation = validateMessage(body.message);
    if (!messageValidation.valid) {
      logger.warn("admin/broadcast", "Message validation failed", {
        error: messageValidation.error,
        details: messageValidation.details,
      });
      return c.json(
        {
          error: messageValidation.error,
          ...messageValidation.details,
        },
        400,
      );
    }

    // Validate parseMode
    const parseModeValidation = validateParseMode(body.parseMode);
    if (!parseModeValidation.valid) {
      logger.warn("admin/broadcast", "ParseMode validation failed", {
        parseMode: body.parseMode,
      });
      return c.json(
        {
          error: parseModeValidation.error,
          ...parseModeValidation.details,
        },
        400,
      );
    }

    // Validate excludeUserIds
    const excludeValidation = validateExcludeUserIds(body.excludeUserIds);
    if (!excludeValidation.valid) {
      logger.warn("admin/broadcast", "ExcludeUserIds validation failed", {
        excludeUserIds: body.excludeUserIds,
      });
      return c.json({ error: excludeValidation.error }, 400);
    }

    logger.info("admin/broadcast", "Attempting to broadcast message", {
      messageLength: body.message.length,
      parseMode: body.parseMode,
      excludeCount: body.excludeUserIds?.length ?? 0,
    });

    // Send broadcast message
    const result = await sendBroadcastMessage(body);

    if (!result.success) {
      logger.error("admin/broadcast", "Broadcast failed", {
        errors: result.results,
      });
      return c.json(result, 500);
    }

    logger.info("admin/broadcast", "Broadcast completed", {
      totalUsers: result.totalUsers,
    });

    return c.json(result, 200);
  } catch (error) {
    logger.error("admin/broadcast", "Unexpected error occurred", error);
    return c.json(
      {
        success: false,
        error: "Internal server error",
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
      },
      500,
    );
  }
});

// POST /admin/cleanup-ohlcv - OHLCVデータの手動クリーンアップ
route.post("/cleanup-ohlcv", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { method = "count", retentionDays, keepCount } = body;

    logger.info("admin-cleanup-ohlcv", "Starting manual OHLCV cleanup", {
      method,
      retentionDays,
      keepCount,
      adminRequest: true,
    });

    if (method === "count") {
      // 件数ベースのクリーンアップ
      const finalKeepCount = keepCount || OHLCV_RETENTION.MAX_RECORDS_PER_TOKEN;
      await cleanupAllTokensOHLCVByCount(finalKeepCount);

      return c.json({
        success: true,
        message: `Successfully cleaned up OHLCV data, keeping ${finalKeepCount} records per token`,
        method: "count",
        keepCount: finalKeepCount,
      });
    } else if (method === "days") {
      // 日数ベースのクリーンアップ
      const finalRetentionDays = retentionDays || 30;
      await cleanupOldOHLCVData(finalRetentionDays);

      return c.json({
        success: true,
        message: `Successfully cleaned up OHLCV data older than ${finalRetentionDays} days`,
        method: "days",
        retentionDays: finalRetentionDays,
      });
    } else {
      return c.json(
        {
          success: false,
          error: "Invalid cleanup method. Use 'count' or 'days'",
        },
        400,
      );
    }
  } catch (error) {
    logger.error("admin-cleanup-ohlcv", "Failed to cleanup OHLCV data", error);
    return c.json(
      {
        success: false,
        error: "Failed to cleanup OHLCV data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * Validation utilities
 */
const validateMessage = (message: string) => {
  if (!message) {
    return { valid: false, error: "Message is required" };
  }

  if (message.length > 4096) {
    return {
      valid: false,
      error: "Message too long",
      details: { maxLength: 4096, currentLength: message.length },
    };
  }

  return { valid: true };
};

const validateParseMode = (parseMode?: string) => {
  if (!parseMode) return { valid: true };

  const validParseModes = ["HTML", "Markdown", "MarkdownV2"];
  if (!validParseModes.includes(parseMode)) {
    return {
      valid: false,
      error: "Invalid parse mode",
      details: { validModes: validParseModes },
    };
  }

  return { valid: true };
};

const validateExcludeUserIds = (excludeUserIds?: unknown) => {
  if (!excludeUserIds) return { valid: true };

  if (!Array.isArray(excludeUserIds)) {
    return {
      valid: false,
      error: "excludeUserIds must be an array of strings",
    };
  }

  return { valid: true };
};

export default route;
