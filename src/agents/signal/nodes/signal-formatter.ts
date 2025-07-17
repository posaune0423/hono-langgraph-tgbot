import { z } from "zod";
import { createPhantomButtons } from "../../../lib/phantom";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";
import { createSignalModel } from "../model";
import { signalFormattingPrompt } from "../prompts/signal-analysis";

/**
 * Button Schema for Telegram Inline Keyboard
 */
const ButtonSchema = z.object({
  text: z.string(),
  url: z.string().optional(),
  callback_data: z.string().optional(),
});

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
  buttons: z.array(ButtonSchema).optional(),
});

/**
 * シグナル生成不要時のデフォルトレスポンス
 */
const createNoSignalResponse = (tokenAddress: string, tokenSymbol: string) => ({
  finalSignal: {
    level: 1 as const,
    title: "🔍 Market Monitoring",
    message: `🔍 **MARKET MONITORING**

📋 **RECOMMENDED ACTION**: HOLD AND MONITOR

📊 **Status**: No clear signal detected
📈 **Direction**: NEUTRAL
⚡ **Confidence**: N/A

🔍 **ANALYSIS**
Current market conditions do not present sufficient confluence of indicators to generate a trading signal. Continue monitoring for better opportunities.

⚠️ **NEXT STEPS**
• Monitor for indicator alignment
• Watch for volume confirmation
• Maintain position sizing discipline

💡 *Market timing requires patience and discipline*`,
    priority: "LOW" as const,
    tags: ["monitoring", "neutral", "hold"],
    buttons: createPhantomButtons(tokenAddress, tokenSymbol),
  },
});

/**
 * エラー時のフォールバックレスポンス
 */
const createFallbackResponse = (tokenAddress: string, tokenSymbol: string) => ({
  finalSignal: {
    level: 1 as const,
    title: "⚠️ Analysis Error",
    message: `⚠️ **ANALYSIS ERROR**

📋 **RECOMMENDED ACTION**: MANUAL REVIEW REQUIRED

🔍 **Issue**: Signal formatting encountered an error
📊 **Status**: Analysis incomplete
⚡ **Action**: Please review technical indicators manually

⚠️ **IMPORTANT**
• Verify current market conditions
• Check technical indicator values
• Proceed with caution

💡 *When in doubt, step out*`,
    priority: "LOW" as const,
    tags: ["error", "manual-review", "caution"],
    buttons: createPhantomButtons(tokenAddress, tokenSymbol),
  },
});

/**
 * Signal Formatter Node
 * 生成されたシグナルをTelegram用にフォーマット
 */
export const formatSignal = async (state: SignalGraphState): Promise<Partial<SignalGraphState>> => {
  try {
    logger.info("Starting signal formatting", {
      tokenAddress: state.tokenAddress,
      hasAnalysis: !!state.signalDecision,
    });

    // シグナル生成不要の場合
    if (!state.signalDecision?.shouldGenerateSignal) {
      logger.info("No signal required, creating monitoring response");
      return createNoSignalResponse(state.tokenAddress, state.tokenSymbol);
    }

    // 必要なデータの検証
    if (!state.signalDecision || !state.technicalAnalysis || !state.staticFilterResult) {
      logger.error("Missing required data for signal formatting");
      return createFallbackResponse(state.tokenAddress, state.tokenSymbol);
    }

    // LLMモデルの作成
    const model = createSignalModel();

    // プロンプト変数の準備
    const promptVariables = {
      tokenSymbol: state.tokenSymbol,
      tokenAddress: state.tokenAddress,
      signalType: state.signalDecision.signalType,
      direction: state.signalDecision.direction,
      currentPrice: state.currentPrice.toString(),
      confidence: Math.round(state.signalDecision.confidence * 100).toString(),
      riskLevel: state.signalDecision.riskLevel,
      timeframe: state.signalDecision.timeframe,
      reasoning: state.signalDecision.reasoning,
      keyFactors: state.signalDecision.keyFactors.join(", "),
      technicalData: JSON.stringify({
        rsi: state.technicalAnalysis.rsi,
        vwapDeviation: state.technicalAnalysis.vwap_deviation,
        percentB: state.technicalAnalysis.percent_b,
        adx: state.technicalAnalysis.adx,
        atrPercent: state.technicalAnalysis.atr_percent,
        obvZScore: state.technicalAnalysis.obv_zscore,
      }),
    };

    logger.info("Executing signal formatting with LLM", {
      signalType: state.signalDecision.signalType,
      direction: state.signalDecision.direction,
      confidence: state.signalDecision.confidence,
    });

    // LLMによるシグナルフォーマット
    const chain = signalFormattingPrompt.pipe(model.withStructuredOutput(SignalFormattingSchema));
    const result = await chain.invoke(promptVariables);

    logger.info("Signal formatting completed", {
      tokenAddress: state.tokenAddress,
      level: result.level,
      priority: result.priority,
    });

    // Add buttons to the result
    const finalSignalWithButtons = {
      ...result,
      buttons: createPhantomButtons(state.tokenAddress, state.tokenSymbol),
    };

    return { finalSignal: finalSignalWithButtons };
  } catch (error) {
    logger.error("Signal formatting failed", { error: error instanceof Error ? error.message : error });
    return createFallbackResponse(state.tokenAddress, state.tokenSymbol);
  }
};
