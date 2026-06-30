/**
 * Currency conversion utilities for PHP ↔ XLM
 *
 * For MVP, we use a fixed approximate rate cached for 1 hour.
 * In production, this should fetch live rates from CoinGecko or similar.
 */

// Fallback rate: roughly 1 XLM = ~22 PHP as of late 2024/early 2025
// Update this periodically or fetch live
const FALLBACK_PHP_PER_XLM = 22;

let cachedRate: number | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch the live XLM/PHP rate from CoinGecko.
 * Falls back to a cached or hardcoded rate if the API fails.
 */
export async function getXlmToPhpRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate && now - cacheTime < CACHE_DURATION) {
    return cachedRate;
  }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php',
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error('Rate API failed');
    const data = await res.json();
    const rate = data?.stellar?.php;
    if (typeof rate === 'number' && rate > 0) {
      cachedRate = rate;
      cacheTime = now;
      return rate;
    }
    throw new Error('No rate in response');
  } catch (error) {
    console.warn('Using fallback rate:', error);
    return FALLBACK_PHP_PER_XLM;
  }
}

/**
 * Convert PHP to XLM
 */
export function phpToXlm(php: number, rate: number): number {
  if (!rate || rate <= 0) return 0;
  return php / rate;
}

/**
 * Convert XLM to PHP
 */
export function xlmToPhp(xlm: number, rate: number): number {
  if (!rate || rate <= 0) return 0;
  return xlm * rate;
}

/**
 * Format PHP currency
 */
export function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format XLM amount
 */
export function formatXLM(amount: number, decimals = 2): string {
  return `${amount.toFixed(decimals)} XLM`;
}

/**
 * Convert stroops (i128 contract unit) to XLM
 */
export function stroopsToXlm(stroops: number | bigint): number {
  return Number(stroops) / 10_000_000;
}

/**
 * Convert XLM to stroops (for contract calls)
 */
export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}
