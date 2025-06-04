// NOTE: @see https://dev.jup.ag/docs/price-api/
// Jupiter Price API V2の型定義
type JupiterPriceData = {
  id: string;
  type: string;
  price: string;
  extraInfo?: {
    lastSwappedPrice?: {
      lastJupiterSellAt: number;
      lastJupiterSellPrice: string;
      lastJupiterBuyAt: number;
      lastJupiterBuyPrice: string;
    };
    quotedPrice?: {
      buyPrice: string;
      buyAt: number;
      sellPrice: string;
      sellAt: number;
    };
    confidenceLevel?: "high" | "medium" | "low";
    depth?: {
      buyPriceImpactRatio?: {
        depth: {
          "10": number;
          "100": number;
          "1000": number;
        };
        timestamp: number;
      };
      sellPriceImpactRatio?: {
        depth: {
          "10": number;
          "100": number;
          "1000": number;
        };
        timestamp: number;
      };
    };
  };
};

type JupiterPriceResponse = {
  data: {
    [tokenAddress: string]: JupiterPriceData;
  };
  timeTaken: number;
};

// Jupiter Price API V2の公式エンドポイント
const BASE_URL = process.env.JUPITER_API_URL || "https://lite-api.jup.ag/price/v2";

/**
 * 単一トークンの価格を取得する
 * @param tokenAddress トークンのアドレス
 * @param vsToken 価格を表示する基準トークン（デフォルト：USDC）
 * @param showExtraInfo 追加情報を取得するかどうか（デフォルト：false）
 */
export const getTokenPrice = async (
  tokenAddress: string,
  vsToken?: string,
  showExtraInfo?: boolean,
): Promise<JupiterPriceResponse> => {
  const params = new URLSearchParams({
    ids: tokenAddress,
  });

  if (vsToken && !showExtraInfo) {
    params.append("vsToken", vsToken);
  }

  if (showExtraInfo) {
    params.append("showExtraInfo", "true");
  }

  const response = await fetch(`${BASE_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch token price: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as JupiterPriceResponse;
  return result;
};

/**
 * 複数トークンの価格を取得する（最大100個まで）
 * @param tokenAddresses トークンアドレスの配列
 * @param vsToken 価格を表示する基準トークン（デフォルト：USDC）
 * @param showExtraInfo 追加情報を取得するかどうか（デフォルト：false）
 */
export const getTokenPrices = async (
  tokenAddresses: string[],
  vsToken?: string,
  showExtraInfo?: boolean,
): Promise<JupiterPriceResponse> => {
  if (tokenAddresses.length > 100) {
    throw new Error("Maximum 100 token addresses allowed per request");
  }

  const params = new URLSearchParams({
    ids: tokenAddresses.join(","),
  });

  if (vsToken && !showExtraInfo) {
    params.append("vsToken", vsToken);
  }

  if (showExtraInfo) {
    params.append("showExtraInfo", "true");
  }

  const response = await fetch(`${BASE_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch token prices: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as JupiterPriceResponse;
  return result;
};
