import { END } from "@langchain/langgraph";
import type { graphState } from "./graph-state";

export const managerRouter = (state: typeof graphState.State): "generalist" | typeof END => {
  const { isGeneralQuery } = state;

  if (isGeneralQuery) {
    return "generalist";
  }

  return END;
};
