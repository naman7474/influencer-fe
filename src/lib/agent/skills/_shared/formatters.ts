/* ------------------------------------------------------------------ */
/*  Shared formatters for agent skills                                 */
/* ------------------------------------------------------------------ */

/**
 * Format a number as INR currency string.
 * e.g. 15000 → "₹15,000", 1500000 → "₹15,00,000"
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount == null) return "₹0";
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Format a large number with K/M suffix.
 * e.g. 38200 → "38.2K", 1200000 → "1.2M"
 */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || n === 0) return "0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${parseFloat(m.toFixed(1))}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return k % 1 === 0 ? `${k}K` : `${parseFloat(k.toFixed(1))}K`;
  }
  return String(n);
}

/**
 * Format a decimal as percentage string.
 * e.g. 0.051 → "5.1%", 5.1 → "5.1%"
 */
export function formatPercent(
  value: number | null | undefined,
  alreadyPercent = false
): string {
  if (value == null) return "0%";
  const pct = alreadyPercent ? value : value * 100;
  return `${parseFloat(pct.toFixed(1))}%`;
}

/**
 * Format a ROI ratio.
 * e.g. 2.5 → "2.5x", 0 → "0x"
 */
export function formatROI(ratio: number | null | undefined): string {
  if (ratio == null || ratio === 0) return "0x";
  return `${parseFloat(ratio.toFixed(1))}x`;
}

/**
 * Capitalize first letter of a string.
 */
export function capitalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
