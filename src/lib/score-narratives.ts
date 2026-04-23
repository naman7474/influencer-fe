/* ------------------------------------------------------------------ */
/*  Score Narratives                                                    */
/*  Converts raw numeric scores to human-readable labels/verdicts.     */
/*  Used across creator profile and campaign components.               */
/* ------------------------------------------------------------------ */

/* ── Color coding thresholds ── */

export type ScoreLevel = "high" | "medium" | "low";

export function getScoreLevel(value: number, max = 100): ScoreLevel {
  const pct = max === 100 ? value : (value / max) * 100;
  if (pct >= 70) return "high";
  if (pct >= 40) return "medium";
  return "low";
}

export function getScoreColor(level: ScoreLevel): string {
  switch (level) {
    case "high":
      return "text-success";
    case "medium":
      return "text-warning";
    case "low":
      return "text-destructive";
  }
}

export function getScoreBgColor(level: ScoreLevel): string {
  switch (level) {
    case "high":
      return "bg-success";
    case "medium":
      return "bg-warning";
    case "low":
      return "bg-destructive";
  }
}

/* ── Authenticity ── */

export function authenticityVerdict(pct: number | null): {
  label: string;
  level: ScoreLevel;
} {
  if (pct == null) return { label: "--", level: "medium" };
  if (pct >= 80) return { label: "Highly Authentic", level: "high" };
  if (pct >= 60) return { label: "Authentic", level: "high" };
  if (pct >= 40) return { label: "Moderate", level: "medium" };
  return { label: "Low Quality", level: "low" };
}

/* ── Engagement Rate ── */

export function engagementVerdict(er: number | null): {
  label: string;
  level: ScoreLevel;
} {
  if (er == null) return { label: "--", level: "medium" };
  const pct = er * 100;
  if (pct >= 5) return { label: "Excellent", level: "high" };
  if (pct >= 2) return { label: "Good", level: "high" };
  if (pct >= 1) return { label: "Average", level: "medium" };
  return { label: "Below Average", level: "low" };
}

/* ── CPI Score ── */

export function cpiVerdict(score: number | null): {
  label: string;
  level: ScoreLevel;
} {
  if (score == null) return { label: "--", level: "medium" };
  if (score >= 80) return { label: "Outstanding", level: "high" };
  if (score >= 60) return { label: "Strong", level: "high" };
  if (score >= 40) return { label: "Average", level: "medium" };
  return { label: "Below Average", level: "low" };
}

/* ── Content Quality ── */

export function contentQualityVerdict(score: number | null): {
  label: string;
  level: ScoreLevel;
} {
  if (score == null) return { label: "--", level: "medium" };
  if (score >= 80) return { label: "Premium", level: "high" };
  if (score >= 60) return { label: "Good", level: "high" };
  if (score >= 40) return { label: "Average", level: "medium" };
  return { label: "Needs Improvement", level: "low" };
}

/* ── Brand Safety ── */

export function brandSafetyVerdict(score: number | null): {
  label: string;
  level: ScoreLevel;
} {
  if (score == null) return { label: "--", level: "medium" };
  // score is 0-1
  const pct = score > 1 ? score : score * 100;
  if (pct >= 70) return { label: "Safe", level: "high" };
  if (pct >= 40) return { label: "Caution", level: "medium" };
  return { label: "Risk", level: "low" };
}

/* ── Posting Consistency ── */

export function consistencyVerdict(stddev: number | null): {
  label: string;
  level: ScoreLevel;
} {
  if (stddev == null) return { label: "--", level: "medium" };
  if (stddev <= 1) return { label: "Very Consistent", level: "high" };
  if (stddev <= 2.5) return { label: "Consistent", level: "high" };
  if (stddev <= 4) return { label: "Moderate", level: "medium" };
  return { label: "Irregular", level: "low" };
}

/* ── Match Score ── */

export function matchVerdict(score: number | null): {
  label: string;
  level: ScoreLevel;
} {
  if (score == null) return { label: "--", level: "medium" };
  // score can be 0-1 or 0-100
  const pct = score > 1 ? score : Math.round(score * 100);
  if (pct >= 80) return { label: "Excellent Match", level: "high" };
  if (pct >= 60) return { label: "Good Match", level: "high" };
  if (pct >= 40) return { label: "Moderate Match", level: "medium" };
  return { label: "Weak Match", level: "low" };
}

/* ── Tier ── */

export function tierLabel(tier: string | null): string {
  if (!tier) return "Unknown";
  const map: Record<string, string> = {
    nano: "Nano (1K-10K)",
    micro: "Micro (10K-50K)",
    mid: "Mid-tier (50K-200K)",
    macro: "Macro (200K-1M)",
    mega: "Mega (1M+)",
  };
  return map[tier] ?? tier;
}

/* ── Creator summary sentence ── */

export function creatorSummary(opts: {
  tier: string | null;
  category: string | null;
  engagementTrend: string | null;
  authenticity: number | null;
}): string {
  const tierPart = opts.tier ?? "content";
  const categoryPart = opts.category ?? "content";
  const trendPart =
    opts.engagementTrend === "up"
      ? "growing"
      : opts.engagementTrend === "down"
        ? "declining"
        : "stable";
  const authPart = authenticityVerdict(opts.authenticity).label.toLowerCase();

  return `A ${tierPart} ${categoryPart} creator with ${trendPart} engagement and ${authPart} audience.`;
}
