import { describe, it, expect } from "vitest";
import { calculatePracticalIndicators, calculateVWAP, calculateOBV } from "../../../src/lib/technicalAnalysis";
import type { OHLCVData, PracticalAnalysisResult, PracticalSignalResult } from "../../../src/lib/technicalAnalysis";

describe("Technical Analysis - 6 Indicators System", () => {
  // 50個以上のSOLミームトークン風のモックデータ（1分足）を生成
  const generateMockOHLCVData = (count: number = 55): OHLCVData[] => {
    const data: OHLCVData[] = [];
    let basePrice = 100;
    let timestamp = 1703000000;

    for (let i = 0; i < count; i++) {
      // 若干のランダム性を持たせつつ、全体的に上昇トレンドを作る
      const priceChange = (Math.random() - 0.4) * 5; // 上昇バイアス
      const newClose = Math.max(50, basePrice + priceChange); // 最低価格50
      const high = newClose + Math.random() * 3;
      const low = newClose - Math.random() * 3;
      const open = basePrice;
      const volume = 800000 + Math.random() * 2000000;

      data.push({
        timestamp: timestamp + i * 60,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(Math.max(low, 50) * 100) / 100,
        close: Math.round(newClose * 100) / 100,
        volume: Math.round(volume),
      });

      basePrice = newClose;
    }

    return data;
  };

  const mockOHLCVData = generateMockOHLCVData(55);

  describe("calculateVWAP", () => {
    it("should calculate VWAP correctly", () => {
      const result = calculateVWAP(mockOHLCVData);

      expect(result).toBeDefined();
      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(result).toBeGreaterThan(0);
        expect(typeof result).toBe("number");

        // VWAP should be reasonable value within price range
        const minPrice = Math.min(...mockOHLCVData.map((d) => d.low));
        const maxPrice = Math.max(...mockOHLCVData.map((d) => d.high));
        expect(result).toBeGreaterThan(minPrice);
        expect(result).toBeLessThan(maxPrice);

        console.log(`VWAP: ${result.toFixed(4)}`);
      }
    });

    it("should handle single data point", () => {
      const singleData = [mockOHLCVData[0]];
      const result = calculateVWAP(singleData);

      const expectedVWAP = (singleData[0].high + singleData[0].low + singleData[0].close) / 3;
      expect(result).toBeCloseTo(expectedVWAP, 2);
    });
  });

  describe("calculateOBV", () => {
    it("should calculate OBV correctly", () => {
      const result = calculateOBV(mockOHLCVData);

      expect(result).toBeDefined();
      expect(result).not.toBeUndefined();
      if (result !== undefined) {
        expect(typeof result).toBe("number");

        // OBV should accumulate positive volume on up days, negative on down days
        console.log(`OBV: ${result.toFixed(0)}`);

        // OBVは価格が上昇トレンドなので正の値になるはず
        expect(result).toBeGreaterThan(0);
      }
    });

    it("should handle single data point", () => {
      const singleData = [mockOHLCVData[0]];
      const result = calculateOBV(singleData);

      expect(result).toBeUndefined(); // 単一データポイントではOBVはundefined
    });
  });

  describe("calculatePracticalIndicators", () => {
    it("should analyze all 6 indicators correctly", () => {
      const result = calculatePracticalIndicators(mockOHLCVData);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.vwap).toBeGreaterThan(0);
        expect(typeof result.vwapDeviation).toBe("number");
        expect(typeof result.obv).toBe("number");
        expect(typeof result.obvZScore).toBe("number");
        expect(result.percentB).toBeGreaterThanOrEqual(0);
        expect(result.atrPercent).toBeGreaterThan(0);
        expect(result.adx).toBeGreaterThanOrEqual(0);
        expect(result.adx).toBeLessThanOrEqual(100);
        expect(result.rsi).toBeGreaterThanOrEqual(0);
        expect(result.rsi).toBeLessThanOrEqual(100);

        console.log("6指標分析結果:");
        console.log(`VWAP: ${result.vwap?.toFixed(4)}`);
        console.log(`VWAP乖離率: ${result.vwapDeviation?.toFixed(2)}%`);
        console.log(`OBV: ${result.obv?.toFixed(0)}`);
        console.log(`OBV z-score: ${result.obvZScore?.toFixed(2)}σ`);
        console.log(`%B: ${result.percentB?.toFixed(3)}`);
        console.log(`ATR%: ${result.atrPercent?.toFixed(2)}%`);
        console.log(`ADX: ${result.adx?.toFixed(1)}`);
        console.log(`RSI: ${result.rsi?.toFixed(1)}`);
      }
    });

    it("should handle extreme VWAP deviation scenarios", () => {
      // 極端なVWAP乖離をテストするためのデータ（50個以上必要）
      const extremeData = generateMockOHLCVData(55);
      // 最後に極端な上昇を追加
      extremeData[extremeData.length - 1] = {
        timestamp: extremeData[extremeData.length - 1].timestamp,
        open: extremeData[extremeData.length - 2].close,
        high: extremeData[extremeData.length - 2].close * 1.3, // 30%上昇
        low: extremeData[extremeData.length - 2].close * 0.95,
        close: extremeData[extremeData.length - 2].close * 1.25, // 25%上昇
        volume: 5000000,
      };

      const result = calculatePracticalIndicators(extremeData);

      expect(result).not.toBeNull();
      if (result) {
        console.log(`\n極端なシナリオ - VWAP乖離率: ${result.vwapDeviation?.toFixed(2)}%`);

        // VWAP乖離率が計算されていることを確認
        expect(result.vwapDeviation).toBeDefined();
      }
    });

    it("should validate ADX calculation", () => {
      const result = calculatePracticalIndicators(mockOHLCVData);

      expect(result).not.toBeNull();
      if (result) {
        console.log(`\nADX分析:`);
        console.log(`ADX値: ${result.adx?.toFixed(1)}`);
        console.log(`ADX方向: ${result.adxDirection}`);

        expect(result.adx).toBeDefined();
        expect(result.adxDirection).toBeDefined();
      }
    });

    it("should handle insufficient data gracefully", () => {
      const insufficientData = mockOHLCVData.slice(0, 3); // 3個だけ

      expect(() => {
        calculatePracticalIndicators(insufficientData);
      }).not.toThrow();

      const result = calculatePracticalIndicators(insufficientData);
      expect(result).toBeNull(); // 十分なデータがない場合はnullを返す
    });
  });
});
