import { describe, it, expect } from "vitest";
import { managerRouter } from "../../../src/agents/telegram/graph-route";
import { END } from "@langchain/langgraph";

describe("Graph Routing", () => {
  it("should route to dataFetch when data fetch flag is true", () => {
    const state = {
      isDataFetchNodeQuery: true,
      isGeneralQuery: false,
    };

    const result = managerRouter(state as any);
    expect(result).toBe("dataFetch");
  });

  it("should route to generalist when general query flag is true", () => {
    const state = {
      isDataFetchNodeQuery: false,
      isGeneralQuery: true,
    };

    const result = managerRouter(state as any);
    expect(result).toBe("generalist");
  });

  it("should route to END when no flags are set", () => {
    const state = {
      isDataFetchNodeQuery: false,
      isGeneralQuery: false,
    };

    const result = managerRouter(state as any);
    expect(result).toBe(END);
  });

  it("should prioritize dataFetch over generalist", () => {
    const state = {
      isDataFetchNodeQuery: true,
      isGeneralQuery: true,
    };

    const result = managerRouter(state as any);
    expect(result).toBe("dataFetch");
  });
});