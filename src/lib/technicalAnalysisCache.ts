/**
 * テクニカル分析結果のメモリキャッシュ
 * データベースアクセスを削減するため、前回の分析結果をメモリに保存
 */

import { logger } from "../utils/logger";
import type { PracticalAnalysisResult } from "./technicalAnalysis";

/**
 * キャッシュされた実戦的テクニカル分析結果
 */
interface CachedPracticalAnalysisResult {
  analysis: PracticalAnalysisResult;
  timestamp: number;
  price: number;
}

/**
 * 実戦的テクニカル分析結果のメモリキャッシュクラス
 * Cloudflare Worker環境での永続化を考慮したシンプルな実装
 */
class PracticalTACache {
  private cache = new Map<string, CachedPracticalAnalysisResult>();
  private readonly maxCacheSize = 1000; // 最大キャッシュサイズ
  private readonly cacheExpiryMs = 1000 * 60 * 60 * 24; // 24時間でキャッシュ期限切れ

  /**
   * 前回の分析結果を取得
   */
  getPreviousAnalysis(tokenAddress: string): PracticalAnalysisResult | undefined {
    const cached = this.cache.get(tokenAddress);

    if (!cached) {
      return undefined;
    }

    // キャッシュの有効期限チェック
    const now = Date.now();
    if (now - cached.timestamp > this.cacheExpiryMs) {
      logger.info(`Practical cache expired for token ${tokenAddress}`, {
        tokenAddress,
        cacheAge: now - cached.timestamp,
        expiryMs: this.cacheExpiryMs,
      });
      this.cache.delete(tokenAddress);
      return undefined;
    }

    logger.info(`Practical cache hit for token ${tokenAddress}`, {
      tokenAddress,
      cacheAge: now - cached.timestamp,
    });

    return cached.analysis;
  }

  /**
   * 分析結果をキャッシュに保存
   */
  setCachedAnalysis(
    tokenAddress: string,
    analysis: PracticalAnalysisResult,
    price: number,
    timestamp: number = Date.now(),
  ): void {
    // キャッシュサイズ制限チェック
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntry();
    }

    this.cache.set(tokenAddress, {
      analysis,
      timestamp,
      price,
    });

    logger.info(`📊 6-Indicator Analysis Cached for ${tokenAddress}`, {
      tokenAddress,
      cacheSize: this.cache.size,
      price: price.toFixed(6),
      // 実用的な6指標の詳細情報
      indicators: {
        "1_VWAP": analysis.vwap?.toFixed(6) || "N/A",
        "2_VWAP_Dev": analysis.vwapDeviation ? `${analysis.vwapDeviation.toFixed(2)}%` : "N/A",
        "3_OBV": analysis.obv?.toFixed(0) || "N/A",
        "4_OBV_ZScore": analysis.obvZScore ? `${analysis.obvZScore.toFixed(1)}σ` : "N/A",
        "5_%B": analysis.percentB?.toFixed(3) || "N/A",
        "6_BB_Width": analysis.bbWidth?.toFixed(4) || "N/A",
        "7_ATR": analysis.atr?.toFixed(6) || "N/A",
        "8_ATR%": analysis.atrPercent ? `${analysis.atrPercent.toFixed(2)}%` : "N/A",
        "9_ADX": analysis.adx?.toFixed(1) || "N/A",
        "10_ADX_Dir": analysis.adxDirection || "N/A",
        "11_RSI": analysis.rsi?.toFixed(1) || "N/A",
      },
      // 実用的な評価
      marketCondition: this.evaluateMarketCondition(analysis),
    });
  }

  /**
   * 市場状況を評価する（実用的な判断）
   */
  private evaluateMarketCondition(analysis: PracticalAnalysisResult): string {
    const conditions: string[] = [];

    // VWAP乖離率判定
    if (analysis.vwapDeviation !== undefined) {
      if (analysis.vwapDeviation >= 3) conditions.push("VWAP極値上離れ");
      else if (analysis.vwapDeviation >= 2) conditions.push("VWAP上離れ");
      else if (analysis.vwapDeviation <= -2) conditions.push("VWAP下離れ");
    }

    // OBV z-score判定
    if (analysis.obvZScore !== undefined) {
      if (analysis.obvZScore >= 2) conditions.push("資金流入強");
      else if (analysis.obvZScore <= -2) conditions.push("資金流出強");
    }

    // %B判定
    if (analysis.percentB !== undefined) {
      if (analysis.percentB > 1) conditions.push("BB上抜け");
      else if (analysis.percentB < 0) conditions.push("BB下抜け");
    }

    // ATR%判定
    if (analysis.atrPercent !== undefined) {
      if (analysis.atrPercent >= 5) conditions.push("高ボラティリティ");
    }

    // ADX判定
    if (analysis.adx !== undefined) {
      if (analysis.adx >= 40) conditions.push("過熱トレンド");
      else if (analysis.adx >= 25) conditions.push("確立トレンド");
      else if (analysis.adx < 20) conditions.push("レンジ相場");
    }

    // RSI判定
    if (analysis.rsi !== undefined) {
      if (analysis.rsi >= 70) conditions.push("RSI買われすぎ");
      else if (analysis.rsi <= 30) conditions.push("RSI売られすぎ");
    }

    return conditions.length > 0 ? conditions.join(", ") : "通常範囲";
  }

  /**
   * 最も古いエントリを削除
   */
  private evictOldestEntry(): void {
    let oldestKey: string | undefined;
    let oldestTimestamp = Number.MAX_SAFE_INTEGER;

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.info(`Evicted oldest practical cache entry: ${oldestKey}`, {
        evictedKey: oldestKey,
        evictedTimestamp: oldestTimestamp,
        newCacheSize: this.cache.size,
      });
    }
  }

  /**
   * 特定のトークンのキャッシュをクリア
   */
  clearTokenCache(tokenAddress: string): void {
    const deleted = this.cache.delete(tokenAddress);
    if (deleted) {
      logger.info(`Cleared practical cache for token ${tokenAddress}`, {
        tokenAddress,
        cacheSize: this.cache.size,
      });
    }
  }

  /**
   * 全キャッシュをクリア
   */
  clearAllCache(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    logger.info("Cleared all practical analysis cache", {
      previousCacheSize: previousSize,
    });
  }

  /**
   * キャッシュの統計情報を取得
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    tokens: string[];
    oldestEntry?: { token: string; age: number };
    hitRate?: number;
  } {
    const tokens = Array.from(this.cache.keys());
    let oldestEntry: { token: string; age: number } | undefined;

    if (tokens.length > 0) {
      let oldestTimestamp = Number.MAX_SAFE_INTEGER;
      let oldestToken = "";

      for (const [token, cached] of this.cache.entries()) {
        if (cached.timestamp < oldestTimestamp) {
          oldestTimestamp = cached.timestamp;
          oldestToken = token;
        }
      }

      if (oldestToken) {
        oldestEntry = {
          token: oldestToken,
          age: Date.now() - oldestTimestamp,
        };
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      tokens,
      oldestEntry,
    };
  }
}

// シングルトンインスタンス
let practicalCacheInstance: PracticalTACache | undefined;

/**
 * 実戦的テクニカル分析キャッシュのシングルトンインスタンスを取得
 * Cloudflare Worker環境での使用を考慮した実装
 */
export const getTACache = (): PracticalTACache => {
  if (!practicalCacheInstance) {
    practicalCacheInstance = new PracticalTACache();
    logger.info("Created practical technical analysis cache instance");
  }
  return practicalCacheInstance;
};

export type { CachedPracticalAnalysisResult };
