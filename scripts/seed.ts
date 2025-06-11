import { initialTokens } from "../src/constants/static-tokens";
import { getDB, tokens } from "../src/db";
import { logger } from "../src/utils/logger";

const seed = async () => {
  await seedTokens();
};

const seedTokens = async () => {
  const db = getDB();
  logger.info("seedTokens", "Seeding tokens");
  await db.insert(tokens).values(initialTokens);
};

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
