import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { logger } from "../../../utils/logger";
import type { graphState } from "../graph-state";
import { getDB } from "../../../db";
import { dataSource } from "../../../db/schema";

export const dataCollectorNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  logger.info("dataCollectorNode", "Starting data collection");

  const collectedData: any[] = [];

  try {
    // 1. Web search for recent news/events
    if (process.env.TAVILY_API_KEY) {
      const searchTool = new TavilySearchResults();
      const searchQuery = `${state.token} cryptocurrency news price analysis`;

      logger.info("dataCollectorNode", `Searching for: ${searchQuery}`);
      const searchResults = await searchTool.invoke(searchQuery);

      collectedData.push({
        type: "web_search",
        source: "tavily",
        data: searchResults,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Database data sources lookup
    const db = getDB();
    const existingDataSources = await db.select().from(dataSource).limit(10);

    collectedData.push({
      type: "database_sources",
      source: "internal_db",
      data: existingDataSources,
      timestamp: new Date().toISOString(),
    });

    logger.info("dataCollectorNode", `Collected ${collectedData.length} data sources`);

    return {
      ...state,
      collectedData,
    };
  } catch (error) {
    logger.error("dataCollectorNode", "Error collecting data:", error);
    return {
      ...state,
      collectedData: [],
    };
  }
};