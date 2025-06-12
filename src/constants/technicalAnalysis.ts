/**
 * 実戦レベルのテクニカル分析指標設定（6指標システム）
 * 短期トレード用（1m-5m足想定）
 * Solana系ミームや高cap altのボラを前提とした実戦的な閾値
 */

// VWAP Deviation（乖離率）設定
export const VWAP_DEVIATION_CONFIG = {
  /** 通常ノイズ範囲（±1%） */
  normalRange: 1.0,
  /** アクション要検討（±2%） */
  actionZone: 2.0,
  /** 極値レベル（±3-4%） */
  extremeZone: 3.0,
  /** 部分利確開始（+2%） */
  partialProfitThreshold: 2.0,
  /** 全利確検討（+3%） */
  fullProfitThreshold: 3.0,
  /** 押し目買い候補（-2%） */
  buyDipThreshold: -2.0,
} as const;

// OBV Δσ (z-score) 設定
export const OBV_ZSCORE_CONFIG = {
  /** 計算期間 */
  period: 20,
  /** 中立範囲（±1σ） */
  neutralRange: 1.0,
  /** 強いフロー（±2σ） */
  strongFlowThreshold: 2.0,
  /** 極端なフロー（±3σ） */
  extremeFlowThreshold: 3.0,
  /** 仕込み期アラート（+2σ） */
  buyPrepThreshold: 2.0,
  /** 手仕舞い警告（-2σ） */
  sellWarningThreshold: -2.0,
} as const;

// %B (Bollinger Bands内位置) 設定
export const PERCENT_B_CONFIG = {
  /** BB期間 */
  period: 20,
  /** BB標準偏差 */
  stdDev: 2,
  /** 下限（0.00） */
  lowerBound: 0.0,
  /** 中央（0.50） */
  middle: 0.5,
  /** 上限（1.00） */
  upperBound: 1.0,
  /** 帯外上（>1.0）でブレイクアウト */
  outsideUpperThreshold: 1.0,
  /** 帯外下（<0.0）で押し目 */
  outsideLowerThreshold: 0.0,
} as const;

// ATR% (14) 設定
export const ATR_PERCENT_CONFIG = {
  /** ATR期間 */
  period: 14,
  /** SOLミーム通常範囲（1-3%） */
  normalRange: { min: 1.0, max: 3.0 },
  /** 高ボラティリティ警告（5%以上） */
  highVolatilityThreshold: 5.0,
  /** ストップ設定倍数 */
  stopMultiplier: 1.5,
} as const;

// ADX (14) 設定
export const ADX_CONFIG = {
  /** ADX期間 */
  period: 14,
  /** レンジ相場（0-20） */
  rangeThreshold: 20,
  /** トレンド発達中（20-25） */
  trendDevelopingRange: { min: 20, max: 25 },
  /** 確立されたトレンド（25-40） */
  establishedTrendRange: { min: 25, max: 40 },
  /** 過熱レベル（40以上） */
  overheatedThreshold: 40,
  /** トレンドモード発動 */
  trendModeThreshold: 25,
} as const;

// RSI (9) 設定
export const RSI_CONFIG = {
  /** RSI計算期間（短期デイトレ用） */
  period: 9,
  /** 売られすぎ閾値（30） */
  oversoldThreshold: 30,
  /** 買われすぎ閾値（70） */
  overboughtThreshold: 70,
  /** モメンタム転換ライン（50） */
  momentumShiftLine: 50,
} as const;

// 実戦ワークフロー設定
export const TRADING_WORKFLOW_CONFIG = {
  /** 最小データ数 */
  minimumDataPoints: 50,
  /** 信頼度レベル */
  confidenceLevels: {
    high: 0.8,
    medium: 0.6,
    low: 0.4,
  },
} as const;

// 実戦的なトレーディングルール
export const TRADING_RULES = {
  // VWAP乖離率ルール
  vwapDeviation: {
    partialProfit: 2.0, // VWAP>+2% で部分利確
    fullProfit: 3.0, // VWAP>+3% で全利確検討
    buyDip: -2.0, // VWAP<-2% で押し目買い候補
  },
  // OBV z-scoreルール
  obvFlow: {
    accumulationAlert: 2.0, // OBV>+2σ で仕込み期アラート
    distributionWarning: -2.0, // OBV<-2σ で手仕舞い警告
  },
  // %Bルール
  percentB: {
    breakoutBuy: 1.0, // %B>1 でブレイクアウト買い
    reversalBuy: 0.0, // %B<0 で逆張り買い
  },
  // ADXルール
  adx: {
    trendMode: 25, // ADX>25 でトレンドモード（逆張り無効）
    rangeMode: 20, // ADX<20 でレンジモード（RSI逆張り有効）
  },
  // RSIルール
  rsi: {
    overbought: 70, // RSI>70 で買われすぎ
    oversold: 30, // RSI<30 で売られすぎ
    momentum: 50, // RSI=50 でモメンタム転換
  },
} as const;

// シグナル強度タイプ
export type SignalStrength = "WEAK" | "MODERATE" | "STRONG";

// 実戦的なアクション
export type TradingAction =
  | "BUY" // 買い
  | "SELL_PART" // 部分利確
  | "SELL_ALL" // 全利確
  | "HOLD" // 様子見
  | "BUY_PREP" // 仕込み期アラート
  | "SELL_WARNING" // 手仕舞い警告
  | "BREAKOUT_BUY" // ブレイクアウト買い
  | "REVERSAL_BUY"; // 逆張り買い
