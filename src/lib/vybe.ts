// NOTE: @see https://docs.vybenetwork.com/reference/get_token_trade_ohlc

import { ok, err, Result } from "neverthrow";
import { logger } from "../utils/logger";
import { isValidSolanaAddress } from "../utils/solana";

export type VybeOHLCVData = {
  time: number; // UNIX timestamp (int64)
  open: string; // float number string
  high: string; // float number string
  low: string; // float number string
  close: string; // float number string
  volume: string; // float number string
  volumeUsd: string; // float number string
  count: number;
};

export type VybeTokenOHLCVResponse = {
  data: VybeOHLCVData[];
  timeframe: string;
  mintAddress: string;
  success: boolean;
};

// APIドキュメントに基づく有効なtimeframe値
export type VybeTimeframe = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "3h" | "4h" | "1d" | "1w" | "1mo" | "1y";

// エラー型の定義
export type VybeAPIError = {
  type: "network" | "validation" | "api" | "parsing";
  message: string;
  status?: number;
  mintAddress?: string;
};

// Vybe Network API の公式エンドポイント
const BASE_URL = process.env.VYBE_API_URL || "https://api.vybenetwork.xyz";
const API_KEY = process.env.VYBE_API_KEY!;

const authFetch = (url: string) => {
  return fetch(url, {
    headers: {
      "x-api-key": API_KEY,
    },
  });
};

/**
 * トークンのOHLCV（Open, High, Low, Close, Volume）データを取得する
 * @param mintAddress トークンのmintアドレス
 * @param resolution 時間軸（1h, 4h, 1d, 1w）
 * @param options オプションパラメータ
 */
export const fetchTokenOHLCV = async (
  mintAddress: string,
  resolution: VybeTimeframe = "5m",
  options?: {
    timeStart?: number; // UNIX timestamp (int64)
    timeEnd?: number; // UNIX timestamp (int64)
    limit?: number; // int32, 最大1000
    page?: number; // int32
  },
): Promise<Result<VybeTokenOHLCVResponse, VybeAPIError>> => {
  // バリデーション
  if (!mintAddress.trim()) {
    return err({
      type: "validation",
      message: "mintAddress is required and cannot be empty",
      mintAddress,
    });
  }

  // Solana mint addressの基本的なフォーマットチェック（Base58エンコード、32-44文字）
  if (!isValidSolanaAddress(mintAddress)) {
    return err({
      type: "validation",
      message: "mintAddress must be a valid Solana address",
      mintAddress,
    });
  }

  // オプションのバリデーション
  if (options?.limit !== undefined && (options.limit <= 0 || options.limit > 1000)) {
    return err({
      type: "validation",
      message: "limit must be between 1 and 1000",
      mintAddress,
    });
  }

  if (options?.page !== undefined && options.page < 1) {
    return err({
      type: "validation",
      message: "page must be greater than 0",
      mintAddress,
    });
  }

  try {
    const params = new URLSearchParams();

    if (resolution) {
      params.append("resolution", resolution);
    }

    if (options?.timeStart) {
      params.append("timeStart", options.timeStart.toString());
    }

    if (options?.timeEnd) {
      params.append("timeEnd", options.timeEnd.toString());
    }

    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }

    if (options?.page) {
      params.append("page", options.page.toString());
    }

    const url = `${BASE_URL}/price/${mintAddress}/token-ohlcv${params.toString() ? `?${params}` : ""}`;

    logger.info(`Fetching OHLCV data for ${mintAddress}`, { url, resolution, options });

    const response = await authFetch(url);

    if (!response.ok) {
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      logger.error(`Failed to fetch token OHLCV for ${mintAddress}`, {
        status: response.status,
        statusText: response.statusText,
      });

      return err({
        type: "api",
        message: errorMessage,
        status: response.status,
        mintAddress,
      });
    }

    const result = (await response.json()) as VybeTokenOHLCVResponse;

    // レスポンスの基本的なバリデーション
    if (!result || typeof result !== "object") {
      return err({
        type: "parsing",
        message: "Invalid response format: not an object",
        mintAddress,
      });
    }

    if (!Array.isArray(result.data)) {
      return err({
        type: "parsing",
        message: "Invalid response format: data is not an array",
        mintAddress,
      });
    }

    logger.info(`Successfully fetched OHLCV data for ${mintAddress}`, {
      dataCount: result.data.length,
      resolution: result.timeframe,
    });

    // API response doesn't include timeframe and mintAddress, so we add them
    const responseWithMeta: VybeTokenOHLCVResponse = {
      ...result,
      timeframe: resolution,
      mintAddress: mintAddress,
      success: true,
    };

    return ok(responseWithMeta);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    logger.error(`Network error while fetching OHLCV for ${mintAddress}`, error);

    return err({
      type: "network",
      message: errorMessage,
      mintAddress,
    });
  }
};

/**
 * 複数トークンのOHLCVデータを並行して取得する
 * @param mintAddresses トークンのmintアドレスの配列
 * @param resolution 時間軸（1h, 4h, 1d, 1w）
 * @param options オプションパラメータ
 */
export const fetchMultipleTokenOHLCV = async (
  mintAddresses: string[],
  resolution: VybeTimeframe = "5m",
  options?: {
    timeStart?: number;
    timeEnd?: number;
    limit?: number;
    page?: number;
  },
): Promise<Result<Record<string, VybeOHLCVData[]>, VybeAPIError>> => {
  // バリデーション
  if (!Array.isArray(mintAddresses) || mintAddresses.length === 0) {
    return err({
      type: "validation",
      message: "At least one mint address is required",
    });
  }

  if (mintAddresses.length > 50) {
    return err({
      type: "validation",
      message: "Cannot fetch more than 50 tokens at once",
    });
  }

  // 重複チェック
  const uniqueAddresses = [...new Set(mintAddresses)];
  if (uniqueAddresses.length !== mintAddresses.length) {
    logger.warn("Duplicate mint addresses detected, removing duplicates");
  }

  // 事前バリデーション: 無効なアドレスがある場合は即座にエラーを返す
  for (const mintAddress of uniqueAddresses) {
    if (!mintAddress.trim()) {
      return err({
        type: "validation",
        message: "mintAddress is required and cannot be empty",
        mintAddress,
      });
    }

    if (!isValidSolanaAddress(mintAddress)) {
      return err({
        type: "validation",
        message: "mintAddress must be a valid Solana address",
        mintAddress,
      });
    }
  }

  logger.info(`Fetching OHLCV data for ${uniqueAddresses.length} tokens`, {
    resolution,
    options,
    addresses: uniqueAddresses.slice(0, 5), // 最初の5個のみログ出力
  });

  try {
    const promises = uniqueAddresses.map(async (mintAddress) => {
      const result = await fetchTokenOHLCV(mintAddress, resolution, options);
      return { mintAddress, result };
    });

    const results = await Promise.allSettled(promises);

    // 成功したデータのみを収集
    const successfulResults: Record<string, VybeOHLCVData[]> = {};
    const errors: Array<{ mintAddress: string; error: VybeAPIError }> = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const { mintAddress, result: resultValue } = result.value;
        if (resultValue.isOk()) {
          successfulResults[mintAddress] = resultValue.value.data;
        } else {
          errors.push({ mintAddress, error: resultValue.error });
          logger.warn(`Failed to fetch OHLCV for ${mintAddress}`, resultValue.error);
        }
      }
    });

    // 一つも成功しなかった場合はエラーを返す
    if (Object.keys(successfulResults).length === 0) {
      return err({
        type: "api",
        message: `Failed to fetch OHLCV data for all ${uniqueAddresses.length} tokens`,
      });
    }

    // 部分的な成功でも結果を返す（ログで失敗を記録済み）
    return ok(successfulResults);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error in batch processing";
    logger.error("Unexpected error in batch OHLCV fetch", error);

    return err({
      type: "network",
      message: errorMessage,
    });
  }
};
