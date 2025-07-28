import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { logger } from "../utils/logger";

export * from "./schema";

import * as schema from "./schema";

let db: DrizzleD1Database<typeof schema>;

// D1 database instance will be injected from Cloudflare Worker environment
export function getDB(d1Binding?: D1Database) {
  if (!db) {
    logger.info("[DB] Connecting to Cloudflare D1 database");
    db = drizzle(d1Binding || (process.env.DB as unknown as D1Database), { schema });
  }

  return db;
}

export { schema };
