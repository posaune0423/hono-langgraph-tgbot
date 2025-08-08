import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const WEBHOOK_PATH = "/telegram";

// Helper to build absolute module paths for mocking
const resolvePath = (relative: string) => new URL(relative, import.meta.url).pathname;

// Absolute paths to modules for reliable mocking
const botModulePath = resolvePath("../../../src/bot/index.ts");
const routeModuleSpecifier = "../../../src/routes/webhook.ts";

const freshImportRoute = async () =>
  await import(`${routeModuleSpecifier}?v=${Date.now()}-${Math.random()}`);

describe("Webhook Routes (Telegram)", () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.TELEGRAM_BOT_TOKEN;
    Reflect.deleteProperty(process.env, "TELEGRAM_BOT_TOKEN");
    mock.restore();
  });

  afterEach(() => {
    if (originalToken) {
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    } else {
      Reflect.deleteProperty(process.env, "TELEGRAM_BOT_TOKEN");
    }
    mock.restore();
  });

  it("returns 500 when TELEGRAM_BOT_TOKEN is missing", async () => {
    const { default: route } = await freshImportRoute();

    const req = new Request(`http://localhost${WEBHOOK_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await route.request(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json).toEqual({ error: "Bot token not configured" });
  });

  it("invokes grammy webhook handler and uses configured TIMEOUT_MS", async () => {
    // Capture options passed to webhookCallback
    let receivedOptions: unknown = null;

    mock.module("grammy", () => ({
      webhookCallback: (_bot: unknown, framework: string, options?: unknown) => {
        receivedOptions = options;
        // Return a hono-compatible handler
        return async (c: { json: (body: unknown, status?: number) => Response }) =>
          c.json({ ok: true, framework }, 200);
      },
    }));

    // Mock bot init to avoid network calls
    mock.module(botModulePath, () => ({
      initBot: async () => ({}),
      getBotInstance: () => ({}),
    }));

    process.env.TELEGRAM_BOT_TOKEN = "test-token";

    const { default: route } = await freshImportRoute();

    const res = await route.request(
      new Request(`http://localhost${WEBHOOK_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ update_id: 1 }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify timeout was wired through
    const { TIMEOUT_MS } = await import("../../../src/constants");
    expect((receivedOptions as { timeoutMilliseconds?: number })?.timeoutMilliseconds).toBe(TIMEOUT_MS);
  });

  it("returns 500 with structured error when webhook handler throws", async () => {
    mock.module("grammy", () => ({
      webhookCallback: () => {
        return async () => {
          throw new Error("boom");
        };
      },
    }));

    mock.module(botModulePath, () => ({
      initBot: async () => ({}),
      getBotInstance: () => ({}),
    }));

    process.env.TELEGRAM_BOT_TOKEN = "test-token";

    const { default: route } = await freshImportRoute();

    const res = await route.request(
      new Request(`http://localhost${WEBHOOK_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ update_id: 2 }),
      }),
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
    expect(json.message).toBe("boom");
  });
});
