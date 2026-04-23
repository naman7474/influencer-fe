"use client";

import { AlertTriangle } from "lucide-react";
import type {
  CreatorScore,
  CaptionIntelligence,
  AudienceIntelligence,
} from "@/lib/types/database";
import {
  formatFollowers,
  formatEngagementRate,
  getTrendIcon,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { BrandSafetyCell } from "./brand-safety-cell";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ScoreRibbonProps {
  followers: number | null;
  tier: string;
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
  audience: AudienceIntelligence | null;
}

/* ------------------------------------------------------------------ */
/*  Tier labels                                                        */
/* ------------------------------------------------------------------ */

const TIER_LABELS: Record<string, string> = {
  nano: "Nano",
  micro: "Micro",
  mid: "Mid-tier",
  macro: "Macro",
  mega: "Mega",
};

/* ------------------------------------------------------------------ */
/*  Authenticity helpers                                                */
/* ------------------------------------------------------------------ */

function authenticityLabel(pct: number | null): string {
  if (pct == null) return "--";
  if (pct >= 80) return "Highly authentic";
  if (pct >= 60) return "Authentic";
  if (pct >= 40) return "Moderate";
  return "Low";
}

function authenticityColor(pct: number | null): string {
  if (pct == null) return "text-foreground";
  if (pct >= 70) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-destructive";
}

function consistencyLabel(stddev: number | null | undefined): string {
  if (stddev == null) return "--";
  if (stddev <= 1) return "Very consistent";
  if (stddev <= 2.5) return "Consistent";
  if (stddev <= 4) return "Moderate";
  return "Irregular";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ScoreRibbon({
  followers,
  tier,
  scores,
  caption,
  audience,
}: ScoreRibbonProps) {
  const engTrend = scores?.engagement_trend
    ? getTrendIcon(scores.engagement_trend)
    : null;
  const authenticity = scores?.audience_authenticity ?? null;

  return (
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 divide-x divide-border">
      {/* Followers */}
      <StatCell
        label="Followers"
        value={followers ? formatFollowers(followers) : "--"}
        sub={`${TIER_LABELS[tier] ?? tier} tier`}
      />

      {/* CPI */}
      <StatCell
        label="CPI Score"
        value={scores?.cpi != null ? String(scores.cpi) : "--"}
        valueClass="text-primary"
        sub="Creator Performance Index"
      />

      {/* Engagement Rate */}
      <StatCell
        label="Avg ER"
        value={
          scores?.avg_engagement_rate
            ? formatEngagementRate(scores.avg_engagement_rate)
            : "--"
        }
        valueClass="text-success"
        subNode={
          engTrend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                engTrend.color,
              )}
            >
              {engTrend.icon} {engTrend.label}
            </span>
          ) : undefined
        }
      />

      {/* Authenticity */}
      <StatCell
        label="Authenticity"
        value={authenticity != null ? `${authenticity}%` : "--"}
        valueClass={authenticityColor(authenticity)}
        subNode={
          <span className="inline-flex items-center gap-1">
            {authenticityLabel(authenticity)}
            {authenticity != null && authenticity < 60 && (
              <AlertTriangle className="size-3 text-warning" />
            )}
          </span>
        }
      />

      {/* Posts / Week */}
      <StatCell
        label="Posts/Week"
        value={
          scores?.posts_per_week != null
            ? scores.posts_per_week.toFixed(1)
            : "--"
        }
        sub={consistencyLabel(scores?.posting_consistency_stddev)}
      />

      {/* Brand Safety (composite) */}
      <BrandSafetyCell
        scores={scores}
        caption={caption}
        audience={audience}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat cell                                                          */
/* ------------------------------------------------------------------ */

function StatCell({
  label,
  value,
  sub,
  subNode,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  subNode?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex-1 min-w-[130px] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight leading-none",
          valueClass ?? "text-foreground",
        )}
      >
        {value}
      </p>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {subNode ?? sub}
      </div>
    </div>
  );
}
