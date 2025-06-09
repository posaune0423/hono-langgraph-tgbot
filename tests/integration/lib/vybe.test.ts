import { describe, it, expect, beforeAll } from "vitest";
import { fetchTokenOHLCV, fetchMultipleTokenOHLCV } from "../../../src/lib/vybe";
import type { VybeTimeframe } from "../../../src/lib/vybe";

describe("Vybe Network API Client - Integration Tests", () => {
  // 実際のSolana mint addresses
  const SOL_MINT = "So11111111111111111111111111111111111111112"; // SOL
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

  beforeAll(() => {
    // 環境変数が設定されていることを確認
    if (!process.env.VYBE_API_KEY) {
      throw new Error("VYBE_API_KEY environment variable is required for integration tests");
    }
  });

  describe("fetchTokenOHLCV", () => {
    it("should successfully fetch OHLCV data for SOL", async () => {
      const result = await fetchTokenOHLCV(SOL_MINT, "1h", { limit: 10 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.data).toBeDefined();
        expect(Array.isArray(result.value.data)).toBe(true);
        expect(result.value.mintAddress).toBe(SOL_MINT);
        expect(result.value.timeframe).toBe("1h");
        expect(result.value.success).toBe(true);

        // データが存在する場合、構造をチェック
        if (result.value.data.length > 0) {
          const firstData = result.value.data[0];
          expect(firstData).toHaveProperty("date");
          expect(firstData).toHaveProperty("open");
          expect(firstData).toHaveProperty("high");
          expect(firstData).toHaveProperty("low");
          expect(firstData).toHaveProperty("close");
          expect(firstData).toHaveProperty("volume");
          expect(typeof firstData.open).toBe("number");
          expect(typeof firstData.high).toBe("number");
          expect(typeof firstData.low).toBe("number");
          expect(typeof firstData.close).toBe("number");
          expect(typeof firstData.volume).toBe("number");
        }
      }
    }, 10000); // 10秒のタイムアウト

    it("should handle different timeframes", async () => {
      const timeframes: VybeTimeframe[] = ["1h", "4h", "1d"];

      for (const timeframe of timeframes) {
        const result = await fetchTokenOHLCV(SOL_MINT, timeframe, { limit: 5 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.timeframe).toBe(timeframe);
        }
      }
    }, 15000);

    it("should handle invalid mint address", async () => {
      const result = await fetchTokenOHLCV("invalid-address", "1h");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("validation");
        expect(result.error.message).toContain("mintAddress must be a valid Solana address");
      }
    });

    it("should handle empty mint address", async () => {
      const result = await fetchTokenOHLCV("", "1h");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("validation");
        expect(result.error.message).toContain("mintAddress is required and cannot be empty");
      }
    });

    it("should handle limit validation", async () => {
      const result = await fetchTokenOHLCV(SOL_MINT, "1h", { limit: 2000 });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("validation");
        expect(result.error.message).toContain("limit must be between 1 and 1000");
      }
    });
  });

  describe("fetchMultipleTokenOHLCV", () => {
    it("should successfully fetch OHLCV data for multiple tokens", async () => {
      const result = await fetchMultipleTokenOHLCV([SOL_MINT, USDC_MINT], "1h", { limit: 5 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const data = result.value;
        expect(typeof data).toBe("object");

        // 少なくとも1つのトークンのデータが取得できることを確認
        const tokenKeys = Object.keys(data);
        expect(tokenKeys.length).toBeGreaterThan(0);

        // 各トークンのデータ構造をチェック
        tokenKeys.forEach(mintAddress => {
          const tokenData = data[mintAddress];
          expect(tokenData).toBeDefined();
          expect(tokenData.mintAddress).toBe(mintAddress);
          expect(Array.isArray(tokenData.data)).toBe(true);
        });
      }
    }, 15000);

    it("should handle empty mint addresses array", async () => {
      const result = await fetchMultipleTokenOHLCV([], "1h");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("validation");
        expect(result.error.message).toContain("At least one mint address is required");
      }
    });

    it("should handle too many addresses", async () => {
      const tooManyAddresses = Array(51).fill(SOL_MINT);
      const result = await fetchMultipleTokenOHLCV(tooManyAddresses, "1h");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("validation");
        expect(result.error.message).toContain("Cannot fetch more than 50 tokens at once");
      }
    });

    it("should remove duplicate addresses", async () => {
      const duplicateAddresses = [SOL_MINT, SOL_MINT, USDC_MINT];
      const result = await fetchMultipleTokenOHLCV(duplicateAddresses, "1h", { limit: 5 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const tokenKeys = Object.keys(result.value);
        // 重複が除去されて2つのユニークなアドレスのみになっているはず
        expect(tokenKeys.length).toBeLessThanOrEqual(2);
        expect(tokenKeys).toContain(SOL_MINT);
      }
    }, 10000);

    it("should handle mix of valid and invalid addresses", async () => {
      const mixedAddresses = [SOL_MINT, "invalid-address"];
      const result = await fetchMultipleTokenOHLCV(mixedAddresses, "1h");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("validation");
        expect(result.error.message).toContain("mintAddress must be a valid Solana address");
      }
    });
  });

  describe("API Response Validation", () => {
    it("should handle API timeouts gracefully", async () => {
      // この部分は実際のAPIの応答時間に依存するため、タイムアウトを短く設定してテスト
      const result = await fetchTokenOHLCV(SOL_MINT, "1h", { limit: 1 });

      // 成功またはネットワークエラーのいずれかになるはず
      if (result.isErr()) {
        expect(["network", "api"].includes(result.error.type)).toBe(true);
      } else {
        expect(result.value).toBeDefined();
      }
    }, 5000);

    it("should validate response structure", async () => {
      const result = await fetchTokenOHLCV(SOL_MINT, "1d", { limit: 1 });

      if (result.isOk()) {
        const response = result.value;
        expect(response).toHaveProperty("data");
        expect(response).toHaveProperty("timeframe");
        expect(response).toHaveProperty("mintAddress");
        expect(response).toHaveProperty("success");
        expect(Array.isArray(response.data)).toBe(true);
      }
    });
  });
});