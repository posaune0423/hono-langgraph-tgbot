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

export const getTokens = async (): Promise<Token[]> => {
  const db = getDB();
  return db.query.tokens.findMany();
};

export const createTokens = async (newTokens: NewToken[]): Promise<Token[]> => {
  const db = getDB();
  return db.insert(tokens).values(newTokens).returning();
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
export const getTokenOHLCV = async (tokenAddress: string, limit: number = 100): Promise<TokenOHLCV[]> => {
  const db = getDB();
  const data = await db
    .select()
    .from(tokenOHLCV)
    .where(eq(tokenOHLCV.token, tokenAddress))
    .orderBy(desc(tokenOHLCV.timestamp))
    .limit(limit);

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
    logContext: "saveTechnicalAnalysis",
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
    logContext: "saveTradingSignals",
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

  const messageId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const messageType = message instanceof HumanMessage ? "human" : "ai";

  const newMessage: NewChatMessage = {
    messageId,
    userId,
    content: message.content as string,
    messageType,
  };

  await db.insert(chatHistory).values(newMessage);
  logger.debug("saveChatMessage", `Saved ${messageType} message for user ${userId}`);
};

/**
 * ユーザーのchat historyをクリア
 */
export const clearChatHistory = async (userId: string): Promise<void> => {
  const db = getDB();
  await db.delete(chatHistory).where(eq(chatHistory.userId, userId));
  logger.info("clearChatHistory", `Cleared chat history for user ${userId}`);
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
