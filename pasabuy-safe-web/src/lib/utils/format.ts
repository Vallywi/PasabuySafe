// Utility functions for formatting addresses, amounts, and dates

/**
 * Truncate a Stellar address for display: GABCD...WXYZ
 */
export function truncateAddress(address: string, startChars = 4, endChars = 4): string {
  if (!address || address.length <= startChars + endChars + 3) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format stroops to human-readable amount (1 XLM = 10^7 stroops)
 */
export function formatAmount(stroops: number | bigint, decimals = 7): string {
  const amount = Number(stroops) / 10 ** decimals;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a timestamp to relative time (e.g., "2 days left")
 */
export function timeUntil(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return 'Less than 1h left';
}
