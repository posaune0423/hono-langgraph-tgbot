import { END, START, StateGraph } from "@langchain/langgraph";
import { graphState } from "./graph-state";
import { generalistNode } from "./nodes/general";
import { managerNode } from "./nodes/manager";
import { analyzerNode } from "./nodes/analyzer";
import { managerRouter } from "./graph-route";
import { dataFetchNode } from "./nodes/data-fetch";

export async function initGraph(userId: string) {
  try {
    const config = { configurable: { thread_id: userId } };

    const workflow = new StateGraph(graphState)
      // nodes
      .addNode("generalist", generalistNode)
      .addNode("analyzer", analyzerNode)
      .addNode("manager", managerNode)
      .addNode("dataFetch", dataFetchNode)
      // edges
      .addEdge(START, "manager")
      .addConditionalEdges("manager", managerRouter)
      .addEdge("dataFetch", "analyzer")
      .addEdge("analyzer", END)
      .addEdge("generalist", END);

    const graph = workflow.compile();

    return { agent: graph, config };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}
