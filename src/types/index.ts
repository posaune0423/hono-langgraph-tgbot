export type SystemMessage = {
  content: string;
  tool_calls: {
    name: string;
    args: {
      input: string;
    };
    type: string;
    id: string;
  }[];
  usage_metadata?: {
    output_tokens: number;
    input_tokens: number;
    total_tokens: number;
  };
};

export type StreamChunk = {
  generalist: {
    messages: SystemMessage[];
  };
  analyzer: {
    messages: SystemMessage[];
  };
  manager: {
    messages: SystemMessage[];
  };
};

// Setup step definition
export enum SetupStep {
  WALLET_ADDRESS = "wallet_address",
  AGE = "age",
  RISK_TOLERANCE = "risk_tolerance",
  TOTAL_ASSETS = "total_assets",
  CRYPTO_ASSETS = "crypto_assets",
  PANIC_LEVEL = "panic_level",
  COMPLETE = "complete",
}

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

export interface BroadcastResult {
  userId: string;
  success: boolean;
  messageId?: number;
  error?: string;
}

export interface AdminBroadcastResponse {
  success: boolean;
  totalUsers: number;
  results: BroadcastResult[];
}

// neverthrow error types
export type TelegramError = {
  type: "forbidden" | "network" | "invalid_user" | "rate_limit" | "unknown";
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
