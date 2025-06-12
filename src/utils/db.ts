import { eq, notInArray, sql, desc, and } from "drizzle-orm";
import {
  getDB,
  type NewUser,
  schema,
  Token,
  User,
  users,
  tokenOHLCV,
  technicalAnalysis,
  tradingSignals,
  type NewTechnicalAnalysis,
  type NewTradingSignal,
  type TechnicalAnalysis,
  type TokenOHLCV,
  tokens,
  NewToken,
  chatHistory,
  type ChatMessage,
  type NewChatMessage,
} from "../db";
import { logger } from "./logger";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { QUERY_LIMITS, BATCH_PROCESSING } from "../constants/database";

export const getTokens = async (): Promise<Token[]> => {
  const db = getDB();
  return db.query.tokens.findMany();
};

export const createTokens = async (newTokens: NewToken[]): Promise<Token[]> => {
  const db = getDB();
  return await db
    .insert(tokens)
    .values(newTokens)
    .onConflictDoNothing({
      target: tokens.address,
    })
    .returning();
};

export const getUsers = async (): Promise<User[]> => {
  const db = getDB();
  return db.query.users.findMany();
};

export const getUserIds = async (excludeUserIds: string[] = []): Promise<string[]> => {
  const db = getDB();
  const allUserIds = await db
    .select({ userId: users.userId })
    .from(users)
    .where(notInArray(users.userId, excludeUserIds));
  return allUserIds.map((u) => u.userId);
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  const db = getDB();
  const [user] = await db.select().from(users).where(eq(users.userId, userId));
  return user;
};

export const updateUserProfile = async (userId: string, profile: Partial<NewUser>): Promise<User | null> => {
  const db = getDB();
  const [user] = await db.update(users).set(profile).where(eq(users.userId, userId)).returning();
  return user;
};

export const createUserProfile = async (profile: NewUser): Promise<User> => {
  const db = getDB();
  const [user] = await db.insert(users).values(profile).returning();
  return user;
};

export const upsertUserProfile = async (profile: NewUser): Promise<User> => {
  const db = getDB();
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
  const db = getDB();
  const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
  return user;
};

/**
 * 指定したトークンの最新のOHLCVデータを指定期間分取得する
 */
export const getTokenOHLCV = async (tokenAddress: string, limit: number = QUERY_LIMITS.DEFAULT_OHLCV_LIMIT): Promise<TokenOHLCV[]> => {
  const db = getDB();
  const data = await db
    .select()
    .from(tokenOHLCV)
    .where(eq(tokenOHLCV.token, tokenAddress))
    .orderBy(desc(tokenOHLCV.timestamp))
    .limit(Math.min(limit, QUERY_LIMITS.MAX_OHLCV_LIMIT));

  // 古い順にソート（計算用）
  return data.reverse();
};

/**
 * 指定したトークンの最新のテクニカル分析データを取得する
 */
export const getLatestTechnicalAnalysis = async (tokenAddress: string): Promise<TechnicalAnalysis | null> => {
  const db = getDB();
  const [latest] = await db
    .select()
    .from(technicalAnalysis)
    .where(eq(technicalAnalysis.token, tokenAddress))
    .orderBy(desc(technicalAnalysis.timestamp))
    .limit(1);

  return latest || null;
};

/**
 * テクニカル分析データを保存する
 */
export const createTechnicalAnalysis = async (data: NewTechnicalAnalysis[]): Promise<void> => {
  if (data.length === 0) return;

  await batchUpsert(technicalAnalysis, data, {
    conflictTarget: ["id"],
    updateFields: [
      "rsi",
      "macd",
      "macd_signal",
      "macd_histogram",
      "bb_upper",
      "bb_middle",
      "bb_lower",
      "sma_20",
      "sma_50",
      "ema_12",
      "ema_26",
      "volume_sma",
    ],
  });
};

/**
 * 取引シグナルを保存する
 */
export const createTradingSignals = async (data: NewTradingSignal[]): Promise<void> => {
  if (data.length === 0) return;

  await batchUpsert(tradingSignals, data, {
    conflictTarget: ["id"],
    updateFields: ["signal_type", "indicator", "strength", "price", "message", "metadata"],
  });
};

/**
 * 最新の重要なシグナルを取得する（過去24時間以内）
 */
export const getRecentImportantSignals = async (
  sinceTimestamp?: number,
): Promise<
  Array<{
    token: string;
    signal_type: string;
    indicator: string;
    strength: string;
    price: string;
    message: string;
    metadata: Record<string, any> | null;
    timestamp: number;
    tokenName?: string;
    tokenSymbol?: string;
  }>
> => {
  const twentyFourHoursAgo = sinceTimestamp || Math.floor(Date.now() / 1000) - 24 * 60 * 60;

  // STRONGまたはMODERATEのシグナルのみを取得
  const db = getDB();
  const signals = await db
    .select({
      token: tradingSignals.token,
      signal_type: tradingSignals.signal_type,
      indicator: tradingSignals.indicator,
      strength: tradingSignals.strength,
      price: tradingSignals.price,
      message: tradingSignals.message,
      metadata: tradingSignals.metadata,
      timestamp: tradingSignals.timestamp,
    })
    .from(tradingSignals)
    .where(
      and(
        sql`${tradingSignals.timestamp} >= ${twentyFourHoursAgo}`,
        sql`${tradingSignals.strength} IN ('STRONG', 'MODERATE')`,
      ),
    )
    .orderBy(desc(tradingSignals.timestamp));

  return signals;
};

/**
 * ユーザーのchat historyをデータベースから取得してBaseMessage[]に変換
 */
export const getChatHistory = async (userId: string, limit: number = 100): Promise<BaseMessage[]> => {
  const db = getDB();
  const messages = await db
    .select()
    .from(chatHistory)
    .where(eq(chatHistory.userId, userId))
    .orderBy(desc(chatHistory.timestamp))
    .limit(limit);

  // 時系列順にソート（古い順）
  const sortedMessages = messages.reverse();

  // BaseMessage[]に変換
  return sortedMessages.map((msg) => {
    if (msg.messageType === "human") {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });
};

/**
 * chat messageをデータベースに保存
 */
export const saveChatMessage = async (userId: string, message: BaseMessage): Promise<void> => {
  const db = getDB();

  const messageId = crypto.randomUUID();
  const messageType = message instanceof HumanMessage ? "human" : "ai";

  const newMessage: NewChatMessage = {
    messageId,
    userId,
    content: message.content as string,
    messageType,
  };

  await db.insert(chatHistory).values(newMessage);
  logger.info(`Saved ${messageType} message for user ${userId}`);
};

/**
 * ユーザーのchat historyをクリア
 */
export const clearChatHistory = async (userId: string): Promise<void> => {
  const db = getDB();
  await db.delete(chatHistory).where(eq(chatHistory.userId, userId));
  logger.info(`Cleared chat history for user ${userId}`);
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

export const batchUpsert = async <T extends Record<string, any>>(
  table: SchemaTable,
  data: T[],
  options: {
    conflictTarget: string[];
    updateFields: string[];
    batchSize?: number;
    maxConcurrency?: number;
  },
): Promise<{ totalUpserted: number; batchCount: number }> => {
  if (!data || data.length === 0) {
    logger.warn("No data provided for batch upsert");
    return { totalUpserted: 0, batchCount: 0 };
  }

  const batchSize = options.batchSize || BATCH_PROCESSING.DEFAULT_BATCH_SIZE;
  const maxConcurrency = options.maxConcurrency || BATCH_PROCESSING.MAX_CONCURRENT_BATCHES;
  const batches: T[][] = [];

  // データをバッチに分割
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  logger.info(`Processing ${data.length} records in ${batches.length} batches (size: ${batchSize}, concurrency: ${maxConcurrency})`);

  let totalUpserted = 0;

  // バッチを並行処理（制限付き）
  for (let i = 0; i < batches.length; i += maxConcurrency) {
    const currentBatches = batches.slice(i, i + maxConcurrency);
    const batchPromises = currentBatches.map(async (batch, index) => {
      const batchNumber = i + index + 1;

      try {
        const db = getDB();

        // 実行時検証: conflictTargetとupdateFieldsがテーブルのカラム名と一致するかチェック
        const sampleRecord = batch[0];
        if (sampleRecord && typeof sampleRecord === 'object') {
          const recordKeys = Object.keys(sampleRecord);

          // conflictTargetの検証
          const invalidConflictFields = options.conflictTarget.filter(field => !recordKeys.includes(field));
          if (invalidConflictFields.length > 0) {
            logger.warn(`Invalid conflict target fields: ${invalidConflictFields.join(', ')}`);
          }

          // updateFieldsの検証
          const invalidUpdateFields = options.updateFields.filter(field => !recordKeys.includes(field));
          if (invalidUpdateFields.length > 0) {
            logger.warn(`Invalid update fields: ${invalidUpdateFields.join(', ')}`);
          }
        }

        const updateObject = options.updateFields.reduce((acc, field) => {
          acc[field] = sql.raw(`excluded.${field}`);
          return acc;
        }, {} as Record<string, any>);

        const result = await db
          .insert(table)
          .values(batch)
          .onConflictDoUpdate({
            target: options.conflictTarget as any,
            set: updateObject,
          });

        logger.info(`Batch ${batchNumber}/${batches.length} completed: ${batch.length} records`);
        return batch.length;
      } catch (error) {
        logger.error(`Batch ${batchNumber} failed:`, error);
        throw error;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    totalUpserted += batchResults.reduce((sum, count) => sum + count, 0);
  }

  logger.info(`Successfully upserted ${totalUpserted} records in ${batches.length} batches`);
  return { totalUpserted, batchCount: batches.length };
};

/**
 * 古いOHLCVデータを定期的にクリーンアップする
 * @param retentionDays 保持日数（デフォルト：30日）
 */
export const cleanupOldOHLCVData = async (retentionDays: number = 30): Promise<void> => {
  const db = getDB();
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (retentionDays * 24 * 60 * 60);

  const deletedRows = await db
    .delete(tokenOHLCV)
    .where(sql`${tokenOHLCV.timestamp} < ${cutoffTimestamp}`)
    .returning({ token: tokenOHLCV.token, timestamp: tokenOHLCV.timestamp });

  logger.info("cleanupOldOHLCVData", `Cleaned up ${deletedRows.length} old OHLCV records older than ${retentionDays} days`);
};

/**
 * 指定したトークンの古いOHLCVデータを保持件数制限でクリーンアップする
 * @param tokenAddress トークンアドレス
 * @param keepCount 保持する件数（デフォルト：1000件）
 */
export const cleanupTokenOHLCVByCount = async (tokenAddress: string, keepCount: number = 1000): Promise<void> => {
  const db = getDB();

  // 保持する最新のタイムスタンプを取得
  const [cutoffRecord] = await db
    .select({ timestamp: tokenOHLCV.timestamp })
    .from(tokenOHLCV)
    .where(eq(tokenOHLCV.token, tokenAddress))
    .orderBy(desc(tokenOHLCV.timestamp))
    .limit(1)
    .offset(keepCount - 1);

  if (!cutoffRecord) {
    logger.info(`No cleanup needed for token ${tokenAddress}`);
    return;
  }

  const deletedRows = await db
    .delete(tokenOHLCV)
    .where(
      and(
        eq(tokenOHLCV.token, tokenAddress),
        sql`${tokenOHLCV.timestamp} < ${cutoffRecord.timestamp}`
      )
    )
    .returning({ token: tokenOHLCV.token, timestamp: tokenOHLCV.timestamp });

  logger.info(`Cleaned up ${deletedRows.length} old OHLCV records for token ${tokenAddress}, keeping latest ${keepCount} records`);
};

/**
 * 全トークンのOHLCVデータを件数制限でクリーンアップする
 * @param keepCount 各トークンごとに保持する件数（デフォルト：1000件）
 */
export const cleanupAllTokensOHLCVByCount = async (keepCount: number = 1000): Promise<void> => {
  const tokens = await getTokens();

  logger.info(`Starting cleanup for ${tokens.length} tokens, keeping ${keepCount} records each`);

  const cleanupPromises = tokens.map(token =>
    cleanupTokenOHLCVByCount(token.address, keepCount)
  );

  await Promise.all(cleanupPromises);

  logger.info(`Completed cleanup for all tokens`);
};
