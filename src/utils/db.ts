import { eq, notInArray, sql, desc, and } from "drizzle-orm";
import {
  getDB,
  type NewUser,
  Token,
  User,
  users,
  tokenOHLCV,
  technicalAnalysis,
  type NewTechnicalAnalysis,
  type TechnicalAnalysis,
  type TokenOHLCV,
  tokens,
  NewToken,
  chatMessages,
  type NewChatMessage,
  signal,
  NewSignal,
  Signal,
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
export const getTokenOHLCV = async (
  tokenAddress: string,
  limit: number = QUERY_LIMITS.DEFAULT_OHLCV_LIMIT,
): Promise<TokenOHLCV[]> => {
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
export const createTechnicalAnalysis = async (
  data: NewTechnicalAnalysis[],
): Promise<{ success: boolean; totalUpserted: number; hasErrors: boolean }> => {
  if (data.length === 0) {
    return { success: true, totalUpserted: 0, hasErrors: false };
  }

  // データの検証とログ出力
  logger.info(`Attempting to save ${data.length} technical analysis records`);

  // 最初のレコードをサンプルとしてログ出力
  if (data.length > 0) {
    logger.info("Sample technical analysis data:", {
      sampleRecord: data[0],
      recordKeys: Object.keys(data[0]),
    });
  }

  // データの基本検証
  const validData = data.filter((record) => {
    if (!record.id || !record.token || !record.timestamp) {
      logger.warn("Invalid technical analysis record:", {
        id: record.id,
        token: record.token,
        timestamp: record.timestamp,
      });
      return false;
    }
    return true;
  });

  if (validData.length === 0) {
    logger.error("No valid technical analysis data to save");
    return { success: false, totalUpserted: 0, hasErrors: true };
  }

  if (validData.length < data.length) {
    logger.warn(`Filtered out ${data.length - validData.length} invalid records`);
  }

  const result = await batchUpsert(technicalAnalysis, validData, {
    conflictTarget: ["id"],
    updateFields: [
      "token",
      "timestamp",
      "vwap",
      "vwap_deviation",
      "obv",
      "obv_zscore",
      "percent_b",
      "bb_width",
      "atr",
      "atr_percent",
      "adx",
      "adx_direction",
      "rsi",
    ],
    batchSize: 10, // バッチサイズを小さくしてテスト
    maxConcurrency: 1, // 並行処理を無効にしてテスト
  });

  return {
    success: !result.hasErrors,
    totalUpserted: result.totalUpserted,
    hasErrors: result.hasErrors,
  };
};

export const createSignal = async (signalData: NewSignal): Promise<Signal> => {
  const db = getDB();

  // データの検証とログ出力
  logger.info("Attempting to create signal", {
    id: signalData.id,
    token: signalData.token,
    signalType: signalData.signalType,
    titleLength: signalData.title?.length || 0,
    bodyLength: signalData.body?.length || 0,
    direction: signalData.direction,
    confidence: signalData.confidence,
    timestamp: signalData.timestamp,
  });

  // bodyフィールドの長さを制限（PostgreSQLの制限を考慮）
  const sanitizedData = {
    ...signalData,
    title: signalData.title?.substring(0, 500) || "", // 500文字に制限
    body: signalData.body?.substring(0, 4000) || "", // 4000文字に制限
    explanation: signalData.explanation?.substring(0, 2000) || "", // 2000文字に制限
    confidence: signalData.confidence ? signalData.confidence.toString() : null, // stringのままにする
  };

  try {
    const [createdSignal] = await db.insert(signal).values(sanitizedData).returning();

    logger.info("Signal created successfully", {
      signalId: createdSignal.id,
      tokenAddress: createdSignal.token,
    });

    return createdSignal;
  } catch (error) {
    logger.error("Failed to create signal", {
      error: error instanceof Error ? error.message : String(error),
      signalData: {
        id: signalData.id,
        token: signalData.token,
        signalType: signalData.signalType,
        titleLength: signalData.title?.length || 0,
        bodyLength: signalData.body?.length || 0,
      },
    });
    throw error;
  }
};

/**
 * ユーザーのchat historyをデータベースから取得してBaseMessage[]に変換
 */
export const getChatHistory = async (userId: string, limit: number = 100): Promise<BaseMessage[]> => {
  const db = getDB();
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.timestamp))
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

  await db.insert(chatMessages).values(newMessage);
  logger.info(`Saved ${messageType} message for user ${userId}`);
};

/**
 * ユーザーのchat historyをクリア
 */
export const clearChatHistory = async (userId: string): Promise<void> => {
  const db = getDB();
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
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
// schemaから動的に全テーブルの型を生成（Relationを除外）
type SchemaTable = typeof users | typeof tokenOHLCV | typeof technicalAnalysis | typeof tokens | typeof chatMessages;

export const batchUpsert = async <T extends Record<string, any>>(
  table: SchemaTable,
  data: T[],
  options: {
    conflictTarget: Array<TableColumnNames<T>>;
    updateFields: Array<TableColumnNames<T>>;
    batchSize?: number;
    maxConcurrency?: number;
  },
): Promise<{ totalUpserted: number; batchCount: number; failedBatches: number; hasErrors: boolean }> => {
  if (!data || data.length === 0) {
    logger.warn("No data provided for batch upsert");
    return { totalUpserted: 0, batchCount: 0, failedBatches: 0, hasErrors: false };
  }

  const batchSize = options.batchSize || BATCH_PROCESSING.DEFAULT_BATCH_SIZE;
  const maxConcurrency = options.maxConcurrency || BATCH_PROCESSING.MAX_CONCURRENT_BATCHES;
  const batches: T[][] = [];

  // データをバッチに分割
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  logger.info(
    `Processing ${data.length} records in ${batches.length} batches (size: ${batchSize}, concurrency: ${maxConcurrency})`,
  );

  let totalUpserted = 0;
  let failedBatches = 0;

  // バッチを並行処理（制限付き）
  for (let i = 0; i < batches.length; i += maxConcurrency) {
    const currentBatches = batches.slice(i, i + maxConcurrency);
    const batchPromises = currentBatches.map(async (batch, index) => {
      const batchNumber = i + index + 1;

      try {
        const db = getDB();

        // 実行時検証: conflictTargetとupdateFieldsがテーブルのカラム名と一致するかチェック
        const sampleRecord = batch[0];
        if (sampleRecord && typeof sampleRecord === "object") {
          const recordKeys = Object.keys(sampleRecord);

          // conflictTargetの検証
          const invalidConflictFields = options.conflictTarget.filter((field) => !recordKeys.includes(field));
          if (invalidConflictFields.length > 0) {
            logger.warn(`Invalid conflict target fields: ${invalidConflictFields.join(", ")}`);
          }

          // updateFieldsの検証
          const invalidUpdateFields = options.updateFields.filter((field) => !recordKeys.includes(field));
          if (invalidUpdateFields.length > 0) {
            logger.warn(`Invalid update fields: ${invalidUpdateFields.join(", ")}`);
          }
        }

        const updateObject = options.updateFields.reduce(
          (acc, field) => {
            acc[field] = sql.raw(`excluded.${String(field)}`);
            return acc;
          },
          {} as Record<string, any>,
        );

        // Convert conflictTarget field names to actual column objects
        const conflictColumns = options.conflictTarget.map((field) => (table as any)[field]);

        await db.insert(table).values(batch).onConflictDoUpdate({
          target: conflictColumns,
          set: updateObject,
        });

        logger.info(`Batch ${batchNumber}/${batches.length} completed: ${batch.length} records`);
        return { success: true, count: batch.length };
      } catch (error) {
        logger.error(`Batch ${batchNumber}/${batches.length} failed:`, {
          error: error instanceof Error ? error.message : String(error),
          batchSize: batch.length,
          firstRecord: batch[0] ? JSON.stringify(batch[0]).substring(0, 500) : "N/A",
          conflictTarget: options.conflictTarget,
          updateFields: options.updateFields,
          tableName: (table as any)._.name || "unknown",
        });

        // データの詳細をデバッグ出力
        if (batch.length > 0) {
          logger.debug("Failed batch sample data:", {
            sampleRecords: batch.slice(0, 3).map((record, index) => ({
              index,
              record: JSON.stringify(record).substring(0, 300),
              keys: Object.keys(record),
            })),
          });
        }

        // エラーが発生してもthrowしない、結果オブジェクトを返す
        return { success: false, count: 0 };
      }
    });

    // Promise.allを使って、個別のバッチエラーでも他のバッチを継続
    const batchResults = await Promise.all(batchPromises);

    // 結果を集計
    batchResults.forEach((result) => {
      if (result.success) {
        totalUpserted += result.count;
      } else {
        failedBatches++;
      }
    });
  }

  const hasErrors = failedBatches > 0;
  const successfulBatches = batches.length - failedBatches;

  if (hasErrors) {
    logger.warn(
      `Batch upsert completed with errors: ${successfulBatches}/${batches.length} batches successful, ${totalUpserted} records processed`,
    );
  } else {
    logger.info(`Successfully upserted ${totalUpserted} records in ${batches.length} batches`);
  }

  return { totalUpserted, batchCount: batches.length, failedBatches, hasErrors };
};

/**
 * 古いOHLCVデータを定期的にクリーンアップする
 * @param retentionDays 保持日数（デフォルト：30日）
 */
export const cleanupOldOHLCVData = async (retentionDays: number = 30): Promise<void> => {
  const db = getDB();
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - retentionDays * 24 * 60 * 60;

  const deletedRows = await db
    .delete(tokenOHLCV)
    .where(sql`${tokenOHLCV.timestamp} < ${cutoffTimestamp}`)
    .returning({ token: tokenOHLCV.token, timestamp: tokenOHLCV.timestamp });

  logger.info(
    "cleanupOldOHLCVData",
    `Cleaned up ${deletedRows.length} old OHLCV records older than ${retentionDays} days`,
  );
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
    .where(and(eq(tokenOHLCV.token, tokenAddress), sql`${tokenOHLCV.timestamp} < ${cutoffRecord.timestamp}`))
    .returning({ token: tokenOHLCV.token, timestamp: tokenOHLCV.timestamp });

  logger.info(
    `Cleaned up ${deletedRows.length} old OHLCV records for token ${tokenAddress}, keeping latest ${keepCount} records`,
  );
};

/**
 * 全トークンのOHLCVデータを件数制限でクリーンアップする
 * @param keepCount 各トークンごとに保持する件数（デフォルト：1000件）
 */
export const cleanupAllTokensOHLCVByCount = async (keepCount: number = 1000): Promise<void> => {
  const tokens = await getTokens();

  logger.info(`Starting cleanup for ${tokens.length} tokens, keeping ${keepCount} records each`);

  const cleanupPromises = tokens.map((token) => cleanupTokenOHLCVByCount(token.address, keepCount));

  await Promise.all(cleanupPromises);

  logger.info(`Completed cleanup for all tokens`);
};
