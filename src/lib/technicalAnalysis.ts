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
 * RSI指標を計算する
 */
const calculateRSI = (closes: number[]): number | undefined => {
  try {
    const rsiResult = RSI.calculate({ values: closes, period: RSI_CONFIG.period });
    return rsiResult[rsiResult.length - 1];
  } catch (error) {
    logger.error("Failed to calculate RSI", error);
    return undefined;
  }
};

/**
 * MACD指標を計算する
 */
const calculateMACD = (closes: number[]): AnalysisResult["macd"] => {
  try {
    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: MACD_CONFIG.fastPeriod,
      slowPeriod: MACD_CONFIG.slowPeriod,
      signalPeriod: MACD_CONFIG.signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const macd = macdResult[macdResult.length - 1];

    return macd && macd.MACD !== undefined && macd.signal !== undefined && macd.histogram !== undefined
      ? {
          macd: macd.MACD,
          signal: macd.signal,
          histogram: macd.histogram,
        }
      : undefined;
  } catch (error) {
    logger.error("Failed to calculate MACD", error);
    return undefined;
  }
};

/**
 * Bollinger Bands指標を計算する
 */
const calculateBollingerBands = (closes: number[]): AnalysisResult["bollingerBands"] => {
  try {
    const bbResult = BollingerBands.calculate({
      values: closes,
      period: BOLLINGER_BANDS_CONFIG.period,
      stdDev: BOLLINGER_BANDS_CONFIG.stdDev,
    });
    const bb = bbResult[bbResult.length - 1];

    return bb && bb.upper !== undefined && bb.middle !== undefined && bb.lower !== undefined
      ? {
          upper: bb.upper,
          middle: bb.middle,
          lower: bb.lower,
        }
      : undefined;
  } catch (error) {
    logger.error("Failed to calculate Bollinger Bands", error);
    return undefined;
  }
};

/**
 * 移動平均線（SMA）を計算する
 */
const calculateSMA = (closes: number[], period: number): number | undefined => {
  try {
    const smaResult = SMA.calculate({ values: closes, period });
    return smaResult[smaResult.length - 1];
  } catch (error) {
    logger.error(`Failed to calculate SMA${period}`, error);
    return undefined;
  }
};

/**
 * 指数移動平均線（EMA）を計算する
 */
const calculateEMA = (closes: number[], period: number): number | undefined => {
  try {
    const emaResult = EMA.calculate({ values: closes, period });
    return emaResult[emaResult.length - 1];
  } catch (error) {
    logger.error(`Failed to calculate EMA${period}`, error);
    return undefined;
  }
};

/**
 * 出来高移動平均を計算する
 */
const calculateVolumeSMA = (volumes: number[]): number | undefined => {
  try {
    const volumeSmaResult = SMA.calculate({ values: volumes, period: MOVING_AVERAGE_CONFIG.volumePeriod });
    return volumeSmaResult[volumeSmaResult.length - 1];
  } catch (error) {
    logger.error("Failed to calculate Volume SMA", error);
    return undefined;
  }
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
    return {
      rsi: calculateRSI(closes),
      macd: calculateMACD(closes),
      bollingerBands: calculateBollingerBands(closes),
      sma20: calculateSMA(closes, MOVING_AVERAGE_CONFIG.shortSmaPeriod),
      sma50: calculateSMA(closes, MOVING_AVERAGE_CONFIG.longSmaPeriod),
      ema12: calculateEMA(closes, MOVING_AVERAGE_CONFIG.shortEmaPeriod),
      ema26: calculateEMA(closes, MOVING_AVERAGE_CONFIG.longEmaPeriod),
      volumeSma: calculateVolumeSMA(volumes),
    };
  } catch (error) {
    logger.error("technicalAnalysis", "Error calculating technical indicators", error);
    return null;
  }
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
