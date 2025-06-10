import { logger } from "./utils/logger";
import { getTokens, batchUpsert } from "./utils/db";
import { fetchMultipleTokenOHLCV } from "./lib/vybe";
import { tokenOHLCV } from "./db";

// every 5 minutes
export const runCronTasks = async () => {
  logger.info("runCronTasks", `cron start: ${new Date().toISOString()}`);
  await updateTokenOHLCV();
  await technicalAnalysisTask();
  logger.info("runCronTasks", `cron end: ${new Date().toISOString()}`);
};

const updateTokenOHLCV = async () => {
  const tokens = await getTokens();
  const tokenAddresses = tokens.map((t) => t.address);
  const ohlcv = await fetchMultipleTokenOHLCV(tokenAddresses, "5m");

  if (!ohlcv.isOk()) {
    logger.error("updateTokenOHLCV", "Failed to fetch OHLCV data", ohlcv.error);
    return;
  }

  const ohlcvValues = Object.entries(ohlcv.value).flatMap(([mintAddress, tokenResponse]) => {
    // 全てのOHLCVデータを処理（配列全体）
    return tokenResponse.map((ohlcvData) => ({
      token: mintAddress,
      timestamp: ohlcvData.time,
      open: ohlcvData.open,
      high: ohlcvData.high,
      low: ohlcvData.low,
      close: ohlcvData.close,
      volume: ohlcvData.volume,
    }));
  });

  if (ohlcvValues.length === 0) {
    logger.error("updateTokenOHLCV", "No OHLCV data found");
    return;
  }

  // 汎用batchUpsert関数を使用して効率的に処理
  await batchUpsert(tokenOHLCV, ohlcvValues, {
    conflictTarget: ["token", "timestamp"],
    updateFields: ["open", "high", "low", "close", "volume"],
    logContext: "updateTokenOHLCV",
  });
};

const technicalAnalysisTask = async () => {};
