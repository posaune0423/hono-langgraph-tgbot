import { z } from "zod";
import type { SignalGraphState } from "../graph-state";
import { createSignalModel } from "../model";
import { signalAnalysisPrompt } from "../prompts/signal-analysis";
import { logger } from "../../../utils/logger";

/**
 * LLM Signal Analysis Schema
 * LLMからの構造化出力を検証するためのZodスキーマ
 */
const SignalAnalysisSchema = z.object({
  shouldGenerateSignal: z.boolean(),
  signalType: z.string(),
  direction: z.enum(["BUY", "SELL", "NEUTRAL"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  keyFactors: z.array(z.string()).max(3),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  timeframe: z.enum(["SHORT", "MEDIUM", "LONG"]),
});

/**
 * 静的フィルタで除外された場合のデフォルトレスポンス
 */
const createRejectedSignalResponse = (state: SignalGraphState) => ({
  signalDecision: {
    shouldGenerateSignal: false,
    signalType: "NO_SIGNAL",
    direction: "NEUTRAL" as const,
    confidence: 0,
    reasoning: "Insufficient technical confluence for signal generation",
    keyFactors: [],
    riskLevel: "LOW" as const,
    timeframe: "SHORT" as const,
  },
});

/**
 * LLM分析失敗時のフォールバックレスポンス
 */
const createFallbackSignalResponse = (state: SignalGraphState) => ({
  signalDecision: {
    shouldGenerateSignal: true,
    signalType: state.staticFilterResult!.signalCandidates[0] || "TECHNICAL_ALERT",
    direction: "NEUTRAL" as const,
    confidence: state.staticFilterResult!.confluenceScore,
    reasoning: "LLM analysis failed, falling back to technical indicators",
    keyFactors: state.staticFilterResult!.triggeredIndicators.slice(0, 3),
    riskLevel: state.staticFilterResult!.riskLevel,
    timeframe: "SHORT" as const,
  },
});

/**
 * LLM Analysis Node
 *
 * 複合的なテクニカル指標分析によるシグナル生成判定
 * 静的フィルタを通過した場合のみ実行される
 */
export const analyzeLLMSignal = async (state: SignalGraphState) => {
  // 静的フィルタで除外された場合は早期リターン
  if (!state.staticFilterResult?.shouldProceed) {
    logger.info("Static filter rejected signal generation", {
      tokenAddress: state.tokenAddress,
      confluenceScore: state.staticFilterResult?.confluenceScore,
    });
    return createRejectedSignalResponse(state);
  }

  logger.info("Performing LLM signal analysis", {
    tokenAddress: state.tokenAddress,
    triggeredIndicators: state.staticFilterResult.triggeredIndicators,
  });

  const llm = createSignalModel().withStructuredOutput(SignalAnalysisSchema);

  try {
    const result = await llm.invoke(
      await signalAnalysisPrompt.format({
        tokenSymbol: state.tokenSymbol,
        tokenAddress: state.tokenAddress,
        currentPrice: state.currentPrice.toString(),
        timestamp: new Date().toISOString(),
        rsi: state.technicalAnalysis.rsi?.toString() || "N/A",
        vwapDeviation: state.technicalAnalysis.vwap_deviation?.toString() || "N/A",
        percentB: state.technicalAnalysis.percent_b?.toString() || "N/A",
        adx: state.technicalAnalysis.adx?.toString() || "N/A",
        atrPercent: state.technicalAnalysis.atr_percent?.toString() || "N/A",
        obvZScore: state.technicalAnalysis.obv_zscore?.toString() || "N/A",
        triggeredIndicators: state.staticFilterResult.triggeredIndicators.join(", "),
        signalCandidates: state.staticFilterResult.signalCandidates.join(", "),
        confluenceScore: state.staticFilterResult.confluenceScore.toFixed(3),
        riskLevel: state.staticFilterResult.riskLevel,
      }),
    );

    logger.info("LLM signal analysis completed", {
      tokenAddress: state.tokenAddress,
      shouldGenerateSignal: result.shouldGenerateSignal,
      signalType: result.signalType,
      confidence: result.confidence,
    });

    return { signalDecision: result };
  } catch (error) {
    logger.error("LLM signal analysis failed", {
      tokenAddress: state.tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to technical-only signal
    return createFallbackSignalResponse(state);
  }
};
