import { getAssetsByOwner } from "../lib/helius";
import { logger } from "../utils/logger";
import type { graphState } from "../utils/state";

// This node is just for connecting other data fetching nodes so that they can be called in parallel
export const dataFetchNode = async (
    state: typeof graphState.State,
): Promise<Partial<typeof graphState.State>> => {
    logger.info("dataFetchNode", "dataFetchNode", state);

    if (!state.userProfile?.walletAddress) {
        logger.error("dataFetchNode", "User wallet address not found");
        throw new Error("User wallet address not found");
    }

    const assets = await getAssetsByOwner(state.userProfile.walletAddress);
    logger.info("dataFetchNode", "assets", assets);

    return {
        ...state,
        userAssets: assets,
    };
};
