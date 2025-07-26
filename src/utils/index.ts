/**
 * Sleep utility for rate limiting and delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Convert number or undefined to string or null
 * undefined値をnullに変換するヘルパー関数
 */
export const convertToString = (value: number | undefined): string | null => {
  return value !== undefined ? value.toString() : null;
};

/**
 * Get current timestamp in ISO format
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Safely parse JSON with error handling
 */
export const safeJsonParse = <T>(jsonString: string): T | null => {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
};

/**
 * Simple retry utility for async operations
 */
export const retry = async <T>(fn: () => Promise<T>, maxAttempts: number = 3, delayMs: number = 1000): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError!;
};
