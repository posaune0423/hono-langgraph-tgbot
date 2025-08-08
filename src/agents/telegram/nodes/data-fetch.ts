import { getUser } from "../../../db/utils";
import { logger } from "../../../utils/logger";
import type { graphState } from "../graph-state";

// Simplified data fetch node - can be extended later with actual data sources
export const dataFetchNode = async (
  state: typeof graphState.State,
  config?: { configurable?: { thread_id?: number } },
): Promise<Partial<typeof graphState.State>> => {
  const userId = state.user?.userId || config?.configurable?.thread_id;
  if (!userId) {
    logger.warn("No userId available for data fetch");
    return state;
  }

  const user = await getUser(userId);

  if (!user) {
    return state;
  }

  return {
    ...state,
    user,
  };
};
