import { RSI, MACD, BollingerBands, SMA, EMA } from "technicalindicators";
import { logger } from "../utils/logger";
import { generateId } from "../utils/id";
import type { NewTechnicalAnalysis, NewTradingSignal } from "../db";
import {
  RSI_CONFIG,
  MACD_CONFIG,
  BOLLINGER_BANDS_CONFIG,
  MOVING_AVERAGE_CONFIG,
  TECHNICAL_ANALYSIS_CONFIG,
} from "../constants/technicalAnalysis";
import {
  generateRSISignal,
  generateMACDSignal,
  generateBollingerBandsSignal,
  generateMovingAverageCrossSignal,
} from "./signalGenerators";

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
  if (data.length < TECHNICAL_ANALYSIS_CONFIG.minimumDataPoints) {
    logger.warn("Insufficient data for technical analysis", {
      dataLength: data.length,
      minimumRequired: TECHNICAL_ANALYSIS_CONFIG.minimumDataPoints,
    });
    return null;
  }

  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);

  try {
    // RSI
    const rsiResult = RSI.calculate({ values: closes, period: RSI_CONFIG.period });
    const rsi = rsiResult[rsiResult.length - 1];

    // MACD
    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: MACD_CONFIG.fastPeriod,
      slowPeriod: MACD_CONFIG.slowPeriod,
      signalPeriod: MACD_CONFIG.signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const macd = macdResult[macdResult.length - 1];

    // Bollinger Bands
    const bbResult = BollingerBands.calculate({
      values: closes,
      period: BOLLINGER_BANDS_CONFIG.period,
      stdDev: BOLLINGER_BANDS_CONFIG.stdDev,
    });
    const bb = bbResult[bbResult.length - 1];

    // 移動平均線
    const sma20Result = SMA.calculate({ values: closes, period: MOVING_AVERAGE_CONFIG.shortSmaPeriod });
    const sma20 = sma20Result[sma20Result.length - 1];

    const sma50Result = SMA.calculate({ values: closes, period: MOVING_AVERAGE_CONFIG.longSmaPeriod });
    const sma50 = sma50Result[sma50Result.length - 1];

    const ema12Result = EMA.calculate({ values: closes, period: MOVING_AVERAGE_CONFIG.shortEmaPeriod });
    const ema12 = ema12Result[ema12Result.length - 1];

    const ema26Result = EMA.calculate({ values: closes, period: MOVING_AVERAGE_CONFIG.longEmaPeriod });
    const ema26 = ema26Result[ema26Result.length - 1];

    // 出来高移動平均
    const volumeSmaResult = SMA.calculate({ values: volumes, period: MOVING_AVERAGE_CONFIG.volumePeriod });
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
 * 各指標のシグナル生成関数を使用して明確で保守しやすい実装
 */
export const generateTradingSignals = (
  analysis: AnalysisResult,
  currentPrice: number,
  previousAnalysis?: AnalysisResult,
): SignalResult[] => {
  const signals: SignalResult[] = [];

  // 各指標のシグナル生成関数を呼び出し
  const signalGenerators = [
    () => generateRSISignal(analysis),
    () => generateMACDSignal(analysis, previousAnalysis),
    () => generateBollingerBandsSignal(analysis, currentPrice),
    () => generateMovingAverageCrossSignal(analysis, previousAnalysis),
  ];

  // 各シグナル生成関数を実行し、結果をまとめる
  for (const generateSignal of signalGenerators) {
    try {
      const signal = generateSignal();
      if (signal) {
        signals.push(signal);
      }
    } catch (error) {
      logger.error("technicalAnalysis", "Error generating signal", error);
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
