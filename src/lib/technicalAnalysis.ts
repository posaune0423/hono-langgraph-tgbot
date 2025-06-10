import { RSI, MACD, BollingerBands, SMA, EMA } from "technicalindicators";
import { logger } from "../utils/logger";
import { generateId } from "../utils/id";
import type { NewTechnicalAnalysis, NewTradingSignal } from "../db";

export type OHLCVData = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AnalysisResult = {
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  volumeSma?: number;
};

export type SignalResult = {
  type: "BUY" | "SELL" | "HOLD";
  indicator: string;
  strength: "WEAK" | "MODERATE" | "STRONG";
  message: string;
  metadata: Record<string, any>;
};

/**
 * OHLCVデータからテクニカル指標を計算する
 */
export const calculateTechnicalIndicators = (data: OHLCVData[]): AnalysisResult | null => {
  if (data.length < 50) {
    logger.warn("technicalAnalysis", "Insufficient data for technical analysis", { dataLength: data.length });
    return null;
  }

  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);

  try {
    // RSI (14期間)
    const rsiResult = RSI.calculate({ values: closes, period: 14 });
    const rsi = rsiResult[rsiResult.length - 1];

    // MACD (12, 26, 9)
    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const macd = macdResult[macdResult.length - 1];

    // Bollinger Bands (20期間, 2σ)
    const bbResult = BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    });
    const bb = bbResult[bbResult.length - 1];

    // 移動平均線
    const sma20Result = SMA.calculate({ values: closes, period: 20 });
    const sma20 = sma20Result[sma20Result.length - 1];

    const sma50Result = SMA.calculate({ values: closes, period: 50 });
    const sma50 = sma50Result[sma50Result.length - 1];

    const ema12Result = EMA.calculate({ values: closes, period: 12 });
    const ema12 = ema12Result[ema12Result.length - 1];

    const ema26Result = EMA.calculate({ values: closes, period: 26 });
    const ema26 = ema26Result[ema26Result.length - 1];

    // 出来高移動平均
    const volumeSmaResult = SMA.calculate({ values: volumes, period: 20 });
    const volumeSma = volumeSmaResult[volumeSmaResult.length - 1];

    return {
      rsi,
      macd:
        macd && macd.MACD !== undefined && macd.signal !== undefined && macd.histogram !== undefined
          ? {
              macd: macd.MACD,
              signal: macd.signal,
              histogram: macd.histogram,
            }
          : undefined,
      bollingerBands:
        bb && bb.upper !== undefined && bb.middle !== undefined && bb.lower !== undefined
          ? {
              upper: bb.upper,
              middle: bb.middle,
              lower: bb.lower,
            }
          : undefined,
      sma20,
      sma50,
      ema12,
      ema26,
      volumeSma,
    };
  } catch (error) {
    logger.error("technicalAnalysis", "Error calculating technical indicators", error);
    return null;
  }
};

/**
 * テクニカル指標から売買シグナルを生成する
 */
export const generateTradingSignals = (
  analysis: AnalysisResult,
  currentPrice: number,
  previousAnalysis?: AnalysisResult,
): SignalResult[] => {
  const signals: SignalResult[] = [];

  // RSIベースのシグナル
  if (analysis.rsi !== undefined) {
    if (analysis.rsi <= 30) {
      signals.push({
        type: "BUY",
        indicator: "RSI",
        strength: analysis.rsi <= 20 ? "STRONG" : "MODERATE",
        message: `RSI oversold condition detected (${analysis.rsi.toFixed(2)})`,
        metadata: { rsi: analysis.rsi, threshold: 30 },
      });
    } else if (analysis.rsi >= 70) {
      signals.push({
        type: "SELL",
        indicator: "RSI",
        strength: analysis.rsi >= 80 ? "STRONG" : "MODERATE",
        message: `RSI overbought condition detected (${analysis.rsi.toFixed(2)})`,
        metadata: { rsi: analysis.rsi, threshold: 70 },
      });
    }
  }

  // MACDベースのシグナル
  if (analysis.macd && previousAnalysis?.macd) {
    const currentHistogram = analysis.macd.histogram;
    const previousHistogram = previousAnalysis.macd.histogram;

    // MACDクロスオーバー
    if (previousHistogram <= 0 && currentHistogram > 0) {
      signals.push({
        type: "BUY",
        indicator: "MACD",
        strength: Math.abs(currentHistogram) > 0.01 ? "STRONG" : "MODERATE",
        message: "MACD bullish crossover detected",
        metadata: {
          macd: analysis.macd.macd,
          signal: analysis.macd.signal,
          histogram: currentHistogram,
        },
      });
    } else if (previousHistogram >= 0 && currentHistogram < 0) {
      signals.push({
        type: "SELL",
        indicator: "MACD",
        strength: Math.abs(currentHistogram) > 0.01 ? "STRONG" : "MODERATE",
        message: "MACD bearish crossover detected",
        metadata: {
          macd: analysis.macd.macd,
          signal: analysis.macd.signal,
          histogram: currentHistogram,
        },
      });
    }
  }

  // Bollinger Bandsベースのシグナル
  if (analysis.bollingerBands) {
    const { upper, lower } = analysis.bollingerBands;

    if (currentPrice <= lower) {
      signals.push({
        type: "BUY",
        indicator: "BB",
        strength: "MODERATE",
        message: "Price touched lower Bollinger Band",
        metadata: {
          price: currentPrice,
          lowerBand: lower,
          upperBand: upper,
        },
      });
    } else if (currentPrice >= upper) {
      signals.push({
        type: "SELL",
        indicator: "BB",
        strength: "MODERATE",
        message: "Price touched upper Bollinger Band",
        metadata: {
          price: currentPrice,
          lowerBand: lower,
          upperBand: upper,
        },
      });
    }
  }

  // 移動平均クロスシグナル
  if (analysis.sma20 && analysis.sma50 && previousAnalysis?.sma20 && previousAnalysis?.sma50) {
    const currentGoldenCross = analysis.sma20 > analysis.sma50;
    const previousGoldenCross = previousAnalysis.sma20 > previousAnalysis.sma50;

    if (!previousGoldenCross && currentGoldenCross) {
      signals.push({
        type: "BUY",
        indicator: "SMA_CROSS",
        strength: "STRONG",
        message: "Golden Cross detected (SMA20 > SMA50)",
        metadata: {
          sma20: analysis.sma20,
          sma50: analysis.sma50,
        },
      });
    } else if (previousGoldenCross && !currentGoldenCross) {
      signals.push({
        type: "SELL",
        indicator: "SMA_CROSS",
        strength: "STRONG",
        message: "Death Cross detected (SMA20 < SMA50)",
        metadata: {
          sma20: analysis.sma20,
          sma50: analysis.sma50,
        },
      });
    }
  }

  return signals;
};

/**
 * テクニカル分析結果をデータベース形式に変換する
 */
export const convertToDbFormat = (token: string, timestamp: number, analysis: AnalysisResult): NewTechnicalAnalysis => {
  return {
    id: generateId(),
    token,
    timestamp,
    rsi: analysis.rsi?.toString(),
    macd: analysis.macd?.macd.toString(),
    macd_signal: analysis.macd?.signal.toString(),
    macd_histogram: analysis.macd?.histogram.toString(),
    bb_upper: analysis.bollingerBands?.upper.toString(),
    bb_middle: analysis.bollingerBands?.middle.toString(),
    bb_lower: analysis.bollingerBands?.lower.toString(),
    sma_20: analysis.sma20?.toString(),
    sma_50: analysis.sma50?.toString(),
    ema_12: analysis.ema12?.toString(),
    ema_26: analysis.ema26?.toString(),
    volume_sma: analysis.volumeSma?.toString(),
  };
};

/**
 * シグナルをデータベース形式に変換する
 */
export const convertSignalToDbFormat = (
  token: string,
  timestamp: number,
  price: number,
  signal: SignalResult,
): NewTradingSignal => {
  return {
    id: generateId(),
    token,
    signal_type: signal.type,
    indicator: signal.indicator,
    strength: signal.strength,
    price: price.toString(),
    message: signal.message,
    metadata: signal.metadata,
    timestamp,
  };
};
