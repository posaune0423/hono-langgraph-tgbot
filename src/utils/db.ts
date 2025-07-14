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
  userTokenHoldings,
  type UserTokenHolding,
  NewUserTokenHolding,
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

  // 現在のユーザープロファイルを取得
  const currentUser = await getUserProfile(userId);

  const [user] = await db.update(users).set(profile).where(eq(users.userId, userId)).returning();

  // walletAddressが変更された場合、token holdingsを更新
  if (user && profile.walletAddress && profile.walletAddress !== currentUser?.walletAddress) {
    try {
      await updateUserTokenHoldings(user.userId, profile.walletAddress);
      logger.info(`Updated token holdings for user ${userId} after wallet address change`, {
        oldWalletAddress: currentUser?.walletAddress,
        newWalletAddress: profile.walletAddress,
      });
    } catch (error) {
      logger.error(`Failed to update token holdings for user ${userId} after wallet address change`, {
        walletAddress: profile.walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      // token holdingsの更新に失敗してもユーザープロファイルの更新は成功させる
    }
  }

  return user;
};

export const createUserProfile = async (profile: NewUser): Promise<User> => {
  const db = getDB();
  const [user] = await db.insert(users).values(profile).returning();
  return user;
};

export const upsertUserProfile = async (profile: NewUser): Promise<User> => {
  const db = getDB();

  // 既存のユーザープロファイルを取得
  const existingUser = await getUserProfile(profile.userId);

  const [user] = await db
    .insert(users)
    .values(profile)
    .onConflictDoUpdate({
      target: users.userId,
      set: profile,
    })
    .returning();

  // walletAddressが設定されており、かつ変更があった場合のみtoken holdingsを更新
  if (user.walletAddress && user.walletAddress !== existingUser?.walletAddress) {
    try {
      await updateUserTokenHoldings(user.userId, user.walletAddress);
      logger.info(`Updated token holdings for user ${user.userId} after profile upsert`, {
        oldWalletAddress: existingUser?.walletAddress,
        newWalletAddress: user.walletAddress,
        tokenHoldingsUpdated: true,
      });
    } catch (error) {
      logger.error(`Failed to update token holdings for user ${user.userId} after profile upsert`, {
        walletAddress: user.walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      // token holdingsの更新に失敗してもユーザープロファイルの更新は成功させる
    }
  }

  return user;
};

export const getUserProfileByWalletAddress = async (walletAddress: string): Promise<User | null> => {
  const db = getDB();
  const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
  return user;
};

/**
 * ユーザーのwalletAddressを更新し、token holdingsを同期する
 * @param userId ユーザーID
 * @param walletAddress 新しいwalletAddress
 * @returns 更新されたユーザーオブジェクト
 */
export const updateUserWalletAddress = async (userId: string, walletAddress: string): Promise<User | null> => {
  const db = getDB();

  // 現在のユーザープロファイルを取得
  const currentUser = await getUserProfile(userId);

  if (!currentUser) {
    logger.warn(`User not found for wallet address update: ${userId}`);
    return null;
  }

  // walletAddressが変更されない場合は何もしない
  if (currentUser.walletAddress === walletAddress) {
    logger.info(`Wallet address unchanged for user ${userId}, skipping update`);
    return currentUser;
  }

  // walletAddressを更新
  const [user] = await db.update(users).set({ walletAddress }).where(eq(users.userId, userId)).returning();

  if (!user) {
    logger.error(`Failed to update wallet address for user ${userId}`);
    return null;
  }

  // token holdingsを更新
  try {
    await updateUserTokenHoldings(user.userId, walletAddress);
    logger.info(`Successfully updated wallet address and token holdings for user ${userId}`, {
      oldWalletAddress: currentUser.walletAddress,
      newWalletAddress: walletAddress,
    });
  } catch (error) {
    logger.error(`Failed to update token holdings after wallet address change for user ${userId}`, {
      walletAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    // token holdingsの更新に失敗してもwalletAddressの更新は成功させる
  }

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
      "signalGenerated",
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

/**
 * 処理済みでない技術分析データを取得する
 */
export const getUnprocessedTechnicalAnalyses = async (limit: number = 10): Promise<TechnicalAnalysis[]> => {
  const db = getDB();
  const unprocessedAnalyses = await db
    .select()
    .from(technicalAnalysis)
    .where(eq(technicalAnalysis.signalGenerated, false))
    .orderBy(desc(technicalAnalysis.timestamp))
    .limit(limit);

  return unprocessedAnalyses;
};

/**
 * 技術分析データを処理済みにマークする
 */
export const markTechnicalAnalysisAsProcessed = async (analysisId: string): Promise<void> => {
  const db = getDB();
  await db.update(technicalAnalysis).set({ signalGenerated: true }).where(eq(technicalAnalysis.id, analysisId));

  logger.info("Technical analysis marked as processed", { analysisId });
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
    timestamp: new Date(), // 明示的にtimestampを指定
  };

  try {
    await db.insert(chatMessages).values(newMessage);
    logger.info(`Saved ${messageType} message for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to save ${messageType} message for user ${userId}`, {
      error: error instanceof Error ? error.message : String(error),
      messageId,
      contentLength: (message.content as string).length,
    });
    throw error;
  }
};

/**
 * ユーザーのchat historyをクリア
 */
export const clearChatHistory = async (userId: string): Promise<void> => {
  const db = getDB();
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  logger.info(`Cleared chat history for user ${userId}`);
};

/**
 * 最新のシグナルを取得する（指定した時間以降）
 * @param sinceTimestamp 指定した時間以降のシグナルを取得（デフォルト：15分前）
 * @param limit 最大取得件数（デフォルト：10）
 */
export const getRecentSignals = async (sinceTimestamp?: Date, limit: number = 10): Promise<Signal[]> => {
  const db = getDB();

  // デフォルトは15分前のシグナルを取得
  const defaultSinceTimestamp = sinceTimestamp || new Date(Date.now() - 15 * 60 * 1000);

  const recentSignals = await db
    .select()
    .from(signal)
    .where(sql`${signal.timestamp} >= ${defaultSinceTimestamp}`)
    .orderBy(desc(signal.timestamp))
    .limit(limit);

  return recentSignals;
};

/**
 * ユーザーのトークン保有状況を更新する
 * @param userId ユーザーID
 * @param walletAddress ウォレットアドレス
 */
export const updateUserTokenHoldings = async (userId: string, walletAddress: string): Promise<void> => {
  const { getAssetsByOwner } = await import("../lib/helius");

  try {
    // Helius APIからユーザーの保有アセットを取得
    const assets = await getAssetsByOwner(walletAddress);

    // 現在の保有トークンのアドレスを取得
    const currentTokenAddresses = assets.map((asset) => asset.id);

    // 既存の保有記録を削除
    const db = getDB();
    await db.delete(userTokenHoldings).where(eq(userTokenHoldings.userId, userId));

    // 新しい保有記録を挿入
    if (currentTokenAddresses.length > 0) {
      const newHoldings: NewUserTokenHolding[] = currentTokenAddresses.map((tokenAddress) => ({
        userId,
        tokenAddress,
        amount: "0", // 実際の保有量は必要に応じて後で実装
        lastVerifiedAt: new Date(),
      }));

      await db.insert(userTokenHoldings).values(newHoldings).onConflictDoNothing();
    }

    logger.info(`Updated token holdings for user ${userId}`, {
      tokenCount: currentTokenAddresses.length,
      walletAddress,
    });
  } catch (error) {
    logger.error(`Failed to update token holdings for user ${userId}`, {
      walletAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * 指定したトークンを保有するユーザーを取得する（データベースから）
 * @param tokenAddress トークンアドレス
 */
export const getUsersHoldingToken = async (tokenAddress: string): Promise<User[]> => {
  const db = getDB();

  const usersWithHoldings = await db
    .select({
      userId: users.userId,
      walletAddress: users.walletAddress,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      age: users.age,
      cryptoRiskTolerance: users.cryptoRiskTolerance,
      totalAssets: users.totalAssets,
      cryptoAssets: users.cryptoAssets,
      panicLevel: users.panicLevel,
      heartRate: users.heartRate,
      interests: users.interests,
      currentSetupStep: users.currentSetupStep,
      setupCompleted: users.setupCompleted,
      waitingForInput: users.waitingForInput,
      lastUpdated: users.lastUpdated,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(userTokenHoldings, eq(users.userId, userTokenHoldings.userId))
    .where(eq(userTokenHoldings.tokenAddress, tokenAddress));

  return usersWithHoldings;
};

/**
 * 指定したトークンのシンボルを取得する
 */
export const getTokenSymbol = async (tokenAddress: string): Promise<string> => {
  const db = getDB();
  const tokenInfo = await db
    .select({ symbol: tokens.symbol })
    .from(tokens)
    .where(eq(tokens.address, tokenAddress))
    .limit(1);

  return tokenInfo[0]?.symbol || tokenAddress;
};

/**
 * 指定したトークンの最新価格を取得する
 */
export const getLatestTokenPrice = async (tokenAddress: string): Promise<number | undefined> => {
  const db = getDB();
  const latestOHLCV = await db
    .select({ close: tokenOHLCV.close })
    .from(tokenOHLCV)
    .where(eq(tokenOHLCV.token, tokenAddress))
    .orderBy(desc(tokenOHLCV.timestamp))
    .limit(1);

  return latestOHLCV[0] ? parseFloat(latestOHLCV[0].close) : undefined;
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

/**
 * 全ユーザーのトークン保有状況を同期する
 * @param batchSize 一度に処理するユーザー数（デフォルト：10）
 */
export const syncAllUserTokenHoldings = async (batchSize: number = 10): Promise<void> => {
  const allUsers = await getUsers();
  const usersWithWallets = allUsers.filter((user) => user.walletAddress);

  logger.info(`Starting token holdings sync for ${usersWithWallets.length} users`);

  // バッチ処理で実行
  for (let i = 0; i < usersWithWallets.length; i += batchSize) {
    const batch = usersWithWallets.slice(i, i + batchSize);

    const batchPromises = batch.map(async (user) => {
      try {
        await updateUserTokenHoldings(user.userId, user.walletAddress!);
        logger.info(`Synced holdings for user ${user.userId}`);
      } catch (error) {
        logger.error(`Failed to sync holdings for user ${user.userId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(batchPromises);

    // API rate limitingを考慮して、バッチ間で少し待機
    if (i + batchSize < usersWithWallets.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒待機
    }
  }

  logger.info(`Completed token holdings sync for all users`);
};

/**
 * 指定したユーザーのトークン保有状況を取得する
 * @param userId ユーザーID
 */
export const getUserTokenHoldings = async (userId: string): Promise<UserTokenHolding[]> => {
  const db = getDB();

  const holdings = await db.select().from(userTokenHoldings).where(eq(userTokenHoldings.userId, userId));

  return holdings;
};
