import type { Bot, Context } from "grammy";
import { handleTelegramMessage } from "../../agents/telegram";
import { TELEGRAM_CONFIG } from "../../constants/telegram";
import { createMessage, upsertUser } from "../../utils/db";
import { generateId } from "../../utils/id";
import { logger } from "../../utils/logger";

// Extract user profile data from Telegram context
const extractUserProfile = (ctx: Context) => ({
  userId: ctx.from?.id.toString(),
  username: ctx.from?.username,
  firstName: ctx.from?.first_name,
  lastName: ctx.from?.last_name,
  languageCode: ctx.from?.language_code,
});

// Handle text message processing with LangGraph
const handleTextMessage = async (ctx: Context) => {
  const { userId, username, firstName, lastName, languageCode } = extractUserProfile(ctx);
  const messageText = ctx.message?.text;

  if (!userId || !messageText) {
    logger.warn("Missing required data for message processing", { userId, hasText: !!messageText });
    return;
  }

  try {
    // Upsert user profile
    await upsertUser({
      userId,
      firstName,
      lastName,
      username,
      languageCode,
    });

    // Save user message to database
    await createMessage({
      messageId: generateId(),
      userId,
      content: messageText,
      messageType: "human",
    });

    // Process message with LangGraph agent
    const result = await handleTelegramMessage({
      userId,
      userMessage: messageText,
      userName: firstName || username,
    });

    let response: string;

    if (result.isOk()) {
      response = result.value.response;
      logger.info("Message processed successfully with LangGraph", result.value.metadata);
    } else {
      response = result.error.message;
      logger.error("LangGraph agent error", {
        error: result.error,
        userId,
        messageLength: messageText.length,
      });
    }

    // Save AI response to database
    await createMessage({
      messageId: generateId(),
      userId,
      content: response,
      messageType: "ai",
    });

    await ctx.reply(response, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    logger.error("Error in text message handler", { error, userId });
    await ctx.reply(TELEGRAM_CONFIG.DEFAULT_RESPONSES.PROCESSING_ERROR);
  }
};

// Handle non-text messages with appropriate responses
const handleNonTextMessage = async (ctx: Context) => {
  const { userId, firstName, lastName, username, languageCode } = extractUserProfile(ctx);

  if (!userId) return;

  // Upsert user profile for any interaction
  await upsertUser({
    userId,
    firstName,
    lastName,
    username,
    languageCode,
  });

  if (ctx.message?.photo) {
    await ctx.reply("Nice photo! 📸 I can see you sent an image, but I only process text messages for now.");
  } else if (ctx.message?.voice) {
    await ctx.reply("I received your voice message! 🎤 However, I only process text messages at the moment.");
  } else if (ctx.message?.document) {
    await ctx.reply("Thanks for the document! 📄 I only handle text messages currently.");
  } else {
    await ctx.reply(
      "I received your message, but I only process text messages for now. Please send me a text message!",
    );
  }
};

export const setupHandler = (bot: Bot) => {
  // Handle text messages with LangGraph
  bot.on("message:text", handleTextMessage);

  // Handle other message types
  bot.on("message", handleNonTextMessage);
};
