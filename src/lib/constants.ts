export const TIER_LABELS: Record<string, string> = {
  nano: "Nano (<10K)",
  micro: "Micro (10K-50K)",
  mid: "Mid (50K-500K)",
  macro: "Macro (500K-1M)",
  mega: "Mega (1M+)",
};

export const TIER_COLORS: Record<string, string> = {
  nano: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
  micro: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  mid: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  macro: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  mega: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
};

export const TREND_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  growing: { label: "Growing", color: "text-emerald-600", icon: "↑" },
  stable: { label: "Stable", color: "text-slate-500", icon: "→" },
  declining: { label: "Declining", color: "text-rose-500", icon: "↓" },
  insufficient_data: { label: "Insufficient", color: "text-slate-400", icon: "·" },
};

export const CPI_COLORS = {
  excellent: { min: 80, bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-300" },
  good: { min: 60, bg: "bg-sky-100", text: "text-sky-800", ring: "ring-sky-300" },
  average: { min: 40, bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-300" },
  poor: { min: 0, bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-300" },
};

export function getCPIColor(score: number) {
  if (score >= 80) return CPI_COLORS.excellent;
  if (score >= 60) return CPI_COLORS.good;
  if (score >= 40) return CPI_COLORS.average;
  return CPI_COLORS.poor;
}

export const NICHES = [
  "beauty", "fashion", "lifestyle", "fitness", "food", "travel",
  "tech", "education", "entertainment", "parenting", "finance",
  "health", "home", "art", "music", "gaming", "sports",
];

export const TONES = [
  "casual", "professional", "funny", "emotional", "educational",
  "inspirational", "sarcastic", "raw", "polished",
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizePercentValue(n?: number | null): number {
  if (n == null || Number.isNaN(n)) return 0;
  return clamp(Math.abs(n) > 1 ? n : n * 100, 0, 100);
}

export function formatNumber(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function formatPercent(n: number, decimals = 1): string {
  return normalizePercentValue(n).toFixed(decimals) + "%";
}

export function formatScore(n?: number | null): string {
  return Math.round(normalizePercentValue(n)).toString();
}

export function humanize(value?: string | null): string {
  if (!value) return "Unknown";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateLabel(
  value?: string | number | Date | null,
  locale = "en-IN"
): string {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}
