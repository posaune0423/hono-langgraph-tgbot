#!/usr/bin/env bun

import { runCronTasks } from "../src/cron";
import { logger } from "../src/utils/logger";

async function main() {
  console.log("🚀 Starting cron task execution manually");
  logger.info("🚀 Starting cron task execution manually");

  const startTime = Date.now();

  try {
    await runCronTasks();

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    const message = `✅ Cron tasks completed successfully in ${executionTime}ms (${(executionTime / 1000).toFixed(2)}s)`;
    console.log(message);
    logger.info(message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Cron task execution failed:", errorMessage);
    logger.error("❌ Cron task execution failed:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    process.exit(1);
  }
}

main().catch(error => {
  console.error("❌ Script execution failed:", error);
  logger.error("❌ Script execution failed:", error);
  process.exit(1);
});
