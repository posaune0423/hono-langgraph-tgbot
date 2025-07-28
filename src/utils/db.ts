import { and, desc, eq, inArray, not } from "drizzle-orm";
import { err, ok, type Result } from "neverthrow";
import { getDB, messages, users } from "../db";
import type { Message, NewMessage, NewUser, UpdateUser, User } from "../db/schema";
import { logger } from "./logger";

/**
 * Database error types for better error categorization
 */
type DatabaseError =
  | { type: "not_found"; entity: string; id: string }
  | { type: "constraint_violation"; field: string; value: string }
  | { type: "connection_error"; message: string }
  | { type: "unknown"; message: string };

/**
 * Create database error with proper typing
 */
// biome-ignore lint/suspicious/noExplicitAny: error details structure varies by error type
const createDbError = (type: DatabaseError["type"], details: Record<string, any>): DatabaseError => {
  switch (type) {
    case "not_found":
      return { type, entity: details.entity, id: details.id };
    case "constraint_violation":
      return { type, field: details.field, value: details.value };
    case "connection_error":
      return { type, message: details.message };
    default:
      return { type: "unknown", message: details.message || "Unknown database error" };
  }
};

/**
 * Handle database errors with proper categorization and logging
 */
// biome-ignore lint/suspicious/noExplicitAny: context can contain arbitrary debugging information
const handleDbError = (operation: string, error: unknown, context?: Record<string, any>): DatabaseError => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`Database operation failed: ${operation}`, {
    error: errorMessage,
    context,
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Categorize common database errors
  if (errorMessage.includes("unique constraint") || errorMessage.includes("duplicate")) {
    return createDbError("constraint_violation", {
      field: "unknown",
      value: "duplicate",
    });
  }

  if (errorMessage.includes("connection") || errorMessage.includes("timeout")) {
    return createDbError("connection_error", { message: errorMessage });
  }

  return createDbError("unknown", { message: errorMessage });
};

/**
 * Get all active user IDs, optionally excluding specified users
 */
export const getUserIds = async (excludeUserIds?: string[]): Promise<string[]> => {
  try {
    const db = getDB();

    const baseCondition = eq(users.isActive, true);
    const whereCondition =
      excludeUserIds && excludeUserIds.length > 0
        ? and(baseCondition, not(inArray(users.userId, excludeUserIds)))
        : baseCondition;

    const result = await db.select({ userId: users.userId }).from(users).where(whereCondition);

    const userIds = result.map((row) => row.userId);

    logger.debug("Retrieved user IDs", {
      count: userIds.length,
      excludedCount: excludeUserIds?.length || 0,
    });

    return userIds;
  } catch (error) {
    logger.error("Failed to get user IDs", {
      error: error instanceof Error ? error.message : String(error),
      excludeUserIds: excludeUserIds?.length || 0,
    });
    return [];
  }
};

/**
 * Create a new user with proper error handling
 */
export const createUser = async (userData: NewUser): Promise<Result<User, DatabaseError>> => {
  try {
    const db = getDB();
    const [user] = await db.insert(users).values(userData).returning();

    if (!user) {
      const error = createDbError("unknown", { message: "Failed to create user - no data returned" });
      return err(error);
    }

    logger.info("User created successfully", {
      userId: user.userId,
      username: user.username,
    });

    return ok(user);
  } catch (error) {
    const dbError = handleDbError("createUser", error, { userId: userData.userId });
    return err(dbError);
  }
};

/**
 * Get user by ID with enhanced error handling
 */
export const getUser = async (userId: string): Promise<Result<User | null, DatabaseError>> => {
  if (!userId?.trim()) {
    const error = createDbError("constraint_violation", {
      field: "userId",
      value: "empty_or_null",
    });
    return err(error);
  }

  try {
    const db = getDB();
    const user = await db.query.users.findFirst({
      where: eq(users.userId, userId),
    });

    logger.debug("User lookup completed", {
      userId,
      found: !!user,
    });

    return ok(user ?? null);
  } catch (error) {
    const dbError = handleDbError("getUser", error, { userId });
    return err(dbError);
  }
};

/**
 * Update user information with enhanced validation
 */
export const updateUser = async (userId: string, updateData: UpdateUser): Promise<Result<User, DatabaseError>> => {
  if (!userId?.trim()) {
    const error = createDbError("constraint_violation", {
      field: "userId",
      value: "empty_or_null",
    });
    return err(error);
  }

  try {
    const db = getDB();
    const [user] = await db
      .update(users)
      .set({
        ...updateData,
        lastActiveAt: Date.now(),
      })
      .where(eq(users.userId, userId))
      .returning();

    if (!user) {
      const error = createDbError("not_found", {
        entity: "user",
        id: userId,
      });
      return err(error);
    }

    logger.info("User updated successfully", {
      userId,
      updatedFields: Object.keys(updateData),
    });

    return ok(user);
  } catch (error) {
    const dbError = handleDbError("updateUser", error, { userId, updateData });
    return err(dbError);
  }
};

/**
 * Upsert user (create or update) with conflict resolution
 */
export const upsertUser = async (userData: NewUser): Promise<Result<User, DatabaseError>> => {
  if (!userData.userId?.trim()) {
    const error = createDbError("constraint_violation", {
      field: "userId",
      value: "empty_or_null",
    });
    return err(error);
  }

  try {
    const db = getDB();
    const currentTimestamp = Math.floor(Date.now() / 1000); // Convert to seconds for SQLite

    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        lastActiveAt: currentTimestamp,
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
          languageCode: userData.languageCode,
          lastActiveAt: currentTimestamp,
        },
      })
      .returning();

    if (!user) {
      const error = createDbError("unknown", {
        message: "Failed to upsert user - no data returned",
      });
      return err(error);
    }

    logger.info("User upserted successfully", {
      userId: user.userId,
      isNewUser: !userData.username, // Heuristic for detecting new vs updated
    });

    return ok(user);
  } catch (error) {
    const dbError = handleDbError("upsertUser", error, { userId: userData.userId });
    return err(dbError);
  }
};

/**
 * Create a new message with validation
 */
export const createMessage = async (messageData: NewMessage): Promise<Result<Message, DatabaseError>> => {
  if (!messageData.userId?.trim() || !messageData.content?.trim()) {
    const error = createDbError("constraint_violation", {
      field: messageData.userId ? "content" : "userId",
      value: "empty_or_null",
    });
    return err(error);
  }

  try {
    const db = getDB();
    const [message] = await db.insert(messages).values(messageData).returning();

    if (!message) {
      const error = createDbError("unknown", {
        message: "Failed to create message - no data returned",
      });
      return err(error);
    }

    logger.info("Message created successfully", {
      messageId: message.messageId,
      userId: message.userId,
      contentLength: message.content.length,
      messageType: message.messageType,
    });

    return ok(message);
  } catch (error) {
    const dbError = handleDbError("createMessage", error, {
      userId: messageData.userId,
      messageType: messageData.messageType,
    });
    return err(dbError);
  }
};

/**
 * Get messages for a user with pagination
 */
export const getUserMessages = async (
  userId: string,
  limit: number = 50,
): Promise<Result<Message[], DatabaseError>> => {
  if (!userId?.trim()) {
    const error = createDbError("constraint_violation", {
      field: "userId",
      value: "empty_or_null",
    });
    return err(error);
  }

  if (limit <= 0 || limit > 1000) {
    const error = createDbError("constraint_violation", {
      field: "limit",
      value: String(limit),
    });
    return err(error);
  }

  try {
    const db = getDB();
    const userMessages = await db.query.messages.findMany({
      where: eq(messages.userId, userId),
      orderBy: desc(messages.timestamp),
      limit,
    });

    logger.debug("Retrieved user messages", {
      userId,
      messageCount: userMessages.length,
      limit,
    });

    return ok(userMessages);
  } catch (error) {
    const dbError = handleDbError("getUserMessages", error, { userId, limit });
    return err(dbError);
  }
};

/**
 * Get recent messages across all users
 */
export const getRecentMessages = async (limit: number = 100): Promise<Result<Message[], DatabaseError>> => {
  if (limit <= 0 || limit > 1000) {
    const error = createDbError("constraint_violation", {
      field: "limit",
      value: String(limit),
    });
    return err(error);
  }

  try {
    const db = getDB();
    const recentMessages = await db.query.messages.findMany({
      orderBy: desc(messages.timestamp),
      limit,
    });

    logger.debug("Retrieved recent messages", {
      messageCount: recentMessages.length,
      limit,
    });

    return ok(recentMessages);
  } catch (error) {
    const dbError = handleDbError("getRecentMessages", error, { limit });
    return err(dbError);
  }
};

/**
 * Export database error type for use in other modules
 */
export type { DatabaseError };
