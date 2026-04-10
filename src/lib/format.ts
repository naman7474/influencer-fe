/* ------------------------------------------------------------------ */
/*  Formatting utilities for the Influencer Intelligence Platform      */
/* ------------------------------------------------------------------ */

/**
 * Format a follower count with K/M suffixes.
 * 45200 -> "45.2K", 1200000 -> "1.2M", 850 -> "850"
 */
export function formatFollowers(count: number): string {
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return `${parseFloat(val.toFixed(1))}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return `${parseFloat(val.toFixed(1))}K`;
  }
  return count.toString();
}

/**
 * Format a decimal value as a percentage string.
 * 0.042 -> "4.2%", 0.1 -> "10.0%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format an engagement rate (decimal) as a percentage string.
 * 0.042 -> "4.2%"
 */
export function formatEngagementRate(rate: number): string {
  return formatPercent(rate, 1);
}

/**
 * Return the trend icon character, CSS color class, and human label
 * for a given trend direction string.
 */
export function getTrendIcon(trend: string): {
  icon: string;
  color: string;
  label: string;
} {
  const normalized = trend.toLowerCase();

  if (normalized === "growing" || normalized === "up") {
    return { icon: "\u2197", color: "text-success", label: "Growing" };
  }
  if (normalized === "declining" || normalized === "down") {
    return { icon: "\u2198", color: "text-destructive", label: "Declining" };
  }
  // stable / unknown
  return { icon: "\u2192", color: "text-muted-foreground", label: "Stable" };
}

/**
 * Format a monetary amount with currency symbol and thousand separators.
 * formatCurrency(15000, "INR") -> "₹15,000"
 * formatCurrency(15000, "USD") -> "$15,000"
 */
export function formatCurrency(
  amount: number,
  currency: string = "INR"
): string {
  const symbols: Record<string, string> = {
    INR: "\u20B9",
    USD: "$",
    EUR: "\u20AC",
    GBP: "\u00A3",
  };

  const symbol = symbols[currency.toUpperCase()] ?? currency + " ";
  const formatted = amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

  return `${symbol}${formatted}`;
}
