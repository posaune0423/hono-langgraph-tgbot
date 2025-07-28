import { END } from "@langchain/langgraph";
import type { graphState } from "./graph-state";

export const managerRouter = (state: typeof graphState.State): "dataFetch" | "generalist" | typeof END => {
  const { isDataFetchNodeQuery, isGeneralQuery } = state;

  if (isDataFetchNodeQuery) {
    return "dataFetch";
  }

  if (isGeneralQuery) {
    return "generalist";
  }

  return END;
};
