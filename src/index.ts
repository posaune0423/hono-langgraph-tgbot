import { Hono } from "hono";
import webhookRoute from "./routes/webhook";
import { logger } from "./utils/logger";
import { runCronTasks } from "./cron";

const app = new Hono();

// Telegram webhook endpoint
app.route("/webhook", webhookRoute);

// --- Root and Maintenance Routes ---
app.get("/", (c) => c.json({ status: "ok", message: "Hono server running!" }));

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount this route directly on the main app, outside /api if desired
app.post("/trigger-cron", async (c) => {
  console.log("Triggering cron");
  const providedSecret = c.req.header("X-Cron-Secret");
  if (providedSecret !== process.env.CRON_SECRET) {
    logger.warn("trigger-cron", "Unauthorized attempt to trigger cron endpoint.");
    return c.json({ error: "Unauthorized" }, 403);
  }

  logger.info("trigger-cron", "Cron trigger endpoint called successfully. Initiating tasks asynchronously...");

  // Run tasks asynchronously (fire and forget). Do NOT await here.
  // The lock mechanism inside runCronTasks will prevent overlaps.
  await runCronTasks();

  // Return immediately to the cron runner
  return c.json({ success: true, message: "Cron tasks finished." });
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

export default app;
