import type { SignalGraphState } from "../graph-state";
import { applyStaticSignalFilter } from "../../../lib/static-signal-filter";
import { logger } from "../../../utils/logger";

/**
 * Static Filter Node
 *
 * テクニカル指標の静的閾値チェックによる事前フィルタリング
 * LLM呼び出しのコスト削減とパフォーマンス向上を目的とする
 */
export const applyStaticFilter = (state: SignalGraphState) => {
  logger.info("Applying static signal filter", {
    tokenAddress: state.tokenAddress,
    tokenSymbol: state.tokenSymbol,
  });

  const filterResult = applyStaticSignalFilter(state.tokenAddress, state.technicalAnalysis);

  logger.debug("Static filter results", {
    tokenAddress: state.tokenAddress,
    shouldProceed: filterResult.shouldProceed,
    confluenceScore: filterResult.confluenceScore,
    triggeredIndicators: filterResult.triggeredIndicators,
    riskLevel: filterResult.riskLevel,
  });

  return {
    staticFilterResult: filterResult,
  };
};
