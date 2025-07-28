import { Hono } from "hono";
import { err, ok, type Result } from "neverthrow";
import { sendAdminMessage, sendBroadcastMessage } from "../lib/telegram/bot";
import type { AdminBroadcastRequest, AdminSendMessageRequest } from "../types";
import { adminAuth } from "../utils/auth";
import { logger } from "../utils/logger";

const route = new Hono();

/**
 * Validation error types for better error categorization
 */
type ValidationError =
  | { type: "missing_field"; field: string }
  | { type: "invalid_format"; field: string; reason: string }
  | { type: "value_too_large"; field: string; maxValue: number; currentValue: number }
  | { type: "invalid_enum"; field: string; allowedValues: readonly string[] };

/**
 * Standard API response structure
 */
interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly details?: unknown;
}

/**
 * Content type configuration
 */
const SUPPORTED_CONTENT_TYPES = [
  "application/json",
  "multipart/form-data",
  "application/x-www-form-urlencoded",
] as const;

const MAX_MESSAGE_LENGTH = 4096;
const VALID_PARSE_MODES = ["HTML", "Markdown", "MarkdownV2"] as const;

// Apply admin authentication middleware to all routes
route.use("*", adminAuth);

/**
 * Create validation error with proper typing
 */
// biome-ignore lint/suspicious/noExplicitAny: details object structure varies by validation type
const createValidationError = (type: ValidationError["type"], details: Record<string, any>): ValidationError => {
  switch (type) {
    case "missing_field":
      return { type, field: details.field };
    case "invalid_format":
      return { type, field: details.field, reason: details.reason };
    case "value_too_large":
      return { type, field: details.field, maxValue: details.maxValue, currentValue: details.currentValue };
    case "invalid_enum":
      return { type, field: details.field, allowedValues: details.allowedValues };
    default:
      return { type: "invalid_format", field: "unknown", reason: "Unknown validation error" };
  }
};

/**
 * Validate message content
 */
const validateMessage = (message: unknown): Result<string, ValidationError> => {
  if (!message) {
    return err(createValidationError("missing_field", { field: "message" }));
  }

  if (typeof message !== "string") {
    return err(
      createValidationError("invalid_format", {
        field: "message",
        reason: "Must be a string",
      }),
    );
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return err(
      createValidationError("invalid_format", {
        field: "message",
        reason: "Cannot be empty",
      }),
    );
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return err(
      createValidationError("value_too_large", {
        field: "message",
        maxValue: MAX_MESSAGE_LENGTH,
        currentValue: trimmedMessage.length,
      }),
    );
  }

  return ok(trimmedMessage);
};

/**
 * Validate parse mode
 */
const validateParseMode = (
  parseMode: unknown,
): Result<(typeof VALID_PARSE_MODES)[number] | undefined, ValidationError> => {
  if (!parseMode) {
    return ok(undefined);
  }

  if (typeof parseMode !== "string") {
    return err(
      createValidationError("invalid_format", {
        field: "parseMode",
        reason: "Must be a string",
      }),
    );
  }

  if (!VALID_PARSE_MODES.includes(parseMode as (typeof VALID_PARSE_MODES)[number])) {
    return err(
      createValidationError("invalid_enum", {
        field: "parseMode",
        allowedValues: VALID_PARSE_MODES,
      }),
    );
  }

  return ok(parseMode as (typeof VALID_PARSE_MODES)[number]);
};

/**
 * Validate user ID format
 */
const validateUserId = (userId: unknown): Result<string, ValidationError> => {
  if (!userId) {
    return err(createValidationError("missing_field", { field: "userId" }));
  }

  if (typeof userId !== "string") {
    return err(
      createValidationError("invalid_format", {
        field: "userId",
        reason: "Must be a string",
      }),
    );
  }

  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    return err(
      createValidationError("invalid_format", {
        field: "userId",
        reason: "Cannot be empty",
      }),
    );
  }

  // Basic validation for Telegram user ID format
  if (!/^\d+$/.test(trimmedUserId)) {
    return err(
      createValidationError("invalid_format", {
        field: "userId",
        reason: "Must be a valid Telegram user ID (numeric)",
      }),
    );
  }

  return ok(trimmedUserId);
};

/**
 * Validate exclude user IDs array
 */
const validateExcludeUserIds = (excludeUserIds: unknown): Result<string[] | undefined, ValidationError> => {
  if (!excludeUserIds) {
    return ok(undefined);
  }

  if (!Array.isArray(excludeUserIds)) {
    return err(
      createValidationError("invalid_format", {
        field: "excludeUserIds",
        reason: "Must be an array",
      }),
    );
  }

  const validUserIds: string[] = [];
  for (const [index, userId] of excludeUserIds.entries()) {
    if (typeof userId !== "string") {
      return err(
        createValidationError("invalid_format", {
          field: `excludeUserIds[${index}]`,
          reason: "All user IDs must be strings",
        }),
      );
    }

    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      return err(
        createValidationError("invalid_format", {
          field: `excludeUserIds[${index}]`,
          reason: "User ID cannot be empty",
        }),
      );
    }

    if (!/^\d+$/.test(trimmedUserId)) {
      return err(
        createValidationError("invalid_format", {
          field: `excludeUserIds[${index}]`,
          reason: "Must be a valid Telegram user ID (numeric)",
        }),
      );
    }

    validUserIds.push(trimmedUserId);
  }

  return ok(validUserIds);
};

/**
 * Parse request body with comprehensive error handling
 */
// biome-ignore lint/suspicious/noExplicitAny: Hono context type is complex and varies by usage
const parseRequestBody = async (c: any): Promise<Result<any, ApiResponse>> => {
  const contentType = c.req.header("content-type") || "";

  // Check if content type is supported
  const isSupportedContentType = SUPPORTED_CONTENT_TYPES.some((type) => contentType.includes(type));
  if (!isSupportedContentType) {
    logger.warn("Unsupported Content-Type", { contentType });
    return err({
      success: false,
      error: "Unsupported Content-Type",
      details: {
        provided: contentType,
        supported: SUPPORTED_CONTENT_TYPES,
      },
    });
  }

  try {
    if (contentType.includes("application/json")) {
      return ok(await c.req.json());
    } else if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await c.req.parseBody();

      // Convert form data to a proper object structure
      // biome-ignore lint/suspicious/noExplicitAny: form data can contain mixed types
      const body: any = {};
      for (const [key, value] of Object.entries(formData)) {
        if (key === "excludeUserIds" && typeof value === "string") {
          // Parse comma-separated user IDs
          body[key] = value
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id);
        } else {
          body[key] = value;
        }
      }

      return ok(body);
    }
  } catch (parseError) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parse error";
    logger.warn("Failed to parse request body", { error: errorMessage, contentType });

    return err({
      success: false,
      error: "Failed to parse request body",
      details: {
        reason: errorMessage,
        contentType,
      },
    });
  }

  return err({
    success: false,
    error: "Unsupported request format",
  });
};

/**
 * Format validation error for API response
 */
const formatValidationError = (validationError: ValidationError): ApiResponse => {
  switch (validationError.type) {
    case "missing_field":
      return {
        success: false,
        error: `Missing required field: ${validationError.field}`,
        details: { field: validationError.field, type: "missing" },
      };
    case "invalid_format":
      return {
        success: false,
        error: `Invalid format for field '${validationError.field}': ${validationError.reason}`,
        details: { field: validationError.field, type: "invalid_format", reason: validationError.reason },
      };
    case "value_too_large":
      return {
        success: false,
        error: `Value too large for field '${validationError.field}': ${validationError.currentValue} (max: ${validationError.maxValue})`,
        details: {
          field: validationError.field,
          type: "value_too_large",
          maxValue: validationError.maxValue,
          currentValue: validationError.currentValue,
        },
      };
    case "invalid_enum":
      return {
        success: false,
        error: `Invalid value for field '${validationError.field}'. Allowed values: ${validationError.allowedValues.join(", ")}`,
        details: {
          field: validationError.field,
          type: "invalid_enum",
          allowedValues: validationError.allowedValues,
        },
      };
    default:
      return {
        success: false,
        error: "Validation failed",
        details: { type: "unknown" },
      };
  }
};

/**
 * Send message to specific user
 * POST /admin/send-message
 */
route.post("/send-message", async (c) => {
  try {
    // Parse request body
    const bodyResult = await parseRequestBody(c);
    if (bodyResult.isErr()) {
      return c.json(bodyResult.error, 400);
    }

    const body = bodyResult.value;

    // Validate required fields
    const userIdResult = validateUserId(body.userId);
    if (userIdResult.isErr()) {
      return c.json(formatValidationError(userIdResult.error), 400);
    }

    const messageResult = validateMessage(body.message);
    if (messageResult.isErr()) {
      return c.json(formatValidationError(messageResult.error), 400);
    }

    const parseModeResult = validateParseMode(body.parseMode);
    if (parseModeResult.isErr()) {
      return c.json(formatValidationError(parseModeResult.error), 400);
    }

    // Create validated request object
    const validatedRequest: AdminSendMessageRequest = {
      userId: userIdResult.value,
      message: messageResult.value,
      parseMode: parseModeResult.value,
    };

    logger.info("Processing admin send message request", {
      userId: validatedRequest.userId,
      messageLength: validatedRequest.message.length,
      parseMode: validatedRequest.parseMode,
    });

    // Send message via Telegram
    const result = await sendAdminMessage(validatedRequest);

    if (!result.success) {
      logger.error("Admin message send failed", {
        userId: validatedRequest.userId,
        error: result.error,
      });

      return c.json(
        {
          success: false,
          error: "Failed to send message",
          details: { reason: result.error },
        },
        500,
      );
    }

    logger.info("Admin message sent successfully", {
      userId: validatedRequest.userId,
      messageId: result.messageId,
    });

    return c.json(
      {
        success: true,
        data: {
          messageId: result.messageId,
          userId: validatedRequest.userId,
        },
      },
      200,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Unexpected error in send-message endpoint", { error: errorMessage });

    return c.json(
      {
        success: false,
        error: "Internal server error",
        details: { message: "An unexpected error occurred" },
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
    // Parse request body
    const bodyResult = await parseRequestBody(c);
    if (bodyResult.isErr()) {
      return c.json(bodyResult.error, 400);
    }

    const body = bodyResult.value;

    // Validate required fields
    const messageResult = validateMessage(body.message);
    if (messageResult.isErr()) {
      return c.json(formatValidationError(messageResult.error), 400);
    }

    const parseModeResult = validateParseMode(body.parseMode);
    if (parseModeResult.isErr()) {
      return c.json(formatValidationError(parseModeResult.error), 400);
    }

    const excludeUserIdsResult = validateExcludeUserIds(body.excludeUserIds);
    if (excludeUserIdsResult.isErr()) {
      return c.json(formatValidationError(excludeUserIdsResult.error), 400);
    }

    // Create validated request object
    const validatedRequest: AdminBroadcastRequest = {
      message: messageResult.value,
      parseMode: parseModeResult.value,
      excludeUserIds: excludeUserIdsResult.value,
    };

    logger.info("Processing admin broadcast request", {
      messageLength: validatedRequest.message.length,
      parseMode: validatedRequest.parseMode,
      excludeCount: validatedRequest.excludeUserIds?.length || 0,
    });

    // Send broadcast message
    const result = await sendBroadcastMessage(validatedRequest);

    if (!result.success) {
      logger.error("Admin broadcast failed", {
        error: result.error,
        totalUsers: result.totalUsers,
      });

      return c.json(
        {
          success: false,
          error: "Broadcast failed",
          details: {
            reason: result.error,
            totalUsers: result.totalUsers,
            results: result.results,
          },
        },
        500,
      );
    }

    logger.info("Admin broadcast completed successfully", {
      totalUsers: result.totalUsers,
      successCount: result.results?.filter((r) => r.success)?.length || 0,
    });

    return c.json(
      {
        success: true,
        data: {
          totalUsers: result.totalUsers,
          results: result.results,
        },
      },
      200,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Unexpected error in broadcast endpoint", { error: errorMessage });

    return c.json(
      {
        success: false,
        error: "Internal server error",
        details: { message: "An unexpected error occurred" },
      },
      500,
    );
  }
});

export default route;
