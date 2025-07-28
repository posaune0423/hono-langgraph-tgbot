import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import type { Tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { gpt4oMini } from "../../model";
import { type graphState, memory } from "../graph-state";
import { generalPrompt } from "../prompts/general";

// Initialize tools array
const tools: Tool[] = [];

// Only add Tavily search if API key is available
if (process.env.TAVILY_API_KEY) {
  tools.push(new TavilySearchResults());
}

export const generalistNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  const { messages } = state;

  const agent = createReactAgent({
    llm: gpt4oMini,
    tools,
    prompt: generalPrompt,
    checkpointSaver: memory,
  });

  const result = await agent.invoke({ messages });

  return { messages: [...result.messages] };
};
