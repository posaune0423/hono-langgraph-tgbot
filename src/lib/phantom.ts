/**
 * Phantom Wallet Deep Link Utilities
 *
 * Functions for generating proper Phantom deep links according to official documentation:
 * https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
 */

/**
 * Parameters for browse deeplink
 */
interface BrowseDeeplinkParams {
  url: string;
  ref: string;
}

/**
 * Parameters for DEXScreener chart viewing
 */
interface DexScreenerParams {
  tokenAddress: string;
  ref?: string;
}

/**
 * Generate a browse deeplink for opening web pages within Phantom's in-app browser
 *
 * @param params - Parameters for the browse deeplink
 * @returns Phantom browse deeplink URL
 *
 * @example
 * ```typescript
 * const link = createBrowseDeeplink({
 *   url: 'https://dexscreener.com/solana/4k3DKJ...',
 *   ref: 'https://dexscreener.com'
 * });
 * ```
 */
export const createBrowseDeeplink = ({ url, ref }: BrowseDeeplinkParams): string => {
  const encodedUrl = encodeURIComponent(url);
  const encodedRef = encodeURIComponent(ref);

  return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedRef}`;
};

/**
 * Generate a Phantom deeplink for viewing token charts on DEXScreener
 *
 * @param params - Parameters for DEXScreener chart viewing
 * @returns Phantom deeplink URL to open DEXScreener in Phantom
 *
 * @example
 * ```typescript
 * const link = createDexScreenerDeeplink({
 *   tokenAddress: '4k3DKJ...',
 *   ref: 'https://example.com'
 * });
 * ```
 */
export const createDexScreenerDeeplink = ({
  tokenAddress,
  ref = "https://dexscreener.com",
}: DexScreenerParams): string => {
  const dexScreenerUrl = `https://dexscreener.com/solana/${tokenAddress}`;

  return createBrowseDeeplink({
    url: dexScreenerUrl,
    ref,
  });
};

/**
 * Generate a Telegram inline keyboard button for Phantom wallet access
 *
 * @param tokenAddress - Solana token address
 * @param tokenSymbol - Token symbol for button text (optional)
 * @param ref - Reference URL for deeplink (optional)
 * @returns Telegram button object for inline keyboard
 *
 * @example
 * ```typescript
 * const button = createPhantomButton('4k3DKJ...', 'RAY');
 * // Returns: { text: "👻 Open RAY in Phantom", url: "https://phantom.app/ul/browse/..." }
 * ```
 */
export const createPhantomButton = (tokenAddress: string, tokenSymbol?: string, ref?: string) => ({
  text: tokenSymbol ? `👻 Open ${tokenSymbol} in Phantom` : "👻 Open in Phantom",
  url: createDexScreenerDeeplink({ tokenAddress, ref }),
});

/**
 * Generate multiple Phantom-related buttons for Telegram inline keyboard
 *
 * @param tokenAddress - Solana token address
 * @param tokenSymbol - Token symbol for button text (optional)
 * @param ref - Reference URL for deeplink (optional)
 * @returns Array of Telegram button objects
 */
export const createPhantomButtons = (tokenAddress: string, tokenSymbol?: string, ref?: string) => [
  createPhantomButton(tokenAddress, tokenSymbol, ref),
];
