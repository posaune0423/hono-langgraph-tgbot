import { describe, it, expect, vi } from "vitest";
import { initSignalGraph } from "../../../src/agents/signal/graph";

describe("Signal Agent", () => {
  it("should initialize graph successfully", async () => {
    const token = "SOL";
    const { agent, config } = await initSignalGraph(token);

    // エージェントが正常に初期化されることを確認
    expect(agent).toBeDefined();
    expect(config).toBeDefined();
    expect(config.configurable.thread_id).toBe("signal_SOL");
  });

  it("should create unique thread ID for different tokens", async () => {
    const tokens = ["BTC", "ETH", "SOL"];

    for (const token of tokens) {
      const { config } = await initSignalGraph(token);
      expect(config.configurable.thread_id).toBe(`signal_${token}`);
    }
  });

  it("should handle graph compilation", async () => {
    const { agent } = await initSignalGraph("TEST");

    // グラフが適切にコンパイルされ、invokeメソッドが存在することを確認
    expect(typeof agent.invoke).toBe("function");
    expect(typeof agent.stream).toBe("function");
  });
});