"use client";

import { AlertTriangle } from "lucide-react";
import type {
  CreatorScore,
  CaptionIntelligence,
  AudienceIntelligence,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface BrandSafetyCellProps {
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
  audience: AudienceIntelligence | null;
}

function toPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v > 1 ? v : v * 100;
}

/* ------------------------------------------------------------------ */
/*  Composite safety score (0-100, higher = safer)                      */
/*                                                                      */
/*  Three weighted components:                                         */
/*   • Engagement bait inverse (40%)  — high bait = less safe            */
/*   • Sponsored-vs-organic inverse (35%) — steep drop = audience        */
/*     distrusts paid content                                           */
/*   • Suspicious-pattern penalty (25%) — any flagged pattern docks      */
/* ------------------------------------------------------------------ */

export function computeBrandSafety({
  scores,
  caption,
  audience,
}: BrandSafetyCellProps): number | null {
  const bait = toPct(caption?.engagement_bait_score ?? null);
  const delta = toPct(scores?.sponsored_vs_organic_delta ?? null);
  const suspicious = audience?.suspicious_patterns?.length ?? 0;

  if (bait == null && delta == null && suspicious === 0) return null;

  const baitScore = bait == null ? 70 : Math.max(0, 100 - bait);

  let deltaScore = 70;
  if (delta != null) {
    if (delta >= 0) deltaScore = 100;
    else if (delta >= -15) deltaScore = 85;
    else if (delta >= -30) deltaScore = 65;
    else if (delta >= -50) deltaScore = 40;
    else deltaScore = 20;
  }

  const suspicionScore = Math.max(0, 100 - suspicious * 25);

  const composite =
    baitScore * 0.4 + deltaScore * 0.35 + suspicionScore * 0.25;
  return Math.round(composite);
}

function safetyLabel(score: number | null): string {
  if (score == null) return "--";
  if (score >= 80) return "Safe";
  if (score >= 60) return "Mostly safe";
  if (score >= 40) return "Monitor";
  return "Risky";
}

function safetyColor(score: number | null): string {
  if (score == null) return "text-foreground";
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

export function BrandSafetyCell(props: BrandSafetyCellProps) {
  const score = computeBrandSafety(props);
  const label = safetyLabel(score);
  const color = safetyColor(score);

  return (
    <div className="flex-1 min-w-[130px] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Brand Safety
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight leading-none",
          color,
        )}
      >
        {score != null ? score : "--"}
      </p>
      <div className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
        {label}
        {score != null && score < 40 && (
          <AlertTriangle className="size-3 text-destructive" />
        )}
      </div>
    </div>
  );
}
