import { StateGraph, START, END } from "@langchain/langgraph";
import { signalGraphState } from "./graph-state";
import { staticFilterRouter, llmAnalysisRouter, formatSignalRouter } from "./graph-route";
import { applyStaticFilter } from "./nodes/static-filter";
import { analyzeLLMSignal } from "./nodes/llm-analysis";
import { formatSignal } from "./nodes/signal-formatter";
import { logger } from "../../utils/logger";

/**
 * Signal Generator Graph
 *
 * シグナル生成プロセスのLangGraphワークフロー
 *
 * Flow:
 * 1. Static Filter: 事前フィルタでLLM呼び出しの必要性を判定
 * 2. LLM Analysis: 複合的な指標分析でシグナル生成判定
 * 3. Format Signal: ユーザー向けメッセージ整形
 */
export const createSignalGeneratorGraph = () => {
  const workflow = new StateGraph(signalGraphState)
    // ノード定義
    .addNode("static_filter", applyStaticFilter)
    .addNode("llm_analysis", analyzeLLMSignal)
    .addNode("format_signal", formatSignal)

    // エッジ定義
    .addEdge(START, "static_filter")
    .addConditionalEdges("static_filter", staticFilterRouter)
    .addConditionalEdges("llm_analysis", llmAnalysisRouter)
    .addConditionalEdges("format_signal", formatSignalRouter);

  return workflow.compile();
};

/**
 * Signal Generator実行関数
 *
 * cronタスクから呼び出されるメイン関数
 * テクニカル分析結果からトレーディングシグナルを生成
 */
export const generateSignal = async (input: {
  tokenAddress: string;
  tokenSymbol: string;
  currentPrice: number;
  technicalAnalysis: any;
}) => {
  logger.info("Starting signal generation", {
    tokenAddress: input.tokenAddress,
    tokenSymbol: input.tokenSymbol,
    currentPrice: input.currentPrice,
  });

  try {
    const graph = createSignalGeneratorGraph();

    const result = await graph.invoke({
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      currentPrice: input.currentPrice,
      technicalAnalysis: input.technicalAnalysis,
    });

    logger.info("Signal generation completed", {
      tokenAddress: input.tokenAddress,
      hasSignal: result.finalSignal?.level > 0,
      signalLevel: result.finalSignal?.level,
      priority: result.finalSignal?.priority,
    });

    return result;
  } catch (error) {
    logger.error("Signal generation failed", {
      tokenAddress: input.tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
};
