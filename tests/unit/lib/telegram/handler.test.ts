import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const handlerModulePath = new URL("../../../../src/bot/handler.ts", import.meta.url).pathname;
const agentModulePath = new URL("../../../../src/agents/telegram/index.ts", import.meta.url).pathname;
const tgUtilsModulePath = new URL("../../../../src/utils/telegram.ts", import.meta.url).pathname;

// Re-import fresh module instance with current mocks
const importHandler = async () => await import(handlerModulePath);

type MockBot = {
  on: (event: string, fn: (ctx: unknown) => Promise<void> | void) => void;
};

type MockCtx = {
  message?: { text?: string } | Record<string, unknown>;
  reply: (text: string) => Promise<void> | void;
};

describe("Telegram message handler", () => {
  beforeEach(() => {
    mock.restore();
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    mock.restore();
  });

  it("registers message listener via setupHandler", async () => {
    const { setupHandler } = await importHandler();

    let registered = false;
    const bot: MockBot = {
      on: (event: string) => {
        if (event === "message") registered = true;
      },
    };

    setupHandler(bot as unknown as import("grammy").Bot);
    expect(registered).toBe(true);
  });

  it("extracts user, invokes agent graph, and replies with model output", async () => {
    const replyCalls: string[] = [];

    // Mock extractUserInfo
    mock.module(tgUtilsModulePath, () => ({
      extractUserInfo: () => ({ userId: 42 }),
    }));

    // Mock initAgent -> returns graph.invoke producing response content
    mock.module(agentModulePath, () => ({
      initAgent: async () => ({
        graph: {
          invoke: async () => ({
            messages: [
              { content: "ignored" },
              { content: "Hello from model" },
            ],
          }),
        },
      }),
    }));

    const { setupHandler } = await importHandler();

    const ctx: MockCtx = {
      message: { text: "hi" },
      reply: (text: string) => {
        replyCalls.push(text);
      },
    };

    // Register and manually trigger message handler by simulating bot.on
    let handler: (ctx: MockCtx) => Promise<void> | void = () => {};
    const bot: MockBot = {
      on: (_event: string, fn: (ctx: MockCtx) => Promise<void> | void) => {
        handler = fn;
      },
    };

    setupHandler(bot as unknown as import("grammy").Bot);
    await handler(ctx);

    expect(replyCalls).toEqual(["Hello from model"]);
  });

  it("logs and returns early when text message is missing", async () => {
    let replyCalled = false;

    const { setupHandler } = await importHandler();

    // Ensure extractUserInfo and initAgent won't be called by accident
    mock.module(tgUtilsModulePath, () => ({
      extractUserInfo: () => {
        throw new Error("should not be called");
      },
    }));
    mock.module(agentModulePath, () => ({
      initAgent: async () => {
        throw new Error("should not be called");
      },
    }));

    const ctx: MockCtx = {
      message: {},
      reply: () => {
        replyCalled = true;
      },
    };

    let handler: (ctx: MockCtx) => Promise<void> | void = () => {};
    const bot: MockBot = {
      on: (_event: string, fn: (ctx: MockCtx) => Promise<void> | void) => {
        handler = fn;
      },
    };

    setupHandler(bot as unknown as import("grammy").Bot);
    await handler(ctx);

    expect(replyCalled).toBe(false);
  });
});
