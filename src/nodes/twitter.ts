import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { gpt4oMini } from "../utils/model";
import { memory, type graphState } from "../utils/state";
import { TwitterSearch } from "../tools/twitterSearch";
import { twitterPrompt } from "../prompts/twitter";
import { logger } from "../utils/logger";

const twitterAgent = createReactAgent({
    llm: gpt4oMini,
    tools: [new TwitterSearch()],
    checkpointSaver: memory,
    prompt: twitterPrompt,
});

export const twitterNode = async (
    state: typeof graphState.State,
): Promise<Partial<typeof graphState.State>> => {
    logger.info("twitterNode", "twitterNode", state);
    const { messages } = state;

    const result = await twitterAgent.invoke({ messages });
    logger.info("twitterNode", "twitter result", result);

    return { messages: [...result.messages] };
};
