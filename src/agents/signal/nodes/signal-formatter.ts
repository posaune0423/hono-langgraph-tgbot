import { z } from "zod";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";
import { createSignalModel } from "../model";
import { signalFormattingPrompt } from "../prompts/signal-analysis";

/**
 * Signal Formatting Schema
 * LLMからの構造化出力を検証するためのZodスキーマ
 */
const SignalFormattingSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string(),
  message: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  tags: z.array(z.string()),
});

/**
 * シグナル生成不要時のデフォルトレスポンス
 */
const createNoSignalResponse = () => ({
  finalSignal: {
    level: 1 as const,
    title: "🔍 Market Monitoring",
    message: `🔍 **MARKET MONITORING**

📋 **RECOMMENDED ACTION**: HOLD AND MONITOR

📊 **Status**: No clear signal detected
📈 **Direction**: NEUTRAL
⚡ **Confidence**: Insufficient data

🔍 **TECHNICAL ANALYSIS**
Current market conditions do not meet the criteria for generating a trading signal. Technical indicators are either conflicting or showing neutral patterns.

⚠️ **RISK MANAGEMENT**
• **Risk Level**: LOW
• **Timeframe**: ONGOING
• **Note**: Continue monitoring for clearer market direction. No action required at this time.`,
    priority: "LOW" as const,
    tags: ["no-signal", "monitoring"],
  },
});

/**
 * フォーマット失敗時のフォールバックレスポンス
 */
const createFallbackResponse = (state: SignalGraphState) => ({
  finalSignal: {
    level: 1 as const,
    title: `🚀 $${state.tokenSymbol}`,
    message: createFallbackMessage(state),
    priority: state.signalDecision!.riskLevel === "HIGH" ? ("HIGH" as const) : ("MEDIUM" as const),
    tags: [state.tokenSymbol.toLowerCase(), state.signalDecision!.signalType.toLowerCase()],
  },
});

/**
 * テクニカルデータを読みやすい形式にフォーマット
 */
const formatTechnicalData = (state: SignalGraphState): string => {
  const ta = state.technicalAnalysis;
  return `
- RSI: ${ta.rsi || "N/A"}
- VWAP Deviation: ${ta.vwap_deviation || "N/A"}%
- Bollinger %B: ${ta.percent_b || "N/A"}
- ADX: ${ta.adx || "N/A"}
- ATR%: ${ta.atr_percent || "N/A"}%
- OBV Z-Score: ${ta.obv_zscore || "N/A"}
  `.trim();
};

/**
 * フォールバック用のシンプルなメッセージを生成
 */
const createFallbackMessage = (state: SignalGraphState): string => {
  const { signalDecision, tokenSymbol, currentPrice } = state;

  // アクションの決定
  const getRecommendedAction = (direction: string, riskLevel: string) => {
    if (direction === "BUY") {
      return riskLevel === "HIGH" ? "MONITOR CLOSELY - Consider BUY" : "BUY NOW";
    }
    if (direction === "SELL") {
      return riskLevel === "HIGH" ? "SELL POSITION" : "CONSIDER SELLING";
    }
    return "HOLD AND MONITOR";
  };

  const recommendedAction = getRecommendedAction(
    signalDecision?.direction || "NEUTRAL",
    signalDecision?.riskLevel || "MEDIUM",
  );

  return `🚀 **$${tokenSymbol}**

📋 **RECOMMENDED ACTION**: ${recommendedAction}

📊 **Signal**: ${signalDecision?.signalType}
📈 **Direction**: ${signalDecision?.direction}
💰 **Price**: $${currentPrice}
⚡ **Confidence**: ${Math.round((signalDecision?.confidence || 0) * 100)}%

🔍 **TECHNICAL ANALYSIS**
${signalDecision?.reasoning}

Key factors supporting this signal:
${signalDecision?.keyFactors?.map((factor) => `• ${factor}`).join("\n") || "• Technical confluence detected"}

⚠️ **RISK MANAGEMENT**
• **Risk Level**: ${signalDecision?.riskLevel}
• **Timeframe**: ${signalDecision?.timeframe}
• **Note**: This is an automated technical signal. Always do your own research and manage risk accordingly.`;
};

/**
 * Signal Formatter Node
 *
 * ユーザー向けのTelegramメッセージ形式でシグナルを整形
 * 分析結果を分かりやすく実用的な形式に変換
 */
export const formatSignal = async (state: SignalGraphState) => {
  // シグナル生成が不要な場合は早期リターン
  if (!state.signalDecision?.shouldGenerateSignal) {
    logger.info("No signal to format", { tokenAddress: state.tokenAddress });
    return createNoSignalResponse();
  }

  logger.info("Formatting signal for user", {
    tokenAddress: state.tokenAddress,
    signalType: state.signalDecision.signalType,
  });

  const llm = createSignalModel().withStructuredOutput(SignalFormattingSchema);

  try {
    const result = await llm.invoke(
      await signalFormattingPrompt.format({
        tokenSymbol: state.tokenSymbol,
        signalType: state.signalDecision.signalType,
        direction: state.signalDecision.direction,
        currentPrice: state.currentPrice.toString(),
        confidence: Math.round(state.signalDecision.confidence * 100).toString(),
        riskLevel: state.signalDecision.riskLevel,
        timeframe: state.signalDecision.timeframe,
        reasoning: state.signalDecision.reasoning,
        keyFactors: state.signalDecision.keyFactors.join(", "),
        technicalData: formatTechnicalData(state),
      }),
    );

    logger.info("Signal formatting completed", {
      tokenAddress: state.tokenAddress,
      level: result.level,
      priority: result.priority,
    });

    return { finalSignal: result };
  } catch (error) {
    logger.error("Signal formatting failed", {
      tokenAddress: state.tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback formatting
    return createFallbackResponse(state);
  }
};
