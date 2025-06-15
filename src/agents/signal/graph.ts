import { END, START, StateGraph } from "@langchain/langgraph";
import { graphState } from "./graph-state";
import { dataCollectorNode } from "./nodes/data-collector";
import { signalGeneratorNode } from "./nodes/signal-generator";

export async function initSignalGraph(token: string) {
  try {
    const config = { configurable: { thread_id: `signal_${token}` } };

    const workflow = new StateGraph(graphState)
      // nodes
      .addNode("data-collector", dataCollectorNode)
      .addNode("signal-generator", signalGeneratorNode)
      // edges
      .addEdge(START, "data-collector")
      .addEdge("data-collector", "signal-generator")
      .addEdge("signal-generator", END);

    const graph = workflow.compile();

    return { agent: graph, config };
  } catch (error) {
    console.error("Failed to initialize Signal agent:", error);
    throw error;
  }
}
