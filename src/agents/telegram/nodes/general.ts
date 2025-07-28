import { AIMessage } from "@langchain/core/messages";
import { logger } from "../../../utils/logger";
import { gpt4oMini } from "../../model";
import type { graphState } from "../graph-state";

// Simplified generalist node for faster processing

export const generalistNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  const { messages } = state;

  // Use gpt4oMini for better reliability and speed
  try {
    logger.info("Processing message with generalist node", {
      messageCount: messages.length,
      lastMessageType: messages[messages.length - 1]?.constructor.name,
    });

    const result = await gpt4oMini.invoke(messages);

    logger.info("Successfully processed message with GPT-4o-mini", {
      responseLength: result.content.toString().length,
    });

    return {
      messages: [...messages, result],
    };
  } catch (error) {
    logger.error("Error in generalist node", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return simple fallback response as AI message
    const fallbackResponse = new AIMessage(
      "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment! 🤖",
    );
    return {
      messages: [...messages, fallbackResponse],
    };
  }
};
