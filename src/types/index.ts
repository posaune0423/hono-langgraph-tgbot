/** Enum defining available log levels */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

/** Interface for custom log writers */
export interface LogWriter {
  init(logPath: string): void;
  write(data: string): void;
}

/** Configuration options for logging */
export interface LoggerConfig {
  level?: LogLevel;
  enableTimestamp?: boolean;
  enableColors?: boolean;
  logToFile?: boolean;
  logPath?: string;
  logWriter?: LogWriter;
}

/** Structure of a log entry */
export interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  context: string;
  message: string;
  // biome-ignore lint/suspicious/noExplicitAny: data could be anything
  data?: any;
}

// Admin message sending types
export interface AdminSendMessageRequest {
  userId: string;
  message: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
}

export interface AdminSendMessageResponse {
  success: boolean;
  messageId?: number;
  error?: string;
}

// Broadcast message types
export interface AdminBroadcastRequest {
  message: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  excludeUserIds?: string[]; // Optional: exclude specific users
}

// Broadcast result type with detailed results
export interface BroadcastResult {
  totalUsers: number;
  successCount: number;
  failureCount: number;
  failedUsers: string[];
  results: Array<{
    userId: string;
    success: boolean;
    messageId?: number;
    error?: string;
  }>;
}

export interface AdminBroadcastResponse {
  success: boolean;
  totalUsers: number;
  results: Array<{
    userId: string;
    success: boolean;
    messageId?: number;
    error?: string;
  }>;
  error?: string;
}

// Telegram error types for neverthrow
export type TelegramError = {
  type: "forbidden" | "rate_limit" | "invalid_user" | "network" | "bot_error" | "unknown";
  message: string;
  userId?: string;
};

export type DatabaseError = {
  type: "connection" | "query" | "not_found";
  message: string;
};

export type BroadcastError = {
  type: "database" | "empty_users" | "partial_failure";
  message: string;
  details?: string[];
};

// Success types for neverthrow
export type MessageSentResult = {
  userId: string;
  messageId: number;
};

export type UserListResult = {
  userIds: string[];
  totalCount: number;
  excludedCount: number;
};
