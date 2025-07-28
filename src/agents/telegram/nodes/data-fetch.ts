import { getUser } from "../../../utils/db";
import { logger } from "../../../utils/logger";
import type { graphState } from "../graph-state";

// Simplified data fetch node - can be extended later with actual data sources
export const dataFetchNode = async (
  state: typeof graphState.State,
  config?: { configurable?: { thread_id?: string } },
): Promise<Partial<typeof graphState.State>> => {
  logger.info("DataFetch node executing", {
    hasUserProfile: !!state.userProfile,
    messageCount: state.messages?.length || 0,
  });

  // Extract userId from config if userProfile is null
  const userId = state.userProfile?.userId || config?.configurable?.thread_id;

  if (!userId) {
    logger.warn("No userId available for data fetch", {
      hasUserProfile: !!state.userProfile,
      hasConfig: !!config?.configurable?.thread_id,
    });
    return state;
  }

  const result = await getUser(userId);
  if (result.isErr()) {
    logger.info("User not found in database, continuing without profile", {
      userId,
      error: result.error.type,
    });
    return state;
  }

  // For now, just pass through - can be extended with:
  // - Database queries
  // - API calls
  // - External data sources
  // - User preference loading

  return {
    ...state,
    userProfile: result.value,
  };
};
