#!/usr/bin/env bun

import { broadcastToAllUsers } from "../src/lib/telegram/utils";
import { logger } from "../src/utils/logger";

async function main() {
  console.log("📢 Starting broadcast test execution");
  logger.info("📢 Starting broadcast test execution");

  const startTime = Date.now();

  try {
    const testMessage = `🧪 **Test Message**

This is a test of the broadcast functionality.
Sent at: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })}

If you receive this message, the broadcast feature is working correctly ✅`;

    console.log("📤 Sending test message to all users...");
    logger.info("📤 Sending test message to all users");

    const result = await broadcastToAllUsers(testMessage, {
      parse_mode: "Markdown",
      disable_notification: false,
    });

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    if (result.isOk()) {
      const stats = result.value;
      const message = `✅ Broadcast test completed successfully in ${executionTime}ms (${(executionTime / 1000).toFixed(2)}s)
📊 Results:
  - Total users: ${stats.totalUsers}
  - Successful sends: ${stats.successCount}
  - Failed sends: ${stats.failureCount}
  - Success rate: ${stats.totalUsers > 0 ? ((stats.successCount / stats.totalUsers) * 100).toFixed(1) : "0"}%`;

      console.log(message);
      logger.info("Broadcast test completed", {
        executionTimeMs: executionTime,
        totalUsers: stats.totalUsers,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        failedUsers: stats.failedUsers,
      });

      if (stats.failureCount > 0) {
        console.log(`⚠️  Failed to send to ${stats.failureCount} users`);
        logger.warn("Some sends failed", {
          failedUserIds: stats.failedUsers,
        });
      }
    } else {
      const errorMessage = `❌ Broadcast test failed: ${result.error.message}`;
      console.error(errorMessage);
      logger.error("Broadcast test failed", {
        error: result.error,
        executionTimeMs: executionTime,
      });
      process.exit(1);
    }
  } catch (error) {
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    const errorMessage = `💥 Broadcast test crashed after ${executionTime}ms: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    logger.error("Broadcast test crashed", {
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: executionTime,
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Script execution failed:", error);
  logger.error("❌ Script execution failed:", error);
  process.exit(1);
});
