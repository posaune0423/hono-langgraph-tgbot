/**
 * 各テクニカル指標のシグナル生成関数
 * 指標ごとに独立したシグナル生成ロジックを提供
 */

import {
  RSI_CONFIG,
  MACD_CONFIG,
  BOLLINGER_BANDS_CONFIG,
  MOVING_AVERAGE_CONFIG,
  type SignalStrength,
  type SignalType,
} from "../constants/technicalAnalysis";
import type { AnalysisResult, SignalResult } from "./technicalAnalysis";

/**
 * RSI指標からシグナルを生成
 */
export const generateRSISignal = (analysis: AnalysisResult): SignalResult | null => {
  if (analysis.rsi === undefined) return null;

  const { rsi } = analysis;
  const { oversoldThreshold, overboughtThreshold, strongOversoldThreshold, strongOverboughtThreshold } = RSI_CONFIG;

  if (rsi <= oversoldThreshold) {
    return {
      type: "BUY" as SignalType,
      indicator: "RSI",
      strength: (rsi <= strongOversoldThreshold ? "STRONG" : "MODERATE") as SignalStrength,
      message: `RSI oversold condition detected (${rsi.toFixed(2)})`,
      metadata: { rsi, threshold: oversoldThreshold },
    };
  }

  if (rsi >= overboughtThreshold) {
    return {
      type: "SELL" as SignalType,
      indicator: "RSI",
      strength: (rsi >= strongOverboughtThreshold ? "STRONG" : "MODERATE") as SignalStrength,
      message: `RSI overbought condition detected (${rsi.toFixed(2)})`,
      metadata: { rsi, threshold: overboughtThreshold },
    };
  }

  return null;
};

/**
 * MACDクロスオーバーシグナルを生成
 */
export const generateMACDSignal = (
  analysis: AnalysisResult,
  previousAnalysis?: AnalysisResult
): SignalResult | null => {
  if (!analysis.macd || !previousAnalysis?.macd) return null;

  const currentHistogram = analysis.macd.histogram;
  const previousHistogram = previousAnalysis.macd.histogram;
  const { strongHistogramThreshold } = MACD_CONFIG;

  // MACDクロスオーバー（ゼロライン突破）
  if (previousHistogram <= 0 && currentHistogram > 0) {
    return {
      type: "BUY" as SignalType,
      indicator: "MACD",
      strength: (Math.abs(currentHistogram) > strongHistogramThreshold ? "STRONG" : "MODERATE") as SignalStrength,
      message: "MACD bullish crossover detected",
      metadata: {
        macd: analysis.macd.macd,
        signal: analysis.macd.signal,
        histogram: currentHistogram,
      },
    };
  }

  if (previousHistogram >= 0 && currentHistogram < 0) {
    return {
      type: "SELL" as SignalType,
      indicator: "MACD",
      strength: (Math.abs(currentHistogram) > strongHistogramThreshold ? "STRONG" : "MODERATE") as SignalStrength,
      message: "MACD bearish crossover detected",
      metadata: {
        macd: analysis.macd.macd,
        signal: analysis.macd.signal,
        histogram: currentHistogram,
      },
    };
  }

  return null;
};

/**
 * Bollinger Bandsバンドタッチシグナルを生成
 */
export const generateBollingerBandsSignal = (
  analysis: AnalysisResult,
  currentPrice: number
): SignalResult | null => {
  if (!analysis.bollingerBands) return null;

  const { upper, lower } = analysis.bollingerBands;

  if (currentPrice <= lower) {
    return {
      type: "BUY" as SignalType,
      indicator: "BB",
      strength: "MODERATE" as SignalStrength,
      message: "Price touched lower Bollinger Band",
      metadata: {
        price: currentPrice,
        lowerBand: lower,
        upperBand: upper,
      },
    };
  }

  if (currentPrice >= upper) {
    return {
      type: "SELL" as SignalType,
      indicator: "BB",
      strength: "MODERATE" as SignalStrength,
      message: "Price touched upper Bollinger Band",
      metadata: {
        price: currentPrice,
        lowerBand: lower,
        upperBand: upper,
      },
    };
  }

  return null;
};

/**
 * 移動平均クロスシグナルを生成
 */
export const generateMovingAverageCrossSignal = (
  analysis: AnalysisResult,
  previousAnalysis?: AnalysisResult
): SignalResult | null => {
  if (!analysis.sma20 || !analysis.sma50 || !previousAnalysis?.sma20 || !previousAnalysis?.sma50) {
    return null;
  }

  const currentGoldenCross = analysis.sma20 > analysis.sma50;
  const previousGoldenCross = previousAnalysis.sma20 > previousAnalysis.sma50;

  // ゴールデンクロス（短期線が長期線を上抜け）
  if (!previousGoldenCross && currentGoldenCross) {
    return {
      type: "BUY" as SignalType,
      indicator: "SMA_CROSS",
      strength: "STRONG" as SignalStrength,
      message: "Golden Cross detected (SMA20 > SMA50)",
      metadata: {
        sma20: analysis.sma20,
        sma50: analysis.sma50,
      },
    };
  }

  // デッドクロス（短期線が長期線を下抜け）
  if (previousGoldenCross && !currentGoldenCross) {
    return {
      type: "SELL" as SignalType,
      indicator: "SMA_CROSS",
      strength: "STRONG" as SignalStrength,
      message: "Death Cross detected (SMA20 < SMA50)",
      metadata: {
        sma20: analysis.sma20,
        sma50: analysis.sma50,
      },
    };
  }

  return null;
};