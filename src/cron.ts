import { logger } from "./utils/logger";
import {
  getTokens,
  batchUpsert,
  getTokenOHLCV,
  getLatestTechnicalAnalysis,
  createTechnicalAnalysis,
  createTradingSignals,
  cleanupAllTokensOHLCVByCount,
} from "./utils/db";
import { fetchMultipleTokenOHLCV } from "./lib/vybe";
import { tokenOHLCV } from "./db";
import {
  calculateTechnicalIndicators,
  generateTradingSignals,
  convertToDbFormat,
  convertSignalToDbFormat,
  type OHLCVData,
  type AnalysisResult,
} from "./lib/technicalAnalysis";
import { OHLCV_RETENTION } from "./constants/database";

// every 5 minutes
export const runCronTasks = async () => {
  logger.info(`cron start: ${new Date().toISOString()}`);

  await updateTokenOHLCVTask();
  await technicalAnalysisTask();

  // 1時間おきにクリーンアップを実行（5分間隔のcronが12回実行されるごと）
  const currentMinute = new Date().getMinutes();
  if (currentMinute === 0) {
    await cleanupOHLCVTask();
  }

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
  logger.info("Starting technical analysis task");

  const tokens = await getTokens();
  logger.info(`Analyzing ${tokens.length} tokens`);

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

    // テクニカル指標を計算
    const analysis = calculateTechnicalIndicators(numericData);
    if (!analysis) {
      logger.info(`Failed to calculate indicators for ${token.symbol}`);
      return null;
    }

    // 最新の価格とタイムスタンプを取得
    const latestData = numericData[numericData.length - 1];
    const currentPrice = latestData.close;
    const currentTimestamp = latestData.timestamp;

    // 前回の分析結果を取得（シグナル生成のため）
    const previousAnalysis = await getLatestTechnicalAnalysis(token.address);
    let previousAnalysisData: AnalysisResult | undefined;

    if (previousAnalysis) {
      previousAnalysisData = {
        rsi: previousAnalysis.rsi ? parseFloat(previousAnalysis.rsi) : undefined,
        macd: previousAnalysis.macd
          ? {
              macd: parseFloat(previousAnalysis.macd),
              signal: parseFloat(previousAnalysis.macd_signal || "0"),
              histogram: parseFloat(previousAnalysis.macd_histogram || "0"),
            }
          : undefined,
        bollingerBands: previousAnalysis.bb_upper
          ? {
              upper: parseFloat(previousAnalysis.bb_upper),
              middle: parseFloat(previousAnalysis.bb_middle || "0"),
              lower: parseFloat(previousAnalysis.bb_lower || "0"),
            }
          : undefined,
        sma20: previousAnalysis.sma_20 ? parseFloat(previousAnalysis.sma_20) : undefined,
        sma50: previousAnalysis.sma_50 ? parseFloat(previousAnalysis.sma_50) : undefined,
        ema12: previousAnalysis.ema_12 ? parseFloat(previousAnalysis.ema_12) : undefined,
        ema26: previousAnalysis.ema_26 ? parseFloat(previousAnalysis.ema_26) : undefined,
        volumeSma: previousAnalysis.volume_sma ? parseFloat(previousAnalysis.volume_sma) : undefined,
      };
    }

    // トレーディングシグナルを生成
    const signals = generateTradingSignals(analysis, currentPrice, previousAnalysisData);

    if (signals.length > 0) {
      logger.info(`Generated ${signals.length} signals for ${token.symbol}`, {
        signals: signals.map((s) => `${s.type}-${s.indicator}-${s.strength}`),
      });
    }

    return {
      token,
      analysis,
      signals,
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
    logger.warn("No successful technical analysis results");
    return;
  }

  // テクニカル分析結果をデータベースに保存
  const analysisData = successfulResults.map((result) =>
    convertToDbFormat(result.token.address, result.currentTimestamp, result.analysis),
  );

  if (analysisData.length > 0) {
    await createTechnicalAnalysis(analysisData);
    logger.info(`Saved ${analysisData.length} technical analysis records`);
  }

  // 重要なシグナルをデータベースに保存
  const allSignals = successfulResults.flatMap((result) =>
    result.signals.map((signal) =>
      convertSignalToDbFormat(result.token.address, result.currentTimestamp, result.currentPrice, signal),
    ),
  );

  if (allSignals.length === 0) {
    logger.warn("No trading signals found");
    return;
  }

  await createTradingSignals(allSignals);
  logger.info(`Saved ${allSignals.length} trading signals`);

  const importantSignals = allSignals.filter((s) => s.strength === "STRONG");
  if (importantSignals.length === 0) {
    logger.warn("No important trading signals found");
    return;
  }

  // 重要なシグナルの詳細をログ出力
  logger.info(`Found ${importantSignals.length} STRONG signals`, {
    signals: importantSignals.map((s) => ({
      token: s.token,
      type: s.signal_type,
      indicator: s.indicator,
      message: s.message,
    })),
  });

  logger.info("Technical analysis task completed successfully", {
    analyzedTokens: successfulResults.length,
    totalSignals: allSignals.length,
    strongSignals: allSignals.filter((s) => s.strength === "STRONG").length,
  });
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
