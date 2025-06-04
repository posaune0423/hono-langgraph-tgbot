import { Hono } from "hono";
import webhookRoute from "./routes/webhook";

const app = new Hono();

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Telegram webhook endpoint
app.route("/webhook", webhookRoute);

export default app;
