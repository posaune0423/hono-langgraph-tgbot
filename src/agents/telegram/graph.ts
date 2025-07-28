import { END, START, StateGraph } from "@langchain/langgraph";
import { logger } from "../../utils/logger";
import { graphState } from "./graph-state";
import { dataFetchNode } from "./nodes/data-fetch";
import { generalistNode } from "./nodes/general";
// import { managerNode } from "./nodes/manager";

export async function initTelegramGraph(userId: string) {
  try {
    const workflow = new StateGraph(graphState)
      // nodes
      .addNode("generalist", generalistNode)
      // .addNode("manager", managerNode)
      .addNode("dataFetch", dataFetchNode)
      // edges
      .addEdge(START, "dataFetch")
      .addEdge("dataFetch", "generalist")
      .addEdge("generalist", END);

    const graph = workflow.compile();

    const config = { configurable: { thread_id: userId } };

    return { graph, config };
  } catch (error) {
    logger.error("Failed to initialize agent:", error);
    throw error;
  }
}
