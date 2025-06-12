/**
 * テクニカル分析結果のメモリキャッシュ
 * データベースアクセスを削減するため、前回の分析結果をメモリに保存
 */

import { logger } from "../utils/logger";
import type { AnalysisResult } from "./technicalAnalysis";

/**
 * キャッシュされたテクニカル分析結果
 */
interface CachedAnalysisResult {
  analysis: AnalysisResult;
  timestamp: number;
  price: number;
}

/**
 * テクニカル分析結果のメモリキャッシュクラス
 * Cloudflare Worker環境での永続化を考慮したシンプルな実装
 */
class TACache {
  private cache = new Map<string, CachedAnalysisResult>();
  private readonly maxCacheSize = 1000; // 最大キャッシュサイズ
  private readonly cacheExpiryMs = 1000 * 60 * 60 * 24; // 24時間でキャッシュ期限切れ

  /**
   * 前回の分析結果を取得
   */
  getPreviousAnalysis(tokenAddress: string): AnalysisResult | undefined {
    const cached = this.cache.get(tokenAddress);

    if (!cached) {
      return undefined;
    }

    // キャッシュの有効期限チェック
    const now = Date.now();
    if (now - cached.timestamp > this.cacheExpiryMs) {
      logger.info(`Cache expired for token ${tokenAddress}`, {
        tokenAddress,
        cacheAge: now - cached.timestamp,
        expiryMs: this.cacheExpiryMs,
      });
      this.cache.delete(tokenAddress);
      return undefined;
    }

    logger.info(`Cache hit for token ${tokenAddress}`, {
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
    analysis: AnalysisResult,
    price: number,
    timestamp: number = Date.now()
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

    logger.info(`Analysis cached for token ${tokenAddress}`, {
      tokenAddress,
      cacheSize: this.cache.size,
      price,
    });
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
      logger.info(`Evicted oldest cache entry: ${oldestKey}`, {
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
      logger.info(`Cleared cache for token ${tokenAddress}`, {
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
    logger.info("Cleared all technical analysis cache", {
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
let cacheInstance: TACache | undefined;

/**
 * テクニカル分析キャッシュのシングルトンインスタンスを取得
 * Cloudflare Worker環境での使用を考慮した実装
 */
export const getTACache = (): TACache => {
  if (!cacheInstance) {
    cacheInstance = new TACache();
    logger.info("Created technical analysis cache instance");
  }
  return cacheInstance;
};

export type { CachedAnalysisResult };