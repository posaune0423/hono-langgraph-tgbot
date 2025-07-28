// Telegram bot configuration constants
export const TELEGRAM_CONFIG = {
  // Model configuration
  MODEL_TEMPERATURE: 0.7,

  // Thread ID prefix for conversation memory
  THREAD_ID_PREFIX: "telegram_user_",

  // Default response messages
  DEFAULT_RESPONSES: {
    NO_CONTENT: "I couldn't generate a response. Please try again! 💭",
    TECHNICAL_ERROR: "Sorry, I'm having technical difficulties. Please try again! 🔧",
    PROCESSING_ERROR: "Sorry, I encountered an error processing your message. Please try again.",
  },

  // LangGraph node names
  NODES: {
    CONVERSATION: "conversation",
  },
} as const;

// Response message templates
export const createGreeting = (userName?: string): string => `Hi ${userName || "there"}! 👋`;

export const createErrorMessage = (
  userName?: string,
  type: keyof typeof TELEGRAM_CONFIG.DEFAULT_RESPONSES = "TECHNICAL_ERROR",
): string => `${createGreeting(userName)} ${TELEGRAM_CONFIG.DEFAULT_RESPONSES[type]}`;
