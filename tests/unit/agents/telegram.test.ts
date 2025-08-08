import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { HumanMessage } from "@langchain/core/messages";

const agentModuleSpecifier = "../../../src/agents/telegram/index.ts";
const graphStatePath = new URL("../../../src/agents/telegram/graph-state.ts", import.meta.url).pathname;
const generalNodePath = new URL("../../../src/agents/telegram/nodes/general.ts", import.meta.url).pathname;
const dataFetchNodePath = new URL("../../../src/agents/telegram/nodes/data-fetch.ts", import.meta.url).pathname;

type AgentState = { messages: Array<HumanMessage> };

const freshImportAgent = async () => await import(`${agentModuleSpecifier}?v=${Date.now()}-${Math.random()}`);

describe("Telegram LangGraph Agent", () => {
  beforeEach(() => {
    mock.restore();
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    mock.restore();
  });

  it("initializes graph and executes nodes in order (dataFetch -> generalist)", async () => {
    // Append identifiable messages to verify order
    mock.module(dataFetchNodePath, () => ({
      dataFetchNode: async (state: AgentState) => ({
        ...state,
        messages: [...(state.messages ?? []), new HumanMessage("data-fetched")],
      }),
    }));
    mock.module(generalNodePath, () => ({
      generalistNode: async (state: AgentState) => ({
        ...state,
        messages: [...(state.messages ?? []), new HumanMessage("final")],
      }),
    }));

    const { initAgent } = await freshImportAgent();

    const { graph, config } = await initAgent(999);
    const result = (await graph.invoke({ messages: [new HumanMessage("hi")] }, config)) as AgentState;

    const contents = result.messages.map((m) => m.content);
    expect(contents.at(-1)).toBe("final");
    expect(contents).toContain("data-fetched");
    const idxFetch = contents.lastIndexOf("data-fetched");
    const idxFinal = contents.lastIndexOf("final");
    expect(idxFetch).toBeGreaterThan(-1);
    expect(idxFinal).toBeGreaterThan(idxFetch);
  });

  it("sets thread_id in config to user id", async () => {
    const { initAgent } = await freshImportAgent();
    const userId = 123456;
    const { config } = await initAgent(userId);

    expect(config.configurable?.thread_id).toBe(userId);
  });

  it("exposes graphState and memory types", async () => {
    const stateModule = await import(graphStatePath);
    expect(stateModule.graphState).toBeDefined();
    expect(stateModule.memory).toBeDefined();
  });
});
