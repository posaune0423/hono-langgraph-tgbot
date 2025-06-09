import { logger } from "./utils/logger";

export const runCronTasks = async () => {
  logger.info("runCronTasks", `cron start: ${new Date().toISOString()}`);
  await updateTokenOHLCV();
  await technicalAnalysisTask();
};

const updateTokenOHLCV = async () => {};

const technicalAnalysisTask = async () => {};
