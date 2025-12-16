import { HumanMessage } from "@langchain/core/messages";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const agentModuleSpecifier = "../../../src/agents/telegram/index.ts";
const graphStatePath = new URL("../../../src/agents/telegram/graph-state.ts", import.meta.url).pathname;
const generalNodePath = new URL("../../../src/agents/telegram/nodes/general.ts", import.meta.url).pathname;

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

  it("initializes graph and executes generalist node", async () => {
    mock.module(generalNodePath, () => ({
      generalistNode: async (state: AgentState) => ({
        ...state,
        messages: [...(state.messages ?? []), new HumanMessage("final")],
      }),
    }));

    const { initAgent } = await freshImportAgent();

    const { graph, config } = await initAgent(999);
    const result = (await graph.invoke({ messages: [new HumanMessage("hi")] }, config)) as AgentState;

    const contents = result.messages.map(m => m.content);
    expect(contents.at(-1)).toBe("final");
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
