import { type BaseMessage, HumanMessage } from "@langchain/core/messages";
import { err, ok, type Result } from "neverthrow";
import { createErrorMessage, TELEGRAM_CONFIG } from "../../constants/telegram";
import type { TelegramAgentError, TelegramMessageInput, TelegramMessageResult } from "../../types/telegram";
import { logger } from "../../utils/logger";
import { initTelegramGraph } from "./graph";

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

    // Create initial state with user message
    const initialState = {
      messages: [new HumanMessage(userMessage)],
      userProfile: null, // Will be loaded by data-fetch node
    };

    // Invoke the graph with timeout (20 seconds max)
    const GRAPH_TIMEOUT_MS = 20 * 1000; // 20 seconds
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
