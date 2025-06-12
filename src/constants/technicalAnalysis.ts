/**
 * テクニカル分析の閾値・定数管理
 * 各指標の設定値を一元管理してチューニングしやすくする
 */

// RSI設定
export const RSI_CONFIG = {
  /** RSI計算期間 */
  period: 14,
  /** 売られすぎ閾値 */
  oversoldThreshold: 30,
  /** 買われすぎ閾値 */
  overboughtThreshold: 70,
  /** 強いシグナルとする売られすぎ閾値 */
  strongOversoldThreshold: 20,
  /** 強いシグナルとする買われすぎ閾値 */
  strongOverboughtThreshold: 80,
} as const;

// MACD設定
export const MACD_CONFIG = {
  /** 短期移動平均期間 */
  fastPeriod: 12,
  /** 長期移動平均期間 */
  slowPeriod: 26,
  /** シグナル線期間 */
  signalPeriod: 9,
  /** 強いシグナルとするヒストグラム閾値 */
  strongHistogramThreshold: 0.01,
} as const;

// Bollinger Bands設定
export const BOLLINGER_BANDS_CONFIG = {
  /** 移動平均期間 */
  period: 20,
  /** 標準偏差倍数 */
  stdDev: 2,
} as const;

// 移動平均線設定
export const MOVING_AVERAGE_CONFIG = {
  /** 短期SMA期間 */
  shortSmaPeriod: 20,
  /** 長期SMA期間 */
  longSmaPeriod: 50,
  /** 短期EMA期間 */
  shortEmaPeriod: 12,
  /** 長期EMA期間 */
  longEmaPeriod: 26,
  /** 出来高移動平均期間 */
  volumePeriod: 20,
} as const;

// テクニカル分析全体設定
export const TECHNICAL_ANALYSIS_CONFIG = {
  /** 最小データ数（分析に必要な最小データポイント数） */
  minimumDataPoints: 50,
} as const;

// シグナル強度タイプ
export type SignalStrength = "WEAK" | "MODERATE" | "STRONG";

// シグナルタイプ
export type SignalType = "BUY" | "SELL" | "HOLD";
