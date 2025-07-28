import type { BaseMessage } from "@langchain/core/messages";

// Type definitions for Telegram agent

export interface TelegramMessageInput {
  userId: string;
  userMessage: string;
  userName?: string;
}

export interface TelegramMessageResult {
  response: string;
  metadata: {
    userId: string;
    threadId: string;
    messageLength: number;
    responseLength: number;
  };
}

export interface TelegramAgentError {
  type: "CONVERSATION_ERROR" | "NO_CONTENT_ERROR" | "VALIDATION_ERROR";
  message: string;
  userId?: string;
  originalError?: unknown;
}

// Helper type for conversation state
export type ConversationState = {
  messages: BaseMessage[];
};
