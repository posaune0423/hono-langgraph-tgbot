import { logger } from "./utils/logger";

// every 5 minutes
export const runCronTasks = async () => {
  logger.info("cron tasks started");
  // some cron tasks here
  logger.info("cron tasks ended");
};
