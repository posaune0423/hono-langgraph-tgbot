import type { Bot, Context } from "grammy";
import { createMessage, upsertUser } from "../../utils/db";
import { generateId } from "../../utils/id";
import { logger } from "../../utils/logger";

export const setupHandler = (bot: Bot) => {
  bot.on("message:text", async (ctx: Context) => {
    const userId = ctx.from?.id.toString();
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;
    const languageCode = ctx.from?.language_code;

    if (!userId || !ctx.message?.text) {
      logger.warn("User ID or message text is null");
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
        content: ctx.message.text,
        messageType: "human",
      });

      // Simple echo response with some enhancements
      const userMessage = ctx.message.text.toLowerCase();
      let response: string;

      if (userMessage.includes("hello") || userMessage.includes("hi")) {
        response = `Hello ${firstName || username || "there"}! 👋 How can I help you today?`;
      } else if (userMessage.includes("help")) {
        response = "I'm a simple bot template. You can talk to me and I'll respond! Type /help for commands.";
      } else if (userMessage.includes("time")) {
        response = `The current time is: ${new Date().toLocaleString()}`;
      } else {
        response = `You said: "${ctx.message.text}"\n\nI'm a simple echo bot! Try saying "hello" or "help" for different responses.`;
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

      logger.info("Message processed successfully", { userId, messageLength: ctx.message.text.length });
    } catch (error) {
      logger.error("Error processing message", error);
      await ctx.reply("Sorry, I encountered an error processing your message. Please try again.");
    }
  });

  // Handle other message types
  bot.on("message", async (ctx: Context) => {
    const userId = ctx.from?.id.toString();

    if (!userId) {
      return;
    }

    // Upsert user profile for any interaction
    await upsertUser({
      userId,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      username: ctx.from?.username,
      languageCode: ctx.from?.language_code,
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
  });
};
