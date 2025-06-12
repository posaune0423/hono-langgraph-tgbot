/**
 * データベース関連の定数定義
 */

/**
 * OHLCVデータの保持ポリシー
 */
export const OHLCV_RETENTION = {
  // 各トークンごとに保持するレコード数（5分間隔なので500件 = 約1.7日分）
  MAX_RECORDS_PER_TOKEN: 500,

  // テクニカル分析で必要な最小レコード数
  MIN_RECORDS_FOR_ANALYSIS: 50,

  // クリーンアップの実行頻度（分）
  CLEANUP_INTERVAL_MINUTES: 60,
} as const;

/**
 * バッチ処理関連の定数
 */
export const BATCH_PROCESSING = {
  // バッチサイズ
  DEFAULT_BATCH_SIZE: 500,

  // 最大並行バッチ数
  MAX_CONCURRENT_BATCHES: 3,
} as const;

/**
 * クエリ関連の定数
 */
export const QUERY_LIMITS = {
  // OHLCVデータ取得時のデフォルト件数
  DEFAULT_OHLCV_LIMIT: 100,

  // 最大取得件数
  MAX_OHLCV_LIMIT: 1000,
} as const;
