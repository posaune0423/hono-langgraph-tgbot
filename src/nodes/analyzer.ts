import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { gpt4oMini } from "../utils/model";
import { memory, graphState } from "../utils/state";
import type { Tool } from "@langchain/core/tools";
import { analyzerPrompt } from "../prompts/analyzer";
import { logger } from "../utils/logger";

// Initialize tools array
const tools: Tool[] = [];

export const analyzerAgent = createReactAgent({
  llm: gpt4oMini,
  tools,
  checkpointSaver: memory,
  prompt: analyzerPrompt,
  stateSchema: graphState,
});

export const analyzerNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  logger.info("analyzerNode", "analyzerNode", state);
  const { messages, userAssets, userProfile } = state;

  const result = await analyzerAgent.invoke({ messages, userAssets, userProfile });
  logger.info("analyzerNode", "analyzer result", result);

  return { messages: [...result.messages] };
};
