import { HumanMessage } from "@langchain/core/messages";
import { logger } from "../../../utils/logger";
import { kimiK2 } from "../../model";
import type { graphState } from "../graph-state";

// Simplified generalist node for faster processing

export const generalistNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  const { messages } = state;

  // Use simpler approach without React agent for faster response
  try {
    const result = await kimiK2.invoke(messages);

    return {
      messages: [...messages, result],
    };
  } catch (error) {
    logger.error("Error in generalist node", { error });
    // Return simple fallback response
    const fallbackResponse = new HumanMessage(
      "Sorry, I'm having trouble processing your request right now. Please try again!",
    );
    return {
      messages: [...messages, fallbackResponse],
    };
  }
};
