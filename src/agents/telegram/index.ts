import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import { desc, eq } from "drizzle-orm";
import { err, ok, type Result } from "neverthrow";
import { createErrorMessage, TELEGRAM_CONFIG } from "../../constants/telegram";
import { getDB, messages, users } from "../../db";
import type { TelegramAgentError, TelegramMessageInput, TelegramMessageResult } from "../../types/telegram";
import { logger } from "../../utils/logger";
import { initTelegramGraph } from "./graph";
import type { graphState } from "./graph-state";

// Check if running in test environment
const isTestEnvironment = (): boolean => {
  return process.env.NODE_ENV === "test" || process.env.OPENAI_API_KEY === "test-key";
};

// Mock response for test environment
const createTestResponse = (userId: string, userMessage: string): TelegramMessageResult => {
  const response = `Test response for message: ${userMessage}`;
  const threadId = `${TELEGRAM_CONFIG.THREAD_ID_PREFIX}${userId}`;

  return {
    response,
    metadata: {
      userId,
      threadId,
      messageLength: userMessage.length,
      responseLength: response.length,
    },
  };
};

// Validate input parameters
const validateMessageInput = (input: TelegramMessageInput): Result<TelegramMessageInput, TelegramAgentError> => {
  if (!input.userId?.trim()) {
    return err({
      type: "VALIDATION_ERROR",
      message: "User ID is required",
    });
  }

  if (!input.userMessage?.trim()) {
    return err({
      type: "VALIDATION_ERROR",
      message: "User message is required",
    });
  }

  return ok(input);
};

// Extract response from graph result
const extractGraphResponse = (
  result: unknown,
  userId: string,
  userName?: string,
): Result<string, TelegramAgentError> => {
  const messages = (result as { messages?: BaseMessage[] })?.messages;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    logger.warn("No messages in graph result", { userId });
    return err({
      type: "NO_CONTENT_ERROR",
      message: createErrorMessage(userName, "NO_CONTENT"),
      userId,
    });
  }

  // Get the last AI message
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage?.content) {
    logger.warn("No content in last message", { userId, messageCount: messages.length });
    return err({
      type: "NO_CONTENT_ERROR",
      message: createErrorMessage(userName, "NO_CONTENT"),
      userId,
    });
  }

  const response = typeof lastMessage.content === "string" ? lastMessage.content : lastMessage.content.toString();

  return ok(response);
};

/**
 * Handle Telegram user message using LangGraph
 * Integrates with the existing graph.ts architecture
 */
export const handleTelegramMessage = async (
  input: TelegramMessageInput,
): Promise<Result<TelegramMessageResult, TelegramAgentError>> => {
  // Validate input
  const validatedInput = validateMessageInput(input);
  if (validatedInput.isErr()) {
    return err(validatedInput.error);
  }

  const { userId, userMessage, userName } = validatedInput.value;

  // Handle test environment
  if (isTestEnvironment()) {
    logger.info("Test environment detected, returning mock response", { userId });
    return ok(createTestResponse(userId, userMessage));
  }

  try {
    // Initialize graph for this user
    const { graph, config } = await initTelegramGraph(userId);

    logger.info("Initialized Telegram graph", {
      userId,
      messageLength: userMessage.length,
    });

    // Fetch user data from database
    let user = null;
    try {
      const db = getDB();
      user = await db.query.users.findFirst({
        where: eq(users.userId, userId),
        with: {
          messages: {
            orderBy: desc(messages.timestamp),
            limit: 10,
          },
        },
      });
      logger.info("User profile loaded", { userId, hasProfile: !!user });
    } catch (dbError) {
      logger.warn("Failed to load user profile, continuing without it", {
        userId,
        error: dbError instanceof Error ? dbError.message : dbError,
      });
    }

    // Create initial state with user message
    const initialState: typeof graphState.State = {
      messages: [
        ...(user?.messages.map((m) => new HumanMessage(m.content)) ?? []),
        new HumanMessage(userMessage),
      ],
      user: user || null, // Match graph state definition
    };

    // Invoke the graph with timeout (10 seconds max for faster response)
    const GRAPH_TIMEOUT_MS = 10 * 1000; // 10 seconds
    const result = (await Promise.race([
      graph.invoke(initialState, config),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Graph execution timed out after ${GRAPH_TIMEOUT_MS}ms`)), GRAPH_TIMEOUT_MS),
      ),
    ])) as { messages?: BaseMessage[] };

    logger.info("Graph execution completed", {
      userId,
      resultType: typeof result,
      hasMessages: !!result?.messages,
    });

    // Extract response
    const responseResult = extractGraphResponse(result, userId, userName);
    if (responseResult.isErr()) {
      return err(responseResult.error);
    }

    const response = responseResult.value;
    const threadId = `${TELEGRAM_CONFIG.THREAD_ID_PREFIX}${userId}`;

    const metadata = {
      userId,
      threadId,
      messageLength: userMessage.length,
      responseLength: response.length,
    };

    logger.info("Telegram message processed successfully", metadata);

    return ok({
      response,
      metadata,
    });
  } catch (error) {
    // Handle timeout errors specifically
    if (error instanceof Error && error.message.includes("timed out")) {
      logger.error("Graph execution timeout", {
        error: error.message,
        userId,
        messageLength: userMessage.length,
      });
      return err({
        type: "CONVERSATION_ERROR",
        message: createErrorMessage(userName, "PROCESSING_ERROR"),
        userId,
        originalError: error,
      });
    }

    logger.error("Error processing Telegram message with graph", { error, userId });
    return err({
      type: "CONVERSATION_ERROR",
      message: createErrorMessage(userName, "TECHNICAL_ERROR"),
      userId,
      originalError: error,
    });
  }
};
