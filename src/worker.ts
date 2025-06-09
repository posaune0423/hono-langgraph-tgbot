import { Hono } from "hono";
import webhookRoute from "./routes/webhook";
import adminRoute from "./routes/admin";
import { logger } from "./utils/logger";
import { runCronTasks } from "./cron";

const app = new Hono();

// Telegram webhook endpoint
app.route("/webhook", webhookRoute);

// Admin API endpoints
app.route("/admin", adminRoute);

// --- Root and Maintenance Routes ---
app.get("/", (c) => c.json({ status: "ok", message: "Hono server running!" }));

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Not Found Handler ---
app.notFound((c) => {
  logger.warn("not-found", `Not Found: ${c.req.method} ${c.req.url}`);
  return c.json(
    {
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.url} not found.`,
    },
    404,
  );
});

// --- Error Handler ---
app.onError((err, c) => {
  logger.error("on-error", `Unhandled error on ${c.req.path}:`, err instanceof Error ? err.stack : err);
  // Avoid leaking stack traces in production
  return c.json({ error: "Internal Server Error" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController) {
    switch (controller.cron) {
      case "* * * * *":
        // Every minute
        await runCronTasks();
        break;
      default:
        break;
    }
    logger.info("scheduled", `Cron task triggered: ${controller.cron}`);
  },
};
