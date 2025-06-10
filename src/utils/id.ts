/**
 * UUID生成ユーティリティ
 * Cloudflare Workers環境でのUUID生成をリクエストハンドラ内で行う
 */

/**
 * UUID v4を生成する
 * @returns UUID文字列
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 複数のUUIDを一度に生成する
 * @param count 生成する数
 * @returns UUID文字列の配列
 */
export function generateIds(count: number): string[] {
  return Array.from({ length: count }, () => crypto.randomUUID());
}
