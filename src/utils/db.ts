import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { and, desc, eq, getTableColumns, getTableName, inArray, notInArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { Result, err, ok } from "neverthrow";
import { BATCH_PROCESSING, QUERY_LIMITS } from "../constants/database";
import {
  NewSignal,
  NewToken,
  Signal,
  Token,
  User,
  chatMessages,
  getDB,
  schema,
  signal,
  technicalAnalysis,
  tokenOHLCV,
  tokens,
  userTokenHoldings,
  users,
  type NewChatMessage,
  type NewTechnicalAnalysis,
  type NewUser,
  type TechnicalAnalysis,
  type TokenOHLCV,
  type UserTokenHolding,
} from "../db";
import { logger } from "./logger";

import { Interface } from "helius-sdk";
import { getAssetsByOwner } from "../lib/helius";

export const getTokens = async (): Promise<Token[]> => {
  const db = getDB();
  return db.query.tokens.findMany();
};

export const createTokens = async (newTokens: NewToken[]): Promise<Token[]> => {
  const db = getDB();

  logger.info(`createTokens: Processing ${newTokens.length} tokens`);

  const validatedTokens = newTokens
    .map((token) => ({
      address: token.address || "",
      name: token.name || token.symbol || "Unknown Token", // Fallback to symbol if name is missing
      symbol: token.symbol?.trim() || `TOKEN_${token.address?.substring(0, 8)}`, // Fallback symbol
      decimals: token.decimals ?? 9, // Default to 9 decimals for Solana tokens
      iconUrl: token.iconUrl || "",
    }))
    .filter((token) => {
      const isValid = token.address && token.address.length > 0;
      if (!isValid) {
        logger.warn(`createTokens: Filtering out invalid token`, { token });
      }
      return isValid;
    });

  logger.info(`createTokens: After validation: ${validatedTokens.length} tokens`);

  // 重複するaddressを除去（symbolではなくaddressで重複チェック）
  const uniqueTokens = validatedTokens.filter(
    (token, index, array) => array.findIndex((t) => t.address === token.address) === index,
  );

  logger.info(`createTokens: After deduplication: ${uniqueTokens.length} tokens`);

  if (uniqueTokens.length === 0) {
    logger.warn("createTokens: No valid tokens to process");
    return [];
  }

  try {
    // Insert new tokens (only newly inserted ones are returned)
    await db.insert(tokens).values(uniqueTokens).onConflictDoNothing({ target: tokens.address });

    // Return all requested tokens (including existing ones)
    const allTokenAddresses = uniqueTokens.map((t) => t.address);
    const result = await db.select().from(tokens).where(inArray(tokens.address, allTokenAddresses));

    logger.info(`createTokens: Successfully processed ${result.length} tokens`);
    return result;
  } catch (error) {
    logger.error("createTokens: Database operation failed", {
      error: error instanceof Error ? error.message : String(error),
      tokensCount: uniqueTokens.length,
      sampleTokens: uniqueTokens.slice(0, 3), // Log first 3 tokens for debugging
    });
    throw error;
  }
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
  const currentUser = await getUserProfile(userId);

  const [user] = await db.update(users).set(profile).where(eq(users.userId, userId)).returning();

  // walletAddressが変更された場合、token holdingsを更新
  if (user?.walletAddress && user.walletAddress !== currentUser?.walletAddress) {
    try {
      await updateUserTokenHoldings(user.userId, user.walletAddress);
      logger.info(`Updated token holdings for user ${userId} after wallet address change`, {
        oldWalletAddress: currentUser?.walletAddress,
        newWalletAddress: user.walletAddress,
      });
    } catch (error) {
      logger.error(`Failed to update token holdings for user ${userId} after wallet address change`, {
        walletAddress: user.walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
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
 * @param tokens ユーザーが保有しているトークンのリスト（省略時はHeliusAPIから取得）
 */
export const updateUserTokenHoldings = async (
  userId: string,
  walletAddress: string,
  tokens?: Token[],
): Promise<void> => {
  try {
    const db = getDB();

    logger.info(`updateUserTokenHoldings: Starting update for user ${userId}`);

    // tokensが提供されていない場合は、HeliusAPIから取得
    let userTokens = tokens;
    if (!userTokens) {
      if (!walletAddress?.trim()) {
        logger.warn(`Empty wallet address for user ${userId}, skipping token holdings update`);
        return;
      }

      logger.info(`updateUserTokenHoldings: Fetching assets for user ${userId}`);
      const assets = await getAssetsByOwner(walletAddress);

      if (assets.length === 0) {
        logger.info(`No assets found for user ${userId} wallet ${walletAddress}, preserving existing holdings`);
        return; // Don't update holdings if no assets found - preserve existing data
      }

      // Fungible tokenのみを抽出してToken形式に変換
      const tokenData = assets
        .filter((asset) => {
          return asset.interface === Interface.FUNGIBLE_ASSET || asset.interface === Interface.FUNGIBLE_TOKEN;
        })
        .map((asset) => ({
          address: asset.id,
          symbol: asset.content?.metadata?.symbol || asset.token_info?.symbol || `NFT_${asset.id.substring(0, 8)}`,
          name: asset.content?.metadata?.name || "",
          decimals: asset.token_info?.decimals || 9,
          iconUrl: asset.content?.files?.[0]?.uri || "",
        }));

      if (tokenData.length === 0) {
        logger.info(`No fungible tokens found for user ${userId} after filtering ${assets.length} assets, preserving existing holdings`);
        return; // Don't update holdings if no fungible tokens found - preserve existing data
      }

      logger.info(`updateUserTokenHoldings: Creating ${tokenData.length} tokens for user ${userId}`);

      // tokensテーブルにトークンを作成（外部キー制約のため）
      userTokens = await createTokens(tokenData);

      if (userTokens.length === 0) {
        logger.warn(`No tokens created/found in database for user ${userId}, preserving existing holdings`);
        return; // Don't update holdings if no tokens could be created - preserve existing data
      }
    }

    // Only update if we have valid tokens
    if (userTokens.length > 0) {
      logger.info(`updateUserTokenHoldings: Updating holdings for user ${userId} with ${userTokens.length} tokens`);

      // Validate that all tokens exist in the database before proceeding
      const tokenAddresses = userTokens.map(t => t.address);
      const { tokens: tokensTable } = schema;
      const existingTokens = await db.select({ address: tokensTable.address }).from(tokensTable).where(inArray(tokensTable.address, tokenAddresses));
      const existingAddresses = new Set(existingTokens.map(t => t.address));

      const missingTokens = tokenAddresses.filter(addr => !existingAddresses.has(addr));
      if (missingTokens.length > 0) {
        logger.error(`updateUserTokenHoldings: Foreign key constraint would be violated - missing tokens in database`, {
          userId,
          missingTokens,
          totalTokens: tokenAddresses.length,
        });
        throw new Error(`Cannot update holdings: ${missingTokens.length} tokens not found in database`);
      }

      try {
        // 既存の保有記録を削除
        await db.delete(userTokenHoldings).where(eq(userTokenHoldings.userId, userId));

        // 新しい保有記録を挿入
        const holdings = userTokens.map((token) => ({
          userId,
          tokenAddress: token.address,
          lastVerifiedAt: new Date(),
        }));

        await db.insert(userTokenHoldings).values(holdings);

        logger.info(`Updated token holdings for user ${userId}`, {
          tokenCount: userTokens.length,
          walletAddress,
        });
      } catch (insertError) {
        logger.error(`updateUserTokenHoldings: Failed to insert holdings for user ${userId}`, {
          error: insertError instanceof Error ? insertError.message : String(insertError),
          tokensCount: userTokens.length,
          sampleTokens: userTokens.slice(0, 3).map(t => ({ address: t.address, symbol: t.symbol })),
        });
        throw insertError;
      }
    } else {
      logger.warn(`updateUserTokenHoldings: No tokens provided for user ${userId}, skipping update`);
    }
  } catch (error) {
    logger.error(`Failed to update token holdings for user ${userId}`, {
      walletAddress,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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

// Drizzle ORMの動的型付けによる型安全なbatchUpsert実装

/**
 * Drizzle テーブルからカラム名を動的に抽出する型
 */
type ExtractTableColumns<T extends PgTable> = keyof T["_"]["columns"] & string;

/**
 * スキーマから全テーブルを抽出する型
 */
type SchemaTableType = (typeof schema)[keyof typeof schema];

/**
 * バッチUpsertのオプション型
 */
type BatchUpsertOptions<TTable extends PgTable> = {
  readonly conflictTarget: ReadonlyArray<ExtractTableColumns<TTable>>;
  readonly updateFields: ReadonlyArray<ExtractTableColumns<TTable>>;
  readonly batchSize?: number;
  readonly maxConcurrency?: number;
};

/**
 * バッチUpsertの結果型
 */
type BatchUpsertResult = {
  readonly totalUpserted: number;
  readonly batchCount: number;
  readonly failedBatches: number;
  readonly hasErrors: boolean;
};

/**
 * バッチUpsertのエラー型
 */
type BatchUpsertError = {
  readonly type: "VALIDATION" | "DATABASE" | "UNKNOWN";
  readonly message: string;
  readonly details?: Record<string, unknown>;
};

/**
 * バッチ処理結果の型
 */
type BatchResult = {
  readonly success: boolean;
  readonly count: number;
  readonly error?: string;
};

/**
 * テーブル情報の型
 */
type TableInfo<TTable extends PgTable> = {
  readonly table: TTable;
  readonly columns: Record<string, any>;
  readonly name: string;
  readonly conflictColumns: any[];
  readonly updateObject: Record<string, any>;
};

/**
 * テーブルかどうかを判定する型ガード
 */
function isTable(value: any): value is PgTable {
  return value && typeof value === "object" && value._ && value._.columns;
}

/**
 * スキーマからテーブルのみを抽出するヘルパー
 */
function extractTablesFromSchema(schema: Record<string, any>): Record<string, PgTable> {
  const tables: Record<string, PgTable> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value)) {
      tables[key] = value as PgTable;
    }
  }

  return tables;
}

/**
 * フィールド名の検証を行う
 */
function validateFields<TTable extends PgTable>(
  fields: ReadonlyArray<string>,
  tableColumns: Record<string, any>,
  fieldType: "conflictTarget" | "updateFields",
): Result<ReadonlyArray<string>, BatchUpsertError> {
  const invalidFields = fields.filter((field) => !(field in tableColumns));

  if (invalidFields.length > 0) {
    return err({
      type: "VALIDATION",
      message: `Invalid ${fieldType} fields: ${invalidFields.join(", ")}`,
      details: { invalidFields, fieldType },
    });
  }

  return ok(fields);
}

/**
 * データベースカラム名を取得する
 */
function getDbColumnName(fieldName: string, tableColumns: Record<string, any>): string {
  const column = tableColumns[fieldName];
  if (column && typeof column === "object" && "name" in column) {
    return (column as { name: string }).name;
  }
  return fieldName;
}

/**
 * テーブル情報を準備する
 */
function prepareTableInfo<TTable extends PgTable, TData extends Record<string, any>>(
  table: TTable,
  options: BatchUpsertOptions<TTable>,
): Result<TableInfo<TTable>, BatchUpsertError> {
  const tableColumns = getTableColumns(table);
  const tableName = getTableName(table);

  // フィールドの検証
  const conflictValidation = validateFields(options.conflictTarget, tableColumns, "conflictTarget");
  if (conflictValidation.isErr()) {
    return err(conflictValidation.error);
  }

  const updateValidation = validateFields(options.updateFields, tableColumns, "updateFields");
  if (updateValidation.isErr()) {
    return err(updateValidation.error);
  }

  // UPDATE用のオブジェクト生成
  const updateObject = options.updateFields.reduce(
    (acc, field) => {
      const dbColumnName = getDbColumnName(field, tableColumns);
      acc[field] = sql.raw(`excluded.${dbColumnName}`);
      return acc;
    },
    {} as Record<string, any>,
  );

  // CONFLICT用のカラムオブジェクト配列
  const conflictColumns = options.conflictTarget.map((field) => {
    const column = tableColumns[field];
    if (!column) {
      return err({
        type: "VALIDATION",
        message: `Column '${field}' not found in table ${tableName}`,
        details: { field, tableName },
      });
    }
    return column;
  });

  // エラーチェック
  const errorResult = conflictColumns.find((col) => typeof col === "object" && "type" in col);
  if (errorResult && "type" in errorResult) {
    return errorResult as Result<never, BatchUpsertError>;
  }

  return ok({
    table,
    columns: tableColumns,
    name: tableName,
    conflictColumns: conflictColumns as any[],
    updateObject,
  });
}

/**
 * データの整合性をチェックする
 */
function validateBatchData<TData extends Record<string, any>>(
  batch: TData[],
  options: BatchUpsertOptions<any>,
  batchNumber: number,
): void {
  if (batch.length === 0) return;

  const sampleRecord = batch[0];
  const recordKeys = Object.keys(sampleRecord);

  const missingConflictFields = options.conflictTarget.filter((field) => !recordKeys.includes(field));
  const missingUpdateFields = options.updateFields.filter((field) => !recordKeys.includes(field));

  if (missingConflictFields.length > 0) {
    logger.warn(`Batch ${batchNumber}: Missing conflictTarget fields in data: ${missingConflictFields.join(", ")}`);
  }
  if (missingUpdateFields.length > 0) {
    logger.warn(`Batch ${batchNumber}: Missing updateFields in data: ${missingUpdateFields.join(", ")}`);
  }
}

/**
 * 単一バッチの処理を実行する
 */
async function processBatch<TData extends Record<string, any>>(
  batch: TData[],
  batchNumber: number,
  totalBatches: number,
  tableInfo: TableInfo<any>,
  options: BatchUpsertOptions<any>,
): Promise<BatchResult> {
  try {
    // データ整合性の事前チェック
    validateBatchData(batch, options, batchNumber);

    const db = getDB();
    await db.insert(tableInfo.table).values(batch).onConflictDoUpdate({
      target: tableInfo.conflictColumns,
      set: tableInfo.updateObject,
    });

    logger.info(`Batch ${batchNumber}/${totalBatches} completed: ${batch.length} records`);
    return { success: true, count: batch.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Batch ${batchNumber}/${totalBatches} failed:`, {
      error: errorMessage,
      batchSize: batch.length,
      tableName: tableInfo.name,
      conflictTarget: options.conflictTarget,
      updateFields: options.updateFields,
    });
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * データを指定サイズのバッチに分割する
 */
function createBatches<TData>(data: TData[], batchSize: number): TData[][] {
  const batches: TData[][] = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * バッチ結果を集計する
 */
function aggregateResults(batchResults: BatchResult[], totalBatches: number, tableName: string): BatchUpsertResult {
  let totalUpserted = 0;
  let failedBatches = 0;

  batchResults.forEach((result) => {
    if (result.success) {
      totalUpserted += result.count;
    } else {
      failedBatches++;
    }
  });

  const hasErrors = failedBatches > 0;
  const successfulBatches = totalBatches - failedBatches;

  if (hasErrors) {
    logger.warn(
      `Batch upsert completed with errors: ${successfulBatches}/${totalBatches} batches successful, ${totalUpserted} records processed`,
    );
  } else {
    logger.info(`Batch upsert completed successfully: ${totalUpserted} records processed for table '${tableName}'`);
  }

  return {
    totalUpserted,
    batchCount: totalBatches,
    failedBatches,
    hasErrors,
  };
}

/**
 * 型安全な動的batchUpsert関数
 *
 * @template TTable - Drizzleテーブルの型
 * @template TData - 挿入するデータの型
 * @param table - Drizzleテーブルオブジェクト
 * @param data - 挿入するデータの配列
 * @param options - バッチUpsertオプション
 * @returns バッチ処理結果
 *
 * @example
 * ```typescript
 * // technicalAnalysisテーブルへの挿入
 * const result = await batchUpsert(technicalAnalysis, analysisData, {
 *   conflictTarget: ["id"],
 *   updateFields: ["vwap", "rsi", "signalGenerated"]
 * });
 *
 * logger.info(`Successfully processed ${result.totalUpserted} records`);
 * ```
 */
export async function batchUpsert<TTable extends PgTable, TData extends Record<string, any>>(
  table: TTable,
  data: TData[],
  options: BatchUpsertOptions<TTable>,
): Promise<BatchUpsertResult> {
  // 早期リターン：空データの場合
  if (!data || data.length === 0) {
    logger.warn("No data provided for batch upsert");
    return { totalUpserted: 0, batchCount: 0, failedBatches: 0, hasErrors: false };
  }

  // 設定値の取得
  const batchSize = options.batchSize ?? BATCH_PROCESSING.DEFAULT_BATCH_SIZE;
  const maxConcurrency = options.maxConcurrency ?? BATCH_PROCESSING.MAX_CONCURRENT_BATCHES;

  // テーブル情報の準備
  const tableInfoResult = prepareTableInfo(table, options);
  if (tableInfoResult.isErr()) {
    const errorMessage = `BatchUpsert validation failed: ${tableInfoResult.error.message}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  const tableInfo = tableInfoResult.value;

  // バッチの作成
  const batches = createBatches(data, batchSize);

  logger.info(
    `Processing ${data.length} records in ${batches.length} batches (size: ${batchSize}, concurrency: ${maxConcurrency}) for table '${tableInfo.name}'`,
  );

  try {
    // バッチ並行処理
    const allResults: BatchResult[] = [];

    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const currentBatches = batches.slice(i, i + maxConcurrency);

      const batchPromises = currentBatches.map((batch, index) =>
        processBatch(batch, i + index + 1, batches.length, tableInfo, options),
      );

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
    }

    // 結果の集計
    return aggregateResults(allResults, batches.length, tableInfo.name);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Batch upsert failed for table '${tableInfo.name}':`, { error: errorMessage });
    throw new Error(errorMessage);
  }
}

/**
 * スキーマから利用可能なテーブルの一覧を取得するヘルパー関数
 */
export function getAvailableTables(): Record<string, PgTable> {
  return extractTablesFromSchema(schema);
}

/**
 * 指定されたテーブルの利用可能なカラム名を取得するヘルパー関数
 */
export function getTableColumnNames<T extends PgTable>(table: T): Array<ExtractTableColumns<T>> {
  const columns = getTableColumns(table);
  return Object.keys(columns) as Array<ExtractTableColumns<T>>;
}

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
 * 単一ユーザーのトークン保有状況同期処理
 */
async function syncUserHoldings(user: User): Promise<Result<string, string>> {
  if (!user.walletAddress) {
    const error = `User ${user.userId} has no wallet address`;
    logger.warn(error);
    return err(error);
  }

  try {
    await updateUserTokenHoldings(user.userId, user.walletAddress);
    logger.info(`Synced holdings for user ${user.userId}`);
    return ok(user.userId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to sync holdings for user ${user.userId}`, { error: errorMessage });
    return err(errorMessage);
  }
}

/**
 * バッチ処理で複数ユーザーのトークン保有状況を同期
 */
async function processBatchUserSync(
  users: User[],
  batchNumber: number,
  totalBatches: number,
): Promise<{ successCount: number; failureCount: number }> {
  logger.info(`Processing batch ${batchNumber}/${totalBatches} with ${users.length} users`);

  const results = await Promise.all(users.map(syncUserHoldings));

  const successCount = results.filter((result) => result.isOk()).length;
  const failureCount = results.length - successCount;

  logger.info(`Batch ${batchNumber}/${totalBatches} completed: ${successCount} success, ${failureCount} failures`);

  return { successCount, failureCount };
}

/**
 * 全ユーザーのトークン保有状況を同期する
 *
 * @param options - 同期オプション
 * @param options.batchSize - 一度に処理するユーザー数（デフォルト：10）
 * @param options.delayMs - バッチ間の遅延時間（デフォルト：1000ms）
 * @returns 同期結果の統計情報
 */
export const syncAllUserTokenHoldings = async (
  options: {
    batchSize?: number;
    delayMs?: number;
  } = {},
): Promise<{ totalUsers: number; successCount: number; failureCount: number }> => {
  const { batchSize = 10, delayMs = 1000 } = options;

  const allUsers = await getUsers();
  logger.info(`Starting token holdings sync for ${allUsers.length} users (batch size: ${batchSize})`);

  if (allUsers.length === 0) {
    logger.info("No users found to sync");
    return { totalUsers: 0, successCount: 0, failureCount: 0 };
  }

  // バッチに分割
  const batches: User[][] = [];
  for (let i = 0; i < allUsers.length; i += batchSize) {
    batches.push(allUsers.slice(i, i + batchSize));
  }

  let totalSuccessCount = 0;
  let totalFailureCount = 0;

  // バッチごとに処理
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;

    const batchResult = await processBatchUserSync(batch, batchNumber, batches.length);

    totalSuccessCount += batchResult.successCount;
    totalFailureCount += batchResult.failureCount;

    // 最後のバッチ以外では遅延を挟む
    if (i < batches.length - 1) {
      logger.debug(`Waiting ${delayMs}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  logger.info(
    `Completed token holdings sync: ${totalSuccessCount} success, ${totalFailureCount} failures out of ${allUsers.length} users`,
  );

  return {
    totalUsers: allUsers.length,
    successCount: totalSuccessCount,
    failureCount: totalFailureCount,
  };
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
