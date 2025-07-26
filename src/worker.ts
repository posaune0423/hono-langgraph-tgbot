import app from "./api";
import { runCronTasks } from "./cron";
import { logger } from "./utils/logger";

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController) {
    switch (controller.cron) {
      case "*/5 * * * *":
        // Every 5 minutes
        await runCronTasks();
        break;
      default:
        break;
    }
    logger.info("scheduled", `Cron task triggered: ${controller.cron}`);
  },
};
