import { RSI, ATR, ADX, BollingerBands, VWAP, OBV } from "technicalindicators";
import { logger } from "../utils/logger";
import { generateId } from "../utils/id";
import type { NewTechnicalAnalysis, NewTradingSignal } from "../db";
import {
  OBV_ZSCORE_CONFIG,
  PERCENT_B_CONFIG,
  ATR_PERCENT_CONFIG,
  ADX_CONFIG,
  RSI_CONFIG,
  TRADING_WORKFLOW_CONFIG,
  type TradingAction,
} from "../constants/technicalAnalysis";

export type OHLCVData = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PracticalAnalysisResult = {
  vwap?: number;
  vwapDeviation?: number; // VWAP乖離率 (%)
  obv?: number;
  obvZScore?: number; // OBV z-score (Δσ)
  percentB?: number; // %B (BB内位置 0-1)
  bbWidth?: number; // BB幅
  atr?: number;
  atrPercent?: number; // ATR% (ATR/close * 100)
  adx?: number;
  adxDirection?: "UP" | "DOWN" | "NEUTRAL";
  rsi?: number; // RSI (9期間)
};

export type PracticalSignalResult = {
  action: TradingAction;
  indicator: string;
  confidence: number; // 0-1 の信頼度
  message: string;
  metadata: Record<string, any>;
};

/**
 * VWAP（Volume Weighted Average Price）をtechnicalindicatorsライブラリで計算
 */
export const calculateVWAP = (data: OHLCVData[]): number | undefined => {
  try {
    if (data.length === 0) return undefined;

    const vwapResult = VWAP.calculate({
      high: data.map((d) => d.high),
      low: data.map((d) => d.low),
      close: data.map((d) => d.close),
      volume: data.map((d) => d.volume),
    });

    return vwapResult[vwapResult.length - 1];
  } catch (error) {
    logger.error("Failed to calculate VWAP", error);
    return undefined;
  }
};

/**
 * VWAP乖離率（%）を計算
 */
const calculateVWAPDeviation = (currentPrice: number, vwap: number): number => {
  return ((currentPrice - vwap) / vwap) * 100;
};

/**
 * OBV（On Balance Volume）をtechnicalindicatorsライブラリで計算
 */
export const calculateOBV = (data: OHLCVData[]): number | undefined => {
  try {
    if (data.length < 2) return undefined;

    const obvResult = OBV.calculate({
      close: data.map((d) => d.close),
      volume: data.map((d) => d.volume),
    });

    return obvResult[obvResult.length - 1];
  } catch (error) {
    logger.error("Failed to calculate OBV", error);
    return undefined;
  }
};

/**
 * OBVの全履歴を計算（z-score算出用）- technicalindicatorsライブラリ使用
 */
const calculateOBVHistory = (data: OHLCVData[]): number[] => {
  if (data.length < 2) return [];

  try {
    const obvResult = OBV.calculate({
      close: data.map((d) => d.close),
      volume: data.map((d) => d.volume),
    });

    return obvResult;
  } catch (error) {
    logger.error("Failed to calculate OBV history", error);
    return [];
  }
};

/**
 * OBVのz-score（Δσ）を計算
 */
const calculateOBVZScore = (obvHistory: number[]): number | undefined => {
  if (obvHistory.length < OBV_ZSCORE_CONFIG.period) return undefined;

  try {
    const recentValues = obvHistory.slice(-OBV_ZSCORE_CONFIG.period);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const currentOBV = obvHistory[obvHistory.length - 1];
    return (currentOBV - mean) / stdDev;
  } catch (error) {
    logger.error("Failed to calculate OBV z-score", error);
    return undefined;
  }
};

/**
 * %B（Bollinger Bands内での位置）を計算
 * %B = (Price - Lower Band) / (Upper Band - Lower Band)
 */
const calculatePercentB = (data: OHLCVData[]): { percentB?: number; bbWidth?: number } => {
  try {
    const closes = data.map((d) => d.close);
    const bbResult = BollingerBands.calculate({
      values: closes,
      period: PERCENT_B_CONFIG.period,
      stdDev: PERCENT_B_CONFIG.stdDev,
    });

    const bb = bbResult[bbResult.length - 1];
    if (!bb) return {};

    const currentPrice = closes[closes.length - 1];
    const percentB = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    const bbWidth = (bb.upper - bb.lower) / bb.middle;

    return { percentB, bbWidth };
  } catch (error) {
    logger.error("Failed to calculate %B", error);
    return {};
  }
};

/**
 * ATR（Average True Range）を計算
 */
const calculateATR = (data: OHLCVData[]): number | undefined => {
  try {
    const atrResult = ATR.calculate({
      high: data.map((d) => d.high),
      low: data.map((d) => d.low),
      close: data.map((d) => d.close),
      period: ATR_PERCENT_CONFIG.period,
    });

    return atrResult[atrResult.length - 1];
  } catch (error) {
    logger.error("Failed to calculate ATR", error);
    return undefined;
  }
};

/**
 * ATR%（ATR/close * 100）を計算
 */
const calculateATRPercent = (atr: number, currentPrice: number): number => {
  return (atr / currentPrice) * 100;
};

/**
 * ADX（Average Directional Index）を計算
 */
const calculateADX = (data: OHLCVData[]): { adx?: number; direction?: "UP" | "DOWN" | "NEUTRAL" } => {
  try {
    const adxResult = ADX.calculate({
      high: data.map((d) => d.high),
      low: data.map((d) => d.low),
      close: data.map((d) => d.close),
      period: ADX_CONFIG.period,
    });

    const adxValue = adxResult[adxResult.length - 1];
    if (!adxValue) return {};

    // ADXの結果を数値に変換
    const adxNumber = typeof adxValue === "number" ? adxValue : adxValue.adx;

    // ADX direction determination (simplified)
    const recentCloses = data.slice(-3).map((d) => d.close);
    let direction: "UP" | "DOWN" | "NEUTRAL" = "NEUTRAL";

    if (recentCloses.length >= 3) {
      const trend = recentCloses[2] - recentCloses[0];
      if (trend > 0) direction = "UP";
      else if (trend < 0) direction = "DOWN";
    }

    return { adx: adxNumber, direction };
  } catch (error) {
    logger.error("Failed to calculate ADX", error);
    return {};
  }
};

/**
 * RSI（9期間）を計算
 */
const calculateRSI9 = (closes: number[]): number | undefined => {
  try {
    const rsiResult = RSI.calculate({
      values: closes,
      period: RSI_CONFIG.period,
    });

    return rsiResult[rsiResult.length - 1];
  } catch (error) {
    logger.error("Failed to calculate RSI", error);
    return undefined;
  }
};

/**
 * 6つの実用的指標を計算
 */
export const calculateTechnicalIndicators = (data: OHLCVData[]): PracticalAnalysisResult | null => {
  if (data.length < TRADING_WORKFLOW_CONFIG.minimumDataPoints) {
    logger.warn(`Insufficient data points: ${data.length} < ${TRADING_WORKFLOW_CONFIG.minimumDataPoints}`);
    return null;
  }

  try {
    const currentPrice = data[data.length - 1].close;
    const closes = data.map((d) => d.close);

    // 1. VWAP & VWAP乖離率
    const vwap = calculateVWAP(data);
    const vwapDeviation = vwap ? calculateVWAPDeviation(currentPrice, vwap) : undefined;

    // 2. OBV & OBV z-score
    const obvHistory = calculateOBVHistory(data);
    const obv = obvHistory.length > 0 ? obvHistory[obvHistory.length - 1] : undefined;
    const obvZScore = calculateOBVZScore(obvHistory);

    // 3. %B (Bollinger Bands position)
    const { percentB, bbWidth } = calculatePercentB(data);

    // 4. ATR & ATR%
    const atr = calculateATR(data);
    const atrPercent = atr ? calculateATRPercent(atr, currentPrice) : undefined;

    // 5. ADX & Direction
    const { adx, direction: adxDirection } = calculateADX(data);

    // 6. RSI (9)
    const rsi = calculateRSI9(closes);

    return {
      vwap,
      vwapDeviation,
      obv,
      obvZScore,
      percentB,
      bbWidth,
      atr,
      atrPercent,
      adx,
      adxDirection,
      rsi,
    };
  } catch (error) {
    logger.error("Failed to calculate practical indicators", error);
    return null;
  }
};

/**
 * 分析結果をDB形式に変換
 */
export const convertPracticalToDbFormat = (
  token: string,
  timestamp: number,
  analysis: PracticalAnalysisResult,
): NewTechnicalAnalysis => {
  return {
    id: generateId(),
    token,
    timestamp,
    vwap: analysis.vwap?.toString(),
    vwap_deviation: analysis.vwapDeviation?.toString(),
    obv: analysis.obv?.toString(),
    obv_zscore: analysis.obvZScore?.toString(),
    percent_b: analysis.percentB?.toString(),
    bb_width: analysis.bbWidth?.toString(),
    atr: analysis.atr?.toString(),
    atr_percent: analysis.atrPercent?.toString(),
    adx: analysis.adx?.toString(),
    adx_direction: analysis.adxDirection,
    rsi: analysis.rsi?.toString(),
  };
};

/**
 * シグナルをDB形式に変換
 */
export const convertPracticalSignalToDbFormat = (
  token: string,
  timestamp: number,
  price: number,
  signal: PracticalSignalResult,
): NewTradingSignal => {
  return {
    id: generateId(),
    token,
    signal_type: signal.action,
    indicator: signal.indicator,
    strength: signal.confidence >= 0.8 ? "STRONG" : signal.confidence >= 0.6 ? "MODERATE" : "WEAK",
    price: price.toString(),
    message: signal.message,
    metadata: signal.metadata,
    timestamp,
  };
};
