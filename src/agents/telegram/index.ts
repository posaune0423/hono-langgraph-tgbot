import { END, START, StateGraph } from "@langchain/langgraph";
import { logger } from "../../utils/logger";
import { graphState, memory } from "./graph-state";
import { generalistNode } from "./nodes/general";

export async function initAgent(userId: number) {
  try {
    logger.info("Initializing Telegram graph", { userId });

    const workflow = new StateGraph(graphState)
      // nodes
      .addNode("generalist", generalistNode)

      // edges
      .addEdge(START, "generalist")
      .addEdge("generalist", END);

    // Compile with memory saver for conversation persistence
    const graph = workflow.compile({ checkpointer: memory });

    const config = { configurable: { thread_id: userId } };

    logger.info("Successfully initialized Telegram graph", { userId });

    return { graph, config };
  } catch (error) {
    logger.error("Failed to initialize agent:", { error, userId });
    throw error;
  }
}
