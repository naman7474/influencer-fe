"use client";

import type {
  CaptionIntelligence,
  AudienceIntelligence,
  CreatorScore,
  CreatorBrandMatch,
  Creator,
} from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchEvidenceProps {
  match: CreatorBrandMatch;
  creator: Creator;
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
  audience: AudienceIntelligence | null;
}

function toPct(v: number | null | undefined): number {
  if (v == null) return 0;
  return Math.round(v > 1 ? v : v * 100);
}

/* ------------------------------------------------------------------ */
/*  Build evidence sentences from underlying metrics                    */
/* ------------------------------------------------------------------ */

function nicheEvidence(caption: CaptionIntelligence | null): string | null {
  if (!caption?.primary_niche) return null;
  const parts = [`primary niche: ${caption.primary_niche}`];
  if (caption.secondary_niche) parts.push(`secondary: ${caption.secondary_niche}`);
  return parts.join(", ");
}

function geoEvidence(
  audience: AudienceIntelligence | null,
  creator: Creator,
): string | null {
  const country = audience?.primary_country ?? creator.country;
  if (!country) return null;
  const dom = audience?.domestic_percentage;
  if (dom != null) {
    const pct = dom > 1 ? dom : dom * 100;
    return `${pct.toFixed(0)}% audience in ${country}`;
  }
  return `Audience primarily in ${country}`;
}

function engagementEvidence(scores: CreatorScore | null): string | null {
  if (scores?.avg_engagement_rate == null) return null;
  const er = scores.avg_engagement_rate;
  const pct = er > 1 ? er : er * 100;
  const trend =
    scores.engagement_trend === "growing"
      ? ", trending up"
      : scores.engagement_trend === "declining"
        ? ", trending down"
        : "";
  return `${pct.toFixed(1)}% avg engagement${trend}`;
}

function contentStyleEvidence(caption: CaptionIntelligence | null): string | null {
  if (!caption?.primary_tone) return null;
  const pillars = caption.content_pillars?.slice(0, 2).join(", ");
  return pillars
    ? `${caption.primary_tone} tone, focuses on ${pillars}`
    : `${caption.primary_tone} tone`;
}

function safetyEvidence(
  scores: CreatorScore | null,
  caption: CaptionIntelligence | null,
): string | null {
  const delta = scores?.sponsored_vs_organic_delta;
  const bait = caption?.engagement_bait_score;
  const flags: string[] = [];
  if (delta != null) {
    const pct = delta > 1 ? delta : delta * 100;
    flags.push(`sponsored delta ${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`);
  }
  if (bait != null) {
    const pct = bait > 1 ? bait : bait * 100;
    flags.push(`engagement bait ${pct.toFixed(0)}%`);
  }
  return flags.length > 0 ? flags.join(", ") : null;
}

function priceEvidence(creator: Creator): string | null {
  const tier = creator.tier ? `${creator.tier} tier` : null;
  const followers = creator.followers
    ? `${(creator.followers / 1000).toFixed(0)}K followers`
    : null;
  return [tier, followers].filter(Boolean).join(", ") || null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MatchEvidence(props: MatchEvidenceProps) {
  const { match, scores, caption, audience, creator } = props;
  if (match.match_score == null) return null;

  const rows: { label: string; score: number; evidence: string | null }[] = [];

  if (match.niche_fit_score != null) {
    rows.push({
      label: "Niche fit",
      score: toPct(match.niche_fit_score),
      evidence: nicheEvidence(caption),
    });
  }
  if (match.audience_geo_score != null) {
    rows.push({
      label: "Audience geography",
      score: toPct(match.audience_geo_score),
      evidence: geoEvidence(audience, creator),
    });
  }
  if (match.engagement_score != null) {
    rows.push({
      label: "Engagement",
      score: toPct(match.engagement_score),
      evidence: engagementEvidence(scores),
    });
  }
  if (match.content_style_score != null) {
    rows.push({
      label: "Content style",
      score: toPct(match.content_style_score),
      evidence: contentStyleEvidence(caption),
    });
  }
  if (match.brand_safety_score != null) {
    rows.push({
      label: "Brand safety",
      score: toPct(match.brand_safety_score),
      evidence: safetyEvidence(scores, caption),
    });
  }
  if (match.price_tier_score != null) {
    rows.push({
      label: "Price tier",
      score: toPct(match.price_tier_score),
      evidence: priceEvidence(creator),
    });
  }

  if (rows.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Brand Match — Why
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {match.match_reasoning && (
          <div className="rounded-lg bg-primary/5 p-3 ring-1 ring-primary/15">
            <p className="text-xs italic leading-relaxed text-foreground">
              &ldquo;{match.match_reasoning}&rdquo;
            </p>
          </div>
        )}
        <div className="space-y-3">
          {rows.map((r) => (
            <EvidenceRow key={r.label} row={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceRow({
  row,
}: {
  row: { label: string; score: number; evidence: string | null };
}) {
  const color =
    row.score >= 70
      ? "bg-success"
      : row.score >= 40
        ? "bg-warning"
        : "bg-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{row.label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {row.score}%
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${row.score}%` }}
        />
      </div>
      {row.evidence && (
        <p className="text-[11px] text-muted-foreground">{row.evidence}</p>
      )}
    </div>
  );
}
