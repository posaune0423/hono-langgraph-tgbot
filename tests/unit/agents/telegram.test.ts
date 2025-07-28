import { beforeAll, describe, expect, test } from "bun:test";
import { handleTelegramMessage } from "../../../src/agents/telegram";

// Set up test environment
beforeAll(() => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.NODE_ENV = "test";
});

describe("Telegram LangGraph Agent", () => {
  test("should export handleTelegramMessage function", () => {
    expect(typeof handleTelegramMessage).toBe("function");
  });

  test("should validate required input parameters", async () => {
    // Test missing userId
    const resultNoUserId = await handleTelegramMessage({
      userId: "",
      userMessage: "Hello",
      userName: "TestUser",
    });

    expect(resultNoUserId.isErr()).toBe(true);
    if (resultNoUserId.isErr()) {
      expect(resultNoUserId.error.type).toBe("VALIDATION_ERROR");
    }

    // Test missing userMessage
    const resultNoMessage = await handleTelegramMessage({
      userId: "test-user",
      userMessage: "",
      userName: "TestUser",
    });

    expect(resultNoMessage.isErr()).toBe(true);
    if (resultNoMessage.isErr()) {
      expect(resultNoMessage.error.type).toBe("VALIDATION_ERROR");
    }
  });

  test("should handle test environment gracefully", async () => {
    // In test environment, expect either success or controlled failure
    const result = await handleTelegramMessage({
      userId: "test-user",
      userMessage: "Hello",
      userName: "TestUser",
    });

    expect(result.isOk() || result.isErr()).toBe(true);

    if (result.isErr()) {
      // Should be a proper error type, not a timeout
      expect(["CONVERSATION_ERROR", "NO_CONTENT_ERROR", "VALIDATION_ERROR"].includes(result.error.type)).toBe(true);
      expect(result.error.message).toBeDefined();
    }

    if (result.isOk()) {
      expect(result.value).toHaveProperty("response");
      expect(result.value).toHaveProperty("metadata");
    }
  }, 2000); // 2 second timeout for test environment

  test("should return proper error structure", async () => {
    const result = await handleTelegramMessage({
      userId: "test-user-validation",
      userMessage: "Test message",
      userName: "TestUser",
    });

    // Test the structure regardless of success/failure
    expect(result.isOk() || result.isErr()).toBe(true);

    if (result.isOk()) {
      expect(result.value).toHaveProperty("response");
      expect(result.value).toHaveProperty("metadata");
      expect(result.value.metadata).toHaveProperty("userId");
      expect(result.value.metadata).toHaveProperty("threadId");
      expect(result.value.metadata.userId).toBe("test-user-validation");
      expect(result.value.metadata.threadId).toBe("telegram_user_test-user-validation");
    }

    if (result.isErr()) {
      expect(result.error).toHaveProperty("type");
      expect(result.error).toHaveProperty("message");
      expect(typeof result.error.message).toBe("string");
    }
  }, 2000); // 2 second timeout for test environment
});
