import type { SignalGraphState } from "./graph-state";
import { END } from "@langchain/langgraph";

/**
 * Signal Generator Router
 *
 * シグナル生成プロセスの各ステップ間のルーティングを管理
 * 状態に基づいて次に実行すべきノードを決定
 */
export const signalRouter = (
  state: SignalGraphState,
): "static_filter" | "llm_analysis" | "format_signal" | typeof END => {
  // Static Filter未実行の場合
  if (!state.staticFilterResult) {
    return "static_filter";
  }

  // LLM Analysis未実行の場合
  if (!state.signalDecision) {
    return "llm_analysis";
  }

  // Signal Formatting未実行の場合
  if (!state.finalSignal) {
    return "format_signal";
  }

  // 全ステップ完了
  return END;
};

/**
 * Static Filter後のルーティング
 * フィルタ結果に基づいてLLM分析の実行可否を判定
 */
export const staticFilterRouter = (state: SignalGraphState): "llm_analysis" | typeof END => {
  if (!state.staticFilterResult) {
    throw new Error("Static filter result not found");
  }

  // 静的フィルタを通過した場合のみLLM分析を実行
  if (state.staticFilterResult.shouldProceed) {
    return "llm_analysis";
  }

  // フィルタで除外された場合は終了
  return END;
};

/**
 * LLM Analysis後のルーティング
 * 分析結果に基づいてフォーマット処理の実行可否を判定
 */
export const llmAnalysisRouter = (state: SignalGraphState): "format_signal" | typeof END => {
  if (!state.signalDecision) {
    throw new Error("Signal decision not found");
  }

  // シグナル生成が決定された場合のみフォーマット処理を実行
  if (state.signalDecision.shouldGenerateSignal) {
    return "format_signal";
  }

  // シグナル生成不要の場合は終了
  return END;
};

/**
 * Format Signal後のルーティング
 * フォーマット完了後は常に終了
 */
export const formatSignalRouter = (state: SignalGraphState): typeof END => {
  return END;
};
