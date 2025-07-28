import { END, START, StateGraph } from "@langchain/langgraph";
import { logger } from "../../utils/logger";
import { graphState } from "./graph-state";
import { generalistNode } from "./nodes/general";

export async function initTelegramGraph(userId: string) {
  try {
    const workflow = new StateGraph(graphState)
      // nodes
      .addNode("generalist", generalistNode)

      // edges
      .addEdge(START, "generalist")
      .addEdge("generalist", END);

    const graph = workflow.compile();

    const config = { configurable: { thread_id: userId } };

    return { graph, config };
  } catch (error) {
    logger.error("Failed to initialize agent:", error);
    throw error;
  }
}
