import { logger } from "./utils/logger";
import {
  getTokens,
  batchUpsert,
  getTokenOHLCV,
  createTechnicalAnalysis,
  cleanupAllTokensOHLCVByCount,
  createSignal,
} from "./utils/db";
import { fetchMultipleTokenOHLCV } from "./lib/vybe";
import { getTACache } from "./lib/ta-cache";
import { tokenOHLCV } from "./db";
import { calculateTechnicalIndicators, convertTAtoDbFormat, type OHLCVData } from "./lib/ta";
import { OHLCV_RETENTION } from "./constants/database";

// every 5 minutes
export const runCronTasks = async () => {
  logger.info(`cron start: ${new Date().toISOString()}`);

  // 1. トークンのOHLCVデータを更新
  await updateTokenOHLCVTask();

  // 2. テクニカル分析を実行
  await technicalAnalysisTask();

  // 3. シグナルを生成
  await generateSignalTask();

  // 1時間おきにクリーンアップを実行（5分間隔のcronが12回実行されるごと）
  if (new Date().getMinutes() === 0) await cleanupOHLCVTask();

  logger.info(`cron end: ${new Date().toISOString()}`);
};

const updateTokenOHLCVTask = async () => {
  const tokens = await getTokens();
  const tokenAddresses = tokens.map((t) => t.address);
  const result = await fetchMultipleTokenOHLCV(tokenAddresses, "5m");

  if (!result.isOk()) {
    logger.error("Failed to fetch OHLCV data", result.error);
    return;
  }

  const ohlcvValues = Object.entries(result.value).flatMap(([mintAddress, tokenResponse]) => {
    // 全てのOHLCVデータを処理（配列全体）
    return tokenResponse.map((ohlcvData) => ({
      token: mintAddress,
      timestamp: ohlcvData.time,
      open: ohlcvData.open,
      high: ohlcvData.high,
      low: ohlcvData.low,
      close: ohlcvData.close,
      volume: ohlcvData.volume,
    }));
  });

  if (ohlcvValues.length === 0) {
    logger.error("No OHLCV data found");
    return;
  }

  // 汎用batchUpsert関数を使用して効率的に処理
  await batchUpsert(tokenOHLCV, ohlcvValues, {
    conflictTarget: ["token", "timestamp"],
    updateFields: ["open", "high", "low", "close", "volume"],
  });
};

const technicalAnalysisTask = async () => {
  logger.info("Starting 6-indicator practical analysis task");

  const tokens = await getTokens();
  logger.info(`Analyzing ${tokens.length} tokens with practical trading indicators`);

  // テクニカル分析キャッシュのインスタンスを取得
  const cache = getTACache();

  const analysisPromises = tokens.map(async (token) => {
    // 最新100件のOHLCVデータを取得（テクニカル分析には十分なデータが必要）
    const ohlcvData = await getTokenOHLCV(token.address, 100);

    if (ohlcvData.length < 50) {
      logger.info(`Insufficient data for ${token.symbol}`, {
        dataLength: ohlcvData.length,
      });
      return null;
    }

    // OHLCVデータを数値に変換
    const numericData: OHLCVData[] = ohlcvData.map((d) => ({
      timestamp: d.timestamp,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseFloat(d.volume),
    }));

    // 実戦的テクニカル指標を計算
    const analysis = calculateTechnicalIndicators(numericData);
    if (!analysis) {
      logger.info(`Failed to calculate practical indicators for ${token.symbol}`);
      return null;
    }

    // 最新の価格とタイムスタンプを取得
    const latestData = numericData[numericData.length - 1];
    const currentPrice = latestData.close;
    const currentTimestamp = latestData.timestamp;

    // 6指標の詳細値をログ出力（デバッグ用）
    logger.debug(`6-Indicator Analysis for ${token.symbol}`, {
      token: token.symbol,
      price: currentPrice.toFixed(6),
      vwap: analysis.vwap?.toFixed(6),
      vwapDeviation: analysis.vwapDeviation?.toFixed(2) + "%",
      obvZScore: analysis.obvZScore?.toFixed(1) + "σ",
      percentB: analysis.percentB?.toFixed(2),
      atrPercent: analysis.atrPercent?.toFixed(1) + "%",
      adx: analysis.adx?.toFixed(0),
      adxDirection: analysis.adxDirection,
      rsi: analysis.rsi?.toFixed(0),
    });

    // 分析結果をキャッシュに保存（次回実行時のため）
    cache.setCachedAnalysis(token.address, analysis, currentPrice, currentTimestamp);

    return {
      token,
      analysis,
      currentPrice,
      currentTimestamp,
    };
  });

  // 全トークンの分析を並行実行
  const results = await Promise.allSettled(analysisPromises);
  const successfulResults = results
    .filter(
      (result): result is PromiseFulfilledResult<NonNullable<Awaited<(typeof analysisPromises)[0]>>> =>
        result.status === "fulfilled" && result.value !== null,
    )
    .map((result) => result.value);

  if (successfulResults.length === 0) {
    logger.warn("No successful practical analysis results");
    return;
  }

  // テクニカル分析結果をデータベースに保存
  const analysisData = successfulResults.map((result) =>
    convertTAtoDbFormat(result.token.address, result.currentTimestamp, result.analysis),
  );

  if (analysisData.length === 0) {
    logger.error("No practical analysis data to save");
    return;
  }

  await createTechnicalAnalysis(analysisData);
};

/**
 * 個別トークンのシグナル生成処理
 */
const processTokenSignal = async (analysis: any, db: any) => {
  // トークン情報を取得
  const { tokens, tokenOHLCV, signal } = await import("./db");
  const { eq, desc } = await import("drizzle-orm");

  const tokenInfo = await db.select().from(tokens).where(eq(tokens.address, analysis.token)).limit(1);

  if (tokenInfo.length === 0) {
    logger.warn("Token not found", { tokenAddress: analysis.token });
    return null;
  }

  const token = tokenInfo[0];

  // 現在価格を取得（最新のOHLCVから）
  const latestOHLCV = await db
    .select()
    .from(tokenOHLCV)
    .where(eq(tokenOHLCV.token, analysis.token))
    .orderBy(desc(tokenOHLCV.timestamp))
    .limit(1);

  if (latestOHLCV.length === 0) {
    logger.warn("No OHLCV data found", { tokenAddress: analysis.token });
    return null;
  }

  const currentPrice = parseFloat(latestOHLCV[0].close);

  // Signal Generator実行
  const { generateSignal } = await import("./agents/signal/graph");
  const result = await generateSignal({
    tokenAddress: analysis.token,
    tokenSymbol: token.symbol,
    currentPrice,
    technicalAnalysis: analysis,
  });

  // シグナルが生成されなかった場合は早期リターン
  if (!result.finalSignal || result.finalSignal.level < 1) {
    return null;
  }

  // DBに保存
  const signalId = `signal_${analysis.token}_${Date.now()}`;

  const createdSignal = await createSignal({
    id: signalId,
    token: analysis.token,
    signalType: result.signalDecision?.signalType || "TECHNICAL_ALERT",
    title: result.finalSignal.title,
    body: result.finalSignal.message,
    direction: result.signalDecision?.direction || "NEUTRAL",
    confidence: result.signalDecision?.confidence?.toString() || "0",
    explanation: result.signalDecision?.reasoning || "",
    timestamp: new Date(),
    value: {
      level: result.finalSignal.level,
      priority: result.finalSignal.priority,
      tags: result.finalSignal.tags,
      technicalAnalysisId: analysis.id,
      staticFilterResult: result.staticFilterResult,
    },
  });

  logger.info("Signal generated and saved", {
    signalId: createdSignal.id,
    tokenAddress: analysis.token,
    tokenSymbol: token.symbol,
    signalType: result.signalDecision?.signalType,
    level: result.finalSignal.level,
    priority: result.finalSignal.priority,
  });

  return {
    signalId: createdSignal.id,
    token: token.symbol,
    message: result.finalSignal.message,
  };
};

const generateSignalTask = async () => {
  logger.info("Starting signal generation task");

  try {
    // 最新のテクニカル分析データを取得
    const { technicalAnalysis, getDB } = await import("./db");
    const { desc } = await import("drizzle-orm");
    const db = getDB();

    const latestAnalyses = await db
      .select()
      .from(technicalAnalysis)
      .orderBy(desc(technicalAnalysis.timestamp))
      .limit(10); // 最新10件のトークンを対象

    if (latestAnalyses.length === 0) {
      logger.info("No technical analysis data found for signal generation");
      return;
    }

    // 各トークンに対してシグナル生成を並列実行
    const signalPromises = latestAnalyses.map(async (analysis) => {
      try {
        return await processTokenSignal(analysis, db);
      } catch (error) {
        logger.error("Signal generation failed for token", {
          tokenAddress: analysis.token,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    // 並列実行して結果を取得
    const results = await Promise.all(signalPromises);
    const generatedSignals = results.filter((result) => result !== null);

    logger.info("Signal generation task completed", {
      totalAnalyzed: latestAnalyses.length,
      signalsGenerated: generatedSignals.length,
      signals: generatedSignals.map((s) => ({ id: s?.signalId, token: s?.token })),
    });
  } catch (error) {
    logger.error("Signal generation task failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * OHLCVデータのクリーンアップタスク
 * 各トークンごとに最新500件のデータのみを保持し、古いデータを削除する
 */
const cleanupOHLCVTask = async () => {
  logger.info("Starting OHLCV data cleanup");

  try {
    // 定数から保持件数を取得
    await cleanupAllTokensOHLCVByCount(OHLCV_RETENTION.MAX_RECORDS_PER_TOKEN);

    logger.info(
      `Successfully completed OHLCV data cleanup, keeping ${OHLCV_RETENTION.MAX_RECORDS_PER_TOKEN} records per token`,
    );
  } catch (error) {
    logger.error("Failed to cleanup OHLCV data", error);
  }
};
