import { RunnableSequence } from "@langchain/core/runnables";
import { kimiK2 } from "../../model";
import type { graphState } from "../graph-state";
import { parser, prompt } from "../prompts/manager";

const chain = RunnableSequence.from([prompt, kimiK2, parser]);

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
