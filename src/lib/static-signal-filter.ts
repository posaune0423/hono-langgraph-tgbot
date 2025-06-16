import { SIGNAL_THRESHOLDS, SIGNAL_TYPES } from "../constants/signal-thresholds";
import type { TechnicalAnalysis } from "../db/schema/technical-analysis";
import { logger } from "../utils/logger";

export interface StaticFilterResult {
  shouldProceed: boolean;
  triggeredIndicators: string[];
  signalCandidates: string[];
  confluenceScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

/**
 * 静的事前フィルタ：LLM呼び出し前にテクニカル指標をチェック
 * コスト効率のため、明らかに閾値を超えていない場合は早期リターン
 */
export const applyStaticSignalFilter = (tokenAddress: string, analysis: TechnicalAnalysis): StaticFilterResult => {
  const triggeredIndicators: string[] = [];
  const signalCandidates: string[] = [];
  let confluenceScore = 0;

  const thresholds = SIGNAL_THRESHOLDS.STATIC_FILTERS;

  // RSI極値チェック
  if (analysis.rsi !== null) {
    const rsiValue = parseFloat(analysis.rsi);
    if (rsiValue <= thresholds.RSI_EXTREME.CRITICAL_OVERSOLD) {
      triggeredIndicators.push("RSI_CRITICAL_OVERSOLD");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.RSI_OVERSOLD);
      confluenceScore += 0.25;
    } else if (rsiValue <= thresholds.RSI_EXTREME.OVERSOLD) {
      triggeredIndicators.push("RSI_OVERSOLD");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.RSI_OVERSOLD);
      confluenceScore += 0.15;
    } else if (rsiValue >= thresholds.RSI_EXTREME.CRITICAL_OVERBOUGHT) {
      triggeredIndicators.push("RSI_CRITICAL_OVERBOUGHT");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.RSI_OVERBOUGHT);
      confluenceScore += 0.25;
    } else if (rsiValue >= thresholds.RSI_EXTREME.OVERBOUGHT) {
      triggeredIndicators.push("RSI_OVERBOUGHT");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.RSI_OVERBOUGHT);
      confluenceScore += 0.15;
    }
  }

  // VWAP乖離率チェック
  if (analysis.vwap_deviation !== null) {
    const vwapDeviationValue = parseFloat(analysis.vwap_deviation);
    const absDeviation = Math.abs(vwapDeviationValue);
    if (absDeviation >= thresholds.VWAP_DEVIATION.EXTREME) {
      triggeredIndicators.push("VWAP_EXTREME_DEVIATION");
      signalCandidates.push(
        vwapDeviationValue > 0 ? SIGNAL_TYPES.TECHNICAL.VWAP_DEVIATION_HIGH : SIGNAL_TYPES.TECHNICAL.VWAP_DEVIATION_LOW,
      );
      confluenceScore += 0.3;
    } else if (absDeviation >= thresholds.VWAP_DEVIATION.SIGNIFICANT) {
      triggeredIndicators.push("VWAP_SIGNIFICANT_DEVIATION");
      signalCandidates.push(
        vwapDeviationValue > 0 ? SIGNAL_TYPES.TECHNICAL.VWAP_DEVIATION_HIGH : SIGNAL_TYPES.TECHNICAL.VWAP_DEVIATION_LOW,
      );
      confluenceScore += 0.2;
    }
  }

  // Bollinger Bands %B チェック
  if (analysis.percent_b !== null) {
    const percentBValue = parseFloat(analysis.percent_b);
    if (percentBValue >= thresholds.PERCENT_B.BREAKOUT_UPPER) {
      triggeredIndicators.push("BOLLINGER_BREAKOUT_UP");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.BOLLINGER_BREAKOUT_UP);
      confluenceScore += 0.2;
    } else if (percentBValue <= thresholds.PERCENT_B.BREAKOUT_LOWER) {
      triggeredIndicators.push("BOLLINGER_BREAKOUT_DOWN");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.BOLLINGER_BREAKOUT_DOWN);
      confluenceScore += 0.2;
    } else if (percentBValue >= thresholds.PERCENT_B.OVERBOUGHT) {
      triggeredIndicators.push("BOLLINGER_OVERBOUGHT");
      confluenceScore += 0.1;
    } else if (percentBValue <= thresholds.PERCENT_B.OVERSOLD) {
      triggeredIndicators.push("BOLLINGER_OVERSOLD");
      confluenceScore += 0.1;
    }
  }

  // ADX トレンド強度チェック
  if (analysis.adx !== null) {
    const adxValue = parseFloat(analysis.adx);
    if (adxValue >= thresholds.ADX_STRENGTH.OVERHEATED) {
      triggeredIndicators.push("ADX_OVERHEATED");
      confluenceScore += 0.15;
    } else if (adxValue >= thresholds.ADX_STRENGTH.ESTABLISHED) {
      triggeredIndicators.push("ADX_STRONG_TREND");
      confluenceScore += 0.1;
    }
  }

  // ATR% ボラティリティチェック
  if (analysis.atr_percent !== null) {
    const atrPercentValue = parseFloat(analysis.atr_percent);
    if (atrPercentValue >= thresholds.ATR_VOLATILITY.EXTREME) {
      triggeredIndicators.push("ATR_EXTREME_VOLATILITY");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.HIGH_VOLATILITY);
      confluenceScore += 0.1;
    } else if (atrPercentValue >= thresholds.ATR_VOLATILITY.HIGH) {
      triggeredIndicators.push("ATR_HIGH_VOLATILITY");
      confluenceScore += 0.05;
    }
  }

  // OBV Z-Score チェック
  if (analysis.obv_zscore !== null) {
    const obvZScoreValue = parseFloat(analysis.obv_zscore);
    const absZScore = Math.abs(obvZScoreValue);
    if (absZScore >= thresholds.OBV_Z_SCORE.EXTREME) {
      triggeredIndicators.push("OBV_EXTREME_DIVERGENCE");
      signalCandidates.push(SIGNAL_TYPES.TECHNICAL.VOLUME_SPIKE);
      confluenceScore += 0.1;
    } else if (absZScore >= thresholds.OBV_Z_SCORE.STRONG) {
      triggeredIndicators.push("OBV_STRONG_DIVERGENCE");
      confluenceScore += 0.05;
    }
  }

  // リスクレベル判定
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (confluenceScore >= 0.5) {
    riskLevel = "HIGH";
  } else if (confluenceScore >= 0.3) {
    riskLevel = "MEDIUM";
  }

  // 最終判定：LLM呼び出しが必要かどうか
  const shouldProceed =
    confluenceScore >= 0.2 && // 最低限の閾値
    triggeredIndicators.length >= SIGNAL_THRESHOLDS.LLM_TRIGGERS.CONFLUENCE_REQUIRED;

  logger.info("Static signal filter applied", {
    tokenAddress,
    triggeredIndicators,
    signalCandidates,
    confluenceScore: confluenceScore.toFixed(3),
    riskLevel,
    shouldProceed,
  });

  return {
    shouldProceed,
    triggeredIndicators,
    signalCandidates,
    confluenceScore,
    riskLevel,
  };
};
