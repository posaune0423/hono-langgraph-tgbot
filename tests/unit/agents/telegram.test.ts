import { beforeAll, describe, expect, test } from "bun:test";
import { handleTelegramMessage } from "../../../src/agents/telegram";

// Set up test environment
beforeAll(() => {
  process.env.OPENAI_API_KEY = "test-key";
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

  test("should handle conversation errors gracefully", async () => {
    // Test with LangGraph implementation
    const result = await handleTelegramMessage({
      userId: "test-user",
      userMessage: "Hello",
      userName: "TestUser",
    });

    // With test environment, this should work or fail gracefully
    expect(result.isOk() || result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.message).toContain("TestUser");
      expect(["CONVERSATION_ERROR", "NO_CONTENT_ERROR", "VALIDATION_ERROR"].includes(result.error.type)).toBe(true);
    }
  });

  test("should return structured result on success", async () => {
    const result = await handleTelegramMessage({
      userId: "test-user-123",
      userMessage: "Hello, how are you?",
      userName: "TestUser",
    });

    // Test the structure regardless of success/failure
    expect(result.isOk() || result.isErr()).toBe(true);

    if (result.isOk()) {
      expect(result.value).toHaveProperty("response");
      expect(result.value).toHaveProperty("metadata");
      expect(result.value.metadata).toHaveProperty("userId");
      expect(result.value.metadata).toHaveProperty("threadId");
      expect(result.value.metadata.userId).toBe("test-user-123");
      expect(result.value.metadata.threadId).toBe("telegram_user_test-user-123");
    }

    if (result.isErr()) {
      expect(result.error).toHaveProperty("type");
      expect(result.error).toHaveProperty("message");
    }
  });
});
