"use client";

import type { CreatorScore, CreatorBrandMatch } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { CpiRing } from "@/components/creators/cpi-ring";
import { MatchBar } from "@/components/creators/match-bar";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface VerdictBannerProps {
  scores: CreatorScore | null;
  match: CreatorBrandMatch | null;
  tier: string;
  category: string | null;
  engagementTrend: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toPercent(v: number): number {
  if (v > 1) return Math.round(v);
  return Math.round(v * 100);
}

function trendLabel(trend: string | null): string {
  if (!trend) return "stable";
  if (trend === "up") return "growing";
  if (trend === "down") return "declining";
  return "stable";
}

function authenticityLabel(pct: number | null): string {
  if (pct == null) return "unknown";
  if (pct >= 80) return "highly authentic";
  if (pct >= 60) return "moderately authentic";
  return "low-authenticity";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VerdictBanner({
  scores,
  match,
  tier,
  category,
  engagementTrend,
}: VerdictBannerProps) {
  const hasMatch = match != null && match.match_score != null;

  if (hasMatch) {
    const matchPct = toPercent(match.match_score!);
    return (
      <div className="rounded-xl bg-indigo-soft p-4 ring-1 ring-primary/10 space-y-3">
        <div className="flex items-center gap-4">
          <CpiRing score={matchPct} size={72} strokeWidth={6} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Brand Match
              </span>
              <span className="text-sm font-bold text-primary">
                {matchPct}%
              </span>
            </div>
            <MatchBar score={matchPct} />
            {match.match_reasoning && (
              <p className="text-sm text-foreground leading-snug line-clamp-2">
                {match.match_reasoning}
              </p>
            )}
          </div>
        </div>

        {/* Top 3 score chips */}
        <div className="flex flex-wrap gap-2">
          {match.niche_fit_score != null && (
            <ScoreChip label="Niche Fit" value={toPercent(match.niche_fit_score)} />
          )}
          {match.brand_safety_score != null && (
            <ScoreChip
              label="Brand Safety"
              value={toPercent(match.brand_safety_score)}
            />
          )}
          {match.engagement_score != null && (
            <ScoreChip
              label="Engagement"
              value={toPercent(match.engagement_score)}
            />
          )}
        </div>
      </div>
    );
  }

  // No match — show CPI-based verdict
  const cpi = scores?.cpi ?? 0;
  const sentence = `A ${tier} ${category ?? "content"} creator with ${trendLabel(engagementTrend)} engagement and ${authenticityLabel(scores?.audience_authenticity ?? null)} audience.`;

  return (
    <div className="rounded-xl bg-indigo-soft p-4 ring-1 ring-primary/10 space-y-3">
      <div className="flex items-center gap-4">
        <CpiRing score={cpi} size={72} strokeWidth={6} />
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-sm font-semibold text-foreground">
            CPI Score
          </span>
          <p className="text-sm text-foreground leading-snug">
            {sentence}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs ring-1 ring-foreground/10",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}%</span>
    </span>
  );
}
