import { z } from "zod";
import { createPhantomButtons } from "../../../lib/phantom";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";
import { createSignalModel } from "../model";
import { signalFormattingPrompt } from "../prompts/signal-analysis";

/**
 * Button Schema for Telegram Inline Keyboard
 * Note: OpenAI Structured Outputs requires .optional().nullable() instead of just .optional()
 */
const ButtonSchema = z.object({
  text: z.string(),
  url: z.string().optional().nullable(),
  callback_data: z.string().optional().nullable(),
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
 * Simple template-based signal formatter (LLM-free fallback)
 */
const createSimpleSignalResponse = (state: SignalGraphState) => {
  const { signalDecision, tokenSymbol, tokenAddress, currentPrice, technicalAnalysis } = state;

  // Direction-based emoji selection
  const getDirectionEmoji = (direction: string, riskLevel: string) => {
    if (direction === "BUY") {
      return riskLevel === "HIGH" ? "🚀⚠️" : "🚀💚";
    }
    if (direction === "SELL") {
      return riskLevel === "HIGH" ? "📉⚠️" : "📉🔴";
    }
    return "📊🔄";
  };

  // Risk level emoji and formatting
  const getRiskFormatting = (riskLevel: string) => {
    switch (riskLevel) {
      case "HIGH":
        return { emoji: "🔴⚠️", text: "**HIGH RISK**" };
      case "MEDIUM":
        return { emoji: "🟡⚖️", text: "**MEDIUM RISK**" };
      case "LOW":
        return { emoji: "🟢🛡️", text: "**LOW RISK**" };
      default:
        return { emoji: "⚪", text: "**UNKNOWN RISK**" };
    }
  };

  // Timeframe emoji
  const getTimeframeEmoji = (timeframe: string) => {
    switch (timeframe) {
      case "SHORT":
        return "⚡";
      case "MEDIUM":
        return "⏰";
      case "LONG":
        return "📅";
      default:
        return "🕐";
    }
  };

  const directionEmoji = getDirectionEmoji(signalDecision!.direction, signalDecision!.riskLevel);
  const riskFormatting = getRiskFormatting(signalDecision!.riskLevel);
  const timeframeEmoji = getTimeframeEmoji(signalDecision!.timeframe);

  // アクションの決定
  const getRecommendedAction = (direction: string, riskLevel: string) => {
    if (direction === "BUY") {
      return riskLevel === "HIGH" ? "🎯 **CONSIDER BUYING**" : "🚀 **BUY SIGNAL**";
    }
    if (direction === "SELL") {
      return riskLevel === "HIGH" ? "📉 **CONSIDER SELLING**" : "🔻 **SELL SIGNAL**";
    }
    return "⏸️ **HOLD & MONITOR**";
  };

  const recommendedAction = getRecommendedAction(signalDecision!.direction, signalDecision!.riskLevel);

  // MarkdownV2 escape function for special characters
  const escapeMarkdownV2 = (text: string): string => {
    return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
  };

  // Format technical analysis safely
  const formattedReasoning = escapeMarkdownV2(signalDecision!.reasoning);
  const formattedKeyFactors = signalDecision!.keyFactors.map((factor) => `▫️ ${escapeMarkdownV2(factor)}`).join("\n");

  const message = `${directionEmoji} **${escapeMarkdownV2(tokenSymbol)} - ${escapeMarkdownV2(signalDecision!.signalType)}** ${directionEmoji}

🎯 **RECOMMENDED ACTION**: ${recommendedAction}
💰 **Current Price**: $${escapeMarkdownV2(currentPrice.toString())}
📊 **Confidence**: **${Math.round(signalDecision!.confidence * 100)}%** | ${riskFormatting.emoji} ${riskFormatting.text}

🔍 **Market Situation**
${formattedReasoning}

${riskFormatting.emoji} **Risk Assessment**
*This is a ${escapeMarkdownV2(signalDecision!.riskLevel.toLowerCase())} risk opportunity\\. ${
    signalDecision!.riskLevel === "HIGH"
      ? "High potential rewards but requires careful position sizing\\."
      : signalDecision!.riskLevel === "MEDIUM"
      ? "Moderate risk with balanced risk\\-reward potential\\."
      : "Relatively stable with lower volatility expected\\."
  }*

${timeframeEmoji} **Timeframe**: ${escapeMarkdownV2(signalDecision!.timeframe)} \\- ${
    signalDecision!.timeframe === "SHORT"
      ? "*Active monitoring required*"
      : signalDecision!.timeframe === "MEDIUM"
      ? "*Regular check\\-ins recommended*"
      : "*Patient approach suggested*"
  }

📌 **Key Factors**:
${formattedKeyFactors}

💡 *${
    signalDecision!.direction === "BUY"
      ? "Consider your risk tolerance before entering position"
      : signalDecision!.direction === "SELL"
      ? "Review your holdings and consider taking profits"
      : "Stay alert for clearer market direction"
  }*

⚠️ _Always DYOR \\(Do Your Own Research\\) before making trading decisions_`;

  const level = signalDecision!.riskLevel === "HIGH" ? 3 : signalDecision!.riskLevel === "MEDIUM" ? 2 : 1;

  return {
    finalSignal: {
      level: level as 1 | 2 | 3,
      title: `${directionEmoji} ${tokenSymbol} ${signalDecision!.signalType}`,
      message,
      priority: signalDecision!.riskLevel as "LOW" | "MEDIUM" | "HIGH",
      tags: [tokenSymbol.toLowerCase(), signalDecision!.signalType.toLowerCase(), signalDecision!.direction.toLowerCase()],
      buttons: createPhantomButtons(tokenAddress, tokenSymbol),
    },
  };
};

/**
 * シグナル生成不要時のデフォルトレスポンス
 */
const createNoSignalResponse = (tokenAddress: string, tokenSymbol: string) => {
  const escapeMarkdownV2 = (text: string): string => {
    return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
  };

  return {
    finalSignal: {
      level: 1 as const,
      title: `🔍 ${tokenSymbol} Market Watch`,
      message: `🔍 **${escapeMarkdownV2(tokenSymbol)} Market Analysis** 📊

⚡ **CURRENT STATUS**: *No Signal Generated*
🎯 **Market Condition**: Neutral trading range

📈 **Analysis Summary**
Current technical indicators are within normal parameters\\. No significant trend breakouts or momentum shifts detected at this time\\.

🔄 **What This Means**
▫️ *Price action is consolidating*
▫️ *No clear directional bias established*
▫️ *Market waiting for catalyst*

⏰ **Next Steps**
• 👀 **Continue monitoring** for trend development
• 📊 **Watch key support/resistance levels**
• ⚡ **Stay alert** for momentum changes

💡 *Sometimes the best trade is no trade\\. Patience often pays off in crypto markets\\!*

🔔 _We'll notify you when clearer opportunities emerge_`,
      priority: "LOW" as const,
      tags: [tokenSymbol.toLowerCase(), "monitoring", "neutral"],
      buttons: createPhantomButtons(tokenAddress, tokenSymbol),
    },
  };
};

/**
 * Signal Formatter Node
 * 生成されたシグナルをTelegram用にフォーマット
 */
export const formatSignal = async (state: SignalGraphState): Promise<Partial<SignalGraphState>> => {
  try {
    logger.info("Starting signal formatting", {
      tokenAddress: state.tokenAddress,
      hasAnalysis: !!state.signalDecision,
      hasStaticFilter: !!state.staticFilterResult,
      hasTechnicalAnalysis: !!state.technicalAnalysis,
    });

    // シグナル生成不要の場合
    if (!state.signalDecision?.shouldGenerateSignal) {
      logger.info("No signal required, creating monitoring response", {
        tokenAddress: state.tokenAddress,
        hasSignalDecision: !!state.signalDecision,
        shouldGenerateSignal: state.signalDecision?.shouldGenerateSignal,
      });
      return createNoSignalResponse(state.tokenAddress, state.tokenSymbol);
    }

    // 必要なデータの詳細検証
    const missingData = [];
    if (!state.signalDecision) missingData.push("signalDecision");
    if (!state.technicalAnalysis) missingData.push("technicalAnalysis");
    if (!state.staticFilterResult) missingData.push("staticFilterResult");

    if (missingData.length > 0) {
      logger.error("Missing required data for signal formatting", {
        tokenAddress: state.tokenAddress,
        missingData,
        signalDecision: state.signalDecision ? "present" : "missing",
        technicalAnalysis: state.technicalAnalysis ? "present" : "missing",
        staticFilterResult: state.staticFilterResult ? "present" : "missing",
      });

      // Instead of creating a fallback error message, return empty object to skip signal generation
      logger.info("Missing required data, skipping signal generation", {
        tokenAddress: state.tokenAddress,
        tokenSymbol: state.tokenSymbol,
        missingData,
      });
      return {};
    }

    // LLMモデルの作成
    const model = createSignalModel();

    // プロンプト変数の準備と検証
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
      marketSentiment: state.signalDecision.marketSentiment,
      priceExpectation: state.signalDecision.priceExpectation,
      technicalData: JSON.stringify({
        rsi: state.technicalAnalysis.rsi,
        vwapDeviation: state.technicalAnalysis.vwap_deviation,
        percentB: state.technicalAnalysis.percent_b,
        adx: state.technicalAnalysis.adx,
        atrPercent: state.technicalAnalysis.atr_percent,
        obvZScore: state.technicalAnalysis.obv_zscore,
      }),
    };

    // プロンプト変数の検証
    const requiredVariables = [
      "tokenSymbol",
      "tokenAddress",
      "signalType",
      "direction",
      "currentPrice",
      "confidence",
      "riskLevel",
      "timeframe",
      "reasoning",
      "keyFactors",
      "marketSentiment",
      "priceExpectation",
      "technicalData",
    ];
    const missingVariables = requiredVariables.filter(
      (key) =>
        promptVariables[key as keyof typeof promptVariables] === undefined ||
        promptVariables[key as keyof typeof promptVariables] === null ||
        promptVariables[key as keyof typeof promptVariables] === "",
    );

    if (missingVariables.length > 0) {
      logger.error("Missing or invalid prompt variables, using simple template fallback", {
        tokenAddress: state.tokenAddress,
        missingVariables,
        allVariables: Object.keys(promptVariables),
      });
      return createSimpleSignalResponse(state);
    }

    logger.info("Executing signal formatting with LLM", {
      tokenAddress: state.tokenAddress,
      signalType: state.signalDecision.signalType,
      direction: state.signalDecision.direction,
      confidence: state.signalDecision.confidence,
      promptVariables: {
        tokenSymbol: promptVariables.tokenSymbol,
        signalType: promptVariables.signalType,
        direction: promptVariables.direction,
        currentPrice: promptVariables.currentPrice,
        confidence: promptVariables.confidence,
      },
    });

    // LLMによるシグナルフォーマット
    const chain = signalFormattingPrompt.pipe(model.withStructuredOutput(SignalFormattingSchema));

    logger.info("About to invoke LLM chain", {
      tokenAddress: state.tokenAddress,
      chainConfigured: true,
    });

    const result = await chain.invoke(promptVariables);

    logger.info("LLM formatting result received", {
      tokenAddress: state.tokenAddress,
      hasResult: !!result,
      level: result?.level,
      priority: result?.priority,
      hasMessage: !!result?.message,
      messageLength: result?.message?.length,
    });

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
    logger.error("LLM signal formatting failed, using simple template fallback", {
      tokenAddress: state.tokenAddress,
      tokenSymbol: state.tokenSymbol,
      error: error instanceof Error ? error.message : error,
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      hasSignalDecision: !!state.signalDecision,
      hasTechnicalAnalysis: !!state.technicalAnalysis,
      hasStaticFilterResult: !!state.staticFilterResult,
      signalType: state.signalDecision?.signalType,
      direction: state.signalDecision?.direction,
    });

    // Try simple template-based formatting as fallback
    if (state.signalDecision && state.signalDecision.shouldGenerateSignal) {
      logger.info("Using simple template-based signal formatting", {
        tokenAddress: state.tokenAddress,
        signalType: state.signalDecision.signalType,
      });
      return createSimpleSignalResponse(state);
    }

    // Instead of creating a fallback error message, return null to avoid user confusion
    // This prevents "Analysis Error" messages when other tokens are working fine
    logger.info("Signal formatting failed completely, skipping signal generation", {
      tokenAddress: state.tokenAddress,
      tokenSymbol: state.tokenSymbol,
    });

    return {};
  }
};
