import type { Context, Next } from "hono";
import { ADMIN_API_KEY_HEADER } from "../constants";
import { logger } from "./logger";

/**
 * Admin authentication middleware
 */
export const adminAuth = async (c: Context, next: Next) => {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    logger.error("adminAuth", "ADMIN_API_KEY environment variable not configured");
    return c.json({ error: "Admin authentication not configured" }, 500);
  }

  const providedKey = c.req.header(ADMIN_API_KEY_HEADER);

  if (!providedKey) {
    logger.warn("adminAuth", "Missing admin API key in request headers");
    return c.json({ error: "Admin API key required" }, 401);
  }

  if (providedKey !== adminApiKey) {
    logger.warn("adminAuth", "Invalid admin API key provided", {
      providedKey: `${providedKey.substring(0, 8)}...`,
    });
    return c.json({ error: "Invalid admin API key" }, 403);
  }

  logger.info("adminAuth", "Admin authenticated successfully");
  await next();
};
