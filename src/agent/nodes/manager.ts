import { RunnableSequence } from "@langchain/core/runnables";
import { gpt4o } from "../model";
import type { graphState } from "../graphState";
import { prompt, parser } from "../prompts/manager";

const chain = RunnableSequence.from([prompt, gpt4o, parser]);

export const managerNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  const { messages } = state;

  const result = await chain.invoke({
    formatInstructions: parser.getFormatInstructions(),
    messages: messages,
  });

  const { isDataFetchNodeQuery, isGeneralQuery } = result;

  return {
    isDataFetchNodeQuery,
    isGeneralQuery,
  };
};
