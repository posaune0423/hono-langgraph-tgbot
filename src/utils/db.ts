import { eq, notInArray, sql } from "drizzle-orm";
import { getDB, type NewUser, schema, Token, User, users, tokenOHLCV } from "../db";
import { logger } from "./logger";

const db = getDB();

export const getTokens = async (): Promise<Token[]> => {
  const allTokens = await db.query.tokens.findMany();
  return allTokens;
};

export const getUsers = async (): Promise<User[]> => {
  const allUsers = await db.query.users.findMany();
  return allUsers;
};

export const getUserIds = async (excludeUserIds: string[] = []): Promise<string[]> => {
  const allUserIds = await db
    .select({ userId: users.userId })
    .from(users)
    .where(notInArray(users.userId, excludeUserIds));
  return allUserIds.map((u) => u.userId);
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  const [user] = await db.select().from(users).where(eq(users.userId, userId));
  return user;
};

export const updateUserProfile = async (userId: string, profile: Partial<NewUser>): Promise<User | null> => {
  const [user] = await db.update(users).set(profile).where(eq(users.userId, userId)).returning();
  return user;
};

export const createUserProfile = async (profile: NewUser): Promise<User> => {
  const [user] = await db.insert(users).values(profile).returning();
  return user;
};

export const upsertUserProfile = async (profile: NewUser): Promise<User> => {
  const [user] = await db
    .insert(users)
    .values(profile)
    .onConflictDoUpdate({
      target: users.userId,
      set: profile,
    })
    .returning();
  return user;
};

export const getUserProfileByWalletAddress = async (walletAddress: string): Promise<User | null> => {
  const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
  return user;
};

// Drizzleテーブルからカラム名を抽出する型（keyofを使用してシンプルに）
type TableColumnNames<T> = keyof T extends string ? keyof T : never;

export interface BatchUpsertOptions<TTable extends SchemaTable> {
  batchSize?: number;
  maxConcurrent?: number;
  conflictTarget: Array<TableColumnNames<TTable>>;
  updateFields: Array<TableColumnNames<TTable>>;
  logContext?: string;
}

/**
 * 大量データを効率的にバッチUPSERT処理する型安全な汎用関数
 *
 * Drizzleのschemaオブジェクトから動的に全テーブルの型を推論し、
 * 定義されたテーブルのみを受け入れるため、新しいテーブル追加時も
 * メンテナンス不要です。
 *
 * @example
 * // tokenOHLCVテーブルの例
 * await batchUpsert(tokenOHLCV, ohlcvData, {
 *   conflictTarget: ['token', 'timestamp'],
 *   updateFields: ['open', 'high', 'low', 'close', 'volume'],
 *   logContext: "updateTokenOHLCV"
 * });
 *
 * // usersテーブルの例
 * await batchUpsert(users, userData, {
 *   conflictTarget: ['userId'],
 *   updateFields: ['walletAddress', 'age'],
 *   logContext: "updateUsers"
 * });
 *
 * @param table Drizzleのschemaで定義された任意のテーブル（自動で型推論）
 * @param data 挿入するデータの配列
 * @param options バッチ処理オプション
 */
// schemaから動的に全テーブルの型を生成
type SchemaTable = (typeof schema)[keyof typeof schema];

export async function batchUpsert<TTable extends SchemaTable, T extends Record<string, any>>(
  table: TTable,
  data: T[],
  options: BatchUpsertOptions<TTable>,
): Promise<{ totalUpserted: number; batchCount: number }> {
  const { batchSize = 500, maxConcurrent = 3, conflictTarget, updateFields, logContext = "batchUpsert" } = options;

  if (data.length === 0) {
    logger.warn(logContext, "No data to upsert");
    return { totalUpserted: 0, batchCount: 0 };
  }

  // データをバッチに分割
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  logger.info(logContext, `Starting batch upsert: ${data.length} records in ${batches.length} batches`);

  let totalUpserted = 0;

  // 並列処理でバッチを実行
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const concurrentBatches = batches.slice(i, i + maxConcurrent);

    const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
      const actualBatchNumber = i + batchIndex + 1;

      // UPSERT実行
      const dbInstance = getDB();
      const insertQuery = dbInstance.insert(table).values(batch);

      // conflict時の更新設定を動的に生成
      const updateSet: Record<string, any> = {};
      updateFields.forEach((field: string) => {
        updateSet[field] = sql`excluded.${sql.identifier(field)}`;
      });

      await insertQuery.onConflictDoUpdate({
        target: conflictTarget.map((field: string) => (table as any)[field]),
        set: updateSet,
      });

      logger.debug(logContext, `Completed batch ${actualBatchNumber}/${batches.length}: ${batch.length} records`);
      return batch.length;
    });

    const results = await Promise.all(batchPromises);
    totalUpserted += results.reduce((sum, count) => sum + count, 0);

    // 進捗ログ
    const completedBatches = Math.min(i + maxConcurrent, batches.length);
    logger.debug(logContext, `Progress: ${completedBatches}/${batches.length} batches completed`);
  }

  logger.info(
    logContext,
    `Successfully upserted ${totalUpserted} records in ${batches.length} batches (${maxConcurrent} concurrent)`,
  );

  return { totalUpserted, batchCount: batches.length };
}
