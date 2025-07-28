import { logger } from "../../../utils/logger";
import type { graphState } from "../graph-state";

// Simplified data fetch node - can be extended later with actual data sources
export const dataFetchNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  logger.info("DataFetch node executing", {
    hasUserProfile: !!state.userProfile,
    messageCount: state.messages?.length || 0,
  });

  // For now, just pass through - can be extended with:
  // - Database queries
  // - API calls
  // - External data sources
  // - User preference loading

  return {
    ...state,
    isDataFetchNodeQuery: false, // Mark as processed
    userAssets: [], // Empty for now
  };
};
