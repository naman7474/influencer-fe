"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Mic,
  MessageSquare,
  Users,
  TrendingUp,
  Sparkles,
  Globe,
  Palette,
} from "lucide-react";

import type {
  CreatorScore,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
  Json,
} from "@/lib/types/database";
import {
  formatPercent,
  formatEngagementRate,
  getTrendIcon,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Chart colors                                                       */
/* ------------------------------------------------------------------ */

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface OverviewTabProps {
  scores: CreatorScore | null;
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  audience: AudienceIntelligence | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OverviewTab({
  scores,
  caption,
  transcript,
  audience,
}: OverviewTabProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* ── Niche & Tone ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            Niche & Tone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {caption?.primary_niche ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Primary Niche
                </span>
                <Badge variant="secondary">{caption.primary_niche}</Badge>
              </div>
              {caption.secondary_niche && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Secondary
                  </span>
                  <Badge variant="outline">{caption.secondary_niche}</Badge>
                </div>
              )}
              {caption.niche_confidence != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Confidence
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatPercent(caption.niche_confidence)}
                  </span>
                </div>
              )}
              {caption.primary_tone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tone</span>
                  <Badge variant="secondary" className="capitalize">
                    {caption.primary_tone}
                  </Badge>
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* ── Content Mix ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scores ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Posts / week
                </span>
                <span className="text-sm font-medium text-foreground">
                  {scores.posts_per_week?.toFixed(1) ?? "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Consistency
                </span>
                <ConsistencyLabel stddev={scores.posting_consistency_stddev} />
              </div>
              <ContentMixChart data={scores.content_mix} />
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* ── Audience ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Audience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audience ? (
            <>
              {audience.primary_audience_language && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Language
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {audience.primary_audience_language}
                  </span>
                </div>
              )}
              {audience.primary_country && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Top Country
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {audience.primary_country}
                  </span>
                </div>
              )}
              <GeoRegionsPreview data={audience.geo_regions} />
              {audience.authenticity_score != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Authenticity
                  </span>
                  <ScoreBar
                    value={audience.authenticity_score}
                    label={`${audience.authenticity_score}%`}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* ── Engagement ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Engagement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scores ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg ER</span>
                <span className="text-sm font-medium text-foreground">
                  {scores.avg_engagement_rate
                    ? formatEngagementRate(scores.avg_engagement_rate)
                    : "--"}
                </span>
              </div>
              {scores.engagement_trend && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trend</span>
                  <TrendBadge trend={scores.engagement_trend} />
                </div>
              )}
              {scores.creator_reply_rate != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Reply Rate
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatPercent(scores.creator_reply_rate)}
                  </span>
                </div>
              )}
              {audience?.community_strength != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Community
                  </span>
                  <ScoreBar
                    value={audience.community_strength}
                    label={`${audience.community_strength}%`}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* ── Hook Quality ── */}
      <Card size="sm" className="sm:col-span-2 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="size-4 text-primary" />
            Hook Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transcript?.avg_hook_quality != null ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Avg Hook Score
                </span>
                <ScoreBar
                  value={Math.round(transcript.avg_hook_quality * 100)}
                  label={formatPercent(transcript.avg_hook_quality)}
                />
              </div>
              {transcript.dominant_hook_style && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Dominant Style
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {transcript.dominant_hook_style}
                  </Badge>
                </div>
              )}
              <BestHookExample hookDetails={transcript.hook_details} />
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <p className="py-4 text-center text-xs text-muted-foreground">
      No data available
    </p>
  );
}

function ConsistencyLabel({ stddev }: { stddev: number | null }) {
  if (stddev == null) return <span className="text-sm text-muted-foreground">--</span>;

  let label: string;
  let color: string;
  if (stddev <= 1) {
    label = "Very consistent";
    color = "text-success";
  } else if (stddev <= 2.5) {
    label = "Consistent";
    color = "text-success";
  } else if (stddev <= 4) {
    label = "Moderate";
    color = "text-warning";
  } else {
    label = "Irregular";
    color = "text-destructive";
  }

  return <span className={cn("text-sm font-medium", color)}>{label}</span>;
}

function TrendBadge({ trend }: { trend: string }) {
  const t = getTrendIcon(trend);
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm font-medium", t.color)}
    >
      {t.icon} {t.label}
    </span>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="cpi-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

function ContentMixChart({ data }: { data: Json | null }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const chartData = Object.entries(data as Record<string, number>)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) return null;

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={60}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GeoRegionsPreview({ data }: { data: Json | null }) {
  if (!data) return null;

  let regions: Array<{ region: string; percentage: number }> = [];

  if (Array.isArray(data)) {
    regions = data
      .slice(0, 3)
      .map((r) => {
        const obj = r as Record<string, Json>;
        // Pipeline writes "confidence" (0-1), also support "percentage"/"pct"
        const rawVal = Number(obj.confidence ?? obj.percentage ?? obj.pct ?? 0);
        return {
          region: String(obj.region ?? obj.country ?? "Unknown"),
          percentage: rawVal > 1 ? rawVal : rawVal * 100, // Normalize to 0-100 for display
        };
      });
  } else if (typeof data === "object") {
    regions = Object.entries(data as Record<string, number>)
      .slice(0, 3)
      .map(([region, val]) => ({
        region,
        percentage: Number(val) > 1 ? Number(val) : Number(val) * 100,
      }));
  }

  if (regions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">Top Regions</span>
      {regions.map((r) => (
        <div key={r.region} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{r.region}</span>
          <span className="font-medium text-foreground">
            {r.percentage > 1 ? `${r.percentage.toFixed(0)}%` : formatPercent(r.percentage)}
          </span>
        </div>
      ))}
    </div>
  );
}

function BestHookExample({ hookDetails }: { hookDetails: Json | null }) {
  if (!hookDetails || !Array.isArray(hookDetails) || hookDetails.length === 0)
    return null;

  const sorted = [...hookDetails]
    .map((h) => h as Record<string, Json>)
    .filter((h) => h.score != null && h.text)
    .sort((a, b) => Number(b.score) - Number(a.score));

  const best = sorted[0];
  if (!best) return null;

  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Best Hook
      </p>
      <p className="text-sm italic text-foreground">
        &ldquo;{String(best.text)}&rdquo;
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Score: {Number(best.score).toFixed(2)}
      </p>
    </div>
  );
}
