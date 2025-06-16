import { Annotation } from "@langchain/langgraph";
import type { TechnicalAnalysis } from "../../db/schema/technical-analysis";

/**
 * Signal Generator Graph State
 *
 * シグナル生成プロセスの状態管理
 * - 入力データ（トークン情報、テクニカル分析結果）
 * - 各ステップの処理結果
 * - 最終的なシグナル出力
 */
export const signalGraphState = Annotation.Root({
  // === Input Data ===
  tokenAddress: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),

  tokenSymbol: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),

  currentPrice: Annotation<number>({
    reducer: (x, y) => y ?? x,
  }),

  technicalAnalysis: Annotation<TechnicalAnalysis>({
    reducer: (x, y) => y ?? x,
  }),

  // === Static Filter Results ===
  staticFilterResult: Annotation<{
    shouldProceed: boolean;
    triggeredIndicators: string[];
    signalCandidates: string[];
    confluenceScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  }>({
    reducer: (x, y) => y ?? x,
  }),

  // === LLM Analysis Results ===
  signalDecision: Annotation<{
    shouldGenerateSignal: boolean;
    signalType: string;
    direction: "BUY" | "SELL" | "NEUTRAL";
    confidence: number;
    reasoning: string;
    keyFactors: string[];
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    timeframe: "SHORT" | "MEDIUM" | "LONG";
  }>({
    reducer: (x, y) => y ?? x,
  }),

  // === Evidence Search Results (for future implementation) ===
  evidenceResults: Annotation<{
    relevantSources: any[];
    overallConfidence: number;
    primaryCause: string;
    recommendation: "INCLUDE" | "EXCLUDE" | "UNCERTAIN";
  }>({
    reducer: (x, y) => y ?? x,
  }),

  // === Final Output ===
  finalSignal: Annotation<{
    level: 1 | 2 | 3;
    title: string;
    message: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    tags: string[];
  }>({
    reducer: (x, y) => y ?? x,
  }),
});

export type SignalGraphState = typeof signalGraphState.State;
