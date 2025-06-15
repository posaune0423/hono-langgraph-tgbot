import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { gpt4oMini } from "../model";
import { memory, type graphState } from "../graph-state";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import type { Tool } from "@langchain/core/tools";
import { generalPrompt } from "../prompts/general";

// Initialize tools array
const tools: Tool[] = [];

// Only add Tavily search if API key is available
if (process.env.TAVILY_API_KEY) {
  tools.push(new TavilySearchResults());
}

const generalAgent = createReactAgent({
  llm: gpt4oMini,
  tools,
  checkpointSaver: memory,
  prompt: generalPrompt,
});

export const generalistNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  const { messages } = state;

  const result = await generalAgent.invoke({ messages });

  return { messages: [...result.messages] };
};
