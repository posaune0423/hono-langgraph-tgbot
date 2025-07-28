import { Hono } from "hono";
import { cors } from "hono/cors";
import { ADMIN_API_KEY_HEADER, ALLOWED_ORIGINS } from "./constants";
import adminRoute from "./routes/admin";
import webhookRoute from "./routes/webhook";
import { logger } from "./utils/logger";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// CORS Middleware (from original index.ts)
app.use(
  "*",
  cors({
    origin: ALLOWED_ORIGINS, // Make sure allowedOrigins is compatible
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Custom-Header",
      "Upgrade-Insecure-Requests",
      ADMIN_API_KEY_HEADER,
      "ngrok-skip-browser-warning", // Added for ngrok testing if needed
    ],
    exposeHeaders: ["Content-Length"],
    maxAge: 60000,
  }),
);

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

export default app;
