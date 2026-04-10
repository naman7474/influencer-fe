"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Mic,
  MessageSquare,
  Hash,
  Megaphone,
  Tag,
  Globe,
  Volume2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import type {
  CaptionIntelligence,
  TranscriptIntelligence,
  Json,
} from "@/lib/types/database";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
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

interface ContentTabProps {
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ContentTab({ caption, transcript }: ContentTabProps) {
  if (!caption && !transcript) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">
          No content intelligence data available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* ── Niche Breakdown ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="size-4 text-primary" />
            Niche Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {caption?.primary_niche ? (
            <>
              <NicheBar
                label="Primary"
                niche={caption.primary_niche}
                confidence={caption.niche_confidence}
              />
              {caption.secondary_niche && (
                <NicheBar
                  label="Secondary"
                  niche={caption.secondary_niche}
                  confidence={
                    caption.niche_confidence
                      ? Math.max(0, caption.niche_confidence - 0.15)
                      : null
                  }
                />
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* ── Tone Profile ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            Tone Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {caption?.primary_tone ? (
            <>
              <ToneRow label="Primary Tone" value={caption.primary_tone} />
              {caption.secondary_tone && (
                <ToneRow label="Secondary Tone" value={caption.secondary_tone} />
              )}
              {caption.formality_score != null && (
                <ScoreRow
                  label="Formality"
                  value={caption.formality_score}
                  lowLabel="Casual"
                  highLabel="Formal"
                />
              )}
              {caption.humor_score != null && (
                <ScoreRow
                  label="Humor"
                  value={caption.humor_score}
                  lowLabel="Serious"
                  highLabel="Funny"
                />
              )}
              {caption.authenticity_feel != null && (
                <ScoreRow
                  label="Authenticity"
                  value={caption.authenticity_feel}
                  lowLabel="Curated"
                  highLabel="Authentic"
                />
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* ── Language Mix ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            Language Mix
          </CardTitle>
          {caption?.primary_language && (
            <CardDescription>
              Primary: {caption.primary_language}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <LanguageMixChart data={caption?.language_mix ?? null} />
          {caption?.uses_transliteration && (
            <Badge variant="outline" className="mt-3">
              Uses transliteration
            </Badge>
          )}
          {caption?.script_types && caption.script_types.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {caption.script_types.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Content Pillars ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="size-4 text-primary" />
            Content Pillars
          </CardTitle>
        </CardHeader>
        <CardContent>
          {caption?.content_pillars && caption.content_pillars.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {caption.content_pillars.map((pillar) => (
                <Badge key={pillar} variant="secondary" className="text-xs">
                  {pillar}
                </Badge>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
          {caption?.recurring_topics && caption.recurring_topics.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Recurring Topics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {caption.recurring_topics.map((topic) => (
                  <Badge key={topic} variant="outline" className="text-[10px]">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CTA Patterns ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            CTA Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {caption?.dominant_cta_style ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Dominant Style
                </span>
                <Badge variant="secondary" className="capitalize">
                  {caption.dominant_cta_style}
                </Badge>
              </div>
              {caption.cta_frequency != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Frequency
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatPercent(caption.cta_frequency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Conversion Oriented
                </span>
                {caption.is_conversion_oriented ? (
                  <Badge variant="default" className="text-[10px]">
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    No
                  </Badge>
                )}
              </div>
              {caption.personal_storytelling_freq != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Personal Storytelling
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatPercent(caption.personal_storytelling_freq)}
                  </span>
                </div>
              )}
              {caption.engagement_bait_score != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Engagement Bait
                  </span>
                  <ScoreIndicator
                    value={caption.engagement_bait_score}
                    inverted
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
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Hook Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transcript?.avg_hook_quality != null ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Avg Score
                </span>
                <HookScoreBadge score={transcript.avg_hook_quality} />
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
              <HookDetailsList data={transcript.hook_details} />
            </>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* ── Brand Mentions ── */}
      <Card size="sm" className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="size-4 text-primary" />
            Brand Mentions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Organic */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Organic
              </p>
              {caption?.organic_brand_mentions &&
              caption.organic_brand_mentions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {caption.organic_brand_mentions.map((brand) => (
                    <Badge key={brand} variant="secondary" className="text-xs">
                      {brand}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">None detected</p>
              )}
            </div>

            {/* Paid */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Paid / Sponsored
              </p>
              {caption?.paid_brand_mentions &&
              caption.paid_brand_mentions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {caption.paid_brand_mentions.map((brand) => (
                    <Badge key={brand} variant="outline" className="text-xs">
                      {brand}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">None detected</p>
              )}
            </div>
          </div>

          {caption?.brand_categories && caption.brand_categories.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Brand Categories
              </p>
              <div className="flex flex-wrap gap-1.5">
                {caption.brand_categories.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-[10px]">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Transcript brand mention analysis */}
          <TranscriptBrandMentions data={transcript?.brand_mention_analysis ?? null} />
        </CardContent>
      </Card>

      {/* ── Audio Quality & Speech ── */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="size-4 text-primary" />
            Audio & Speech
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transcript ? (
            <>
              {transcript.audio_quality_rating != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Audio Quality
                  </span>
                  <AudioQualityBadge rating={transcript.audio_quality_rating} />
                </div>
              )}
              {transcript.primary_spoken_language && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Spoken Language
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {transcript.primary_spoken_language}
                  </span>
                </div>
              )}
              {transcript.languages_spoken &&
                transcript.languages_spoken.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Also speaks
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {transcript.languages_spoken
                        .filter((l) => l !== transcript.primary_spoken_language)
                        .map((l) => (
                          <Badge
                            key={l}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {l}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              {transcript.vocabulary_complexity != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Vocabulary
                  </span>
                  <ScoreIndicator value={transcript.vocabulary_complexity} />
                </div>
              )}
              {transcript.educational_density != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Educational
                  </span>
                  <ScoreIndicator value={transcript.educational_density} />
                </div>
              )}
              {transcript.storytelling_score != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Storytelling
                  </span>
                  <ScoreIndicator value={transcript.storytelling_score} />
                </div>
              )}
              {transcript.filler_word_frequency != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Filler Words
                  </span>
                  <ScoreIndicator
                    value={transcript.filler_word_frequency}
                    inverted
                  />
                </div>
              )}
              {transcript.caption_vs_spoken_mismatch != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Caption/Spoken Match
                  </span>
                  {transcript.caption_vs_spoken_mismatch ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Mismatch
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Aligned
                    </Badge>
                  )}
                </div>
              )}
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

/* ── Niche horizontal bar ── */
function NicheBar({
  label,
  niche,
  confidence,
}: {
  label: string;
  niche: string;
  confidence: number | null;
}) {
  const pct = confidence != null ? Math.round(confidence * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{niche}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="cpi-gradient absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {confidence != null && (
        <p className="text-right text-[11px] text-muted-foreground">
          {formatPercent(confidence)} confidence
        </p>
      )}
    </div>
  );
}

/* ── Tone row ── */
function ToneRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="capitalize">
        {value}
      </Badge>
    </div>
  );
}

/* ── Score row with gradient bar ── */
function ScoreRow({
  label,
  value,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  lowLabel: string;
  highLabel: string;
}) {
  // value is expected 0-1
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="cpi-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/* ── Language mix bar chart ── */
function LanguageMixChart({ data }: { data: Json | null }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return <EmptyState />;
  }

  const chartData = Object.entries(data as Record<string, number>)
    .map(([name, value]) => ({
      name,
      value: typeof value === "number" ? Math.round(value * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (chartData.length === 0) return <EmptyState />;

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={55}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Score indicator (0-1 scale with color) ── */
function ScoreIndicator({
  value,
  inverted = false,
}: {
  value: number;
  inverted?: boolean;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const effective = inverted ? 100 - pct : pct;

  let color: string;
  if (effective >= 70) color = "text-success";
  else if (effective >= 40) color = "text-warning";
  else color = "text-destructive";

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            effective >= 70
              ? "bg-success"
              : effective >= 40
                ? "bg-warning"
                : "bg-destructive"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-sm font-medium", color)}>
        {formatPercent(value)}
      </span>
    </div>
  );
}

/* ── Hook score badge ── */
function HookScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let variant: "default" | "secondary" | "destructive" = "secondary";
  if (pct >= 75) variant = "default";
  else if (pct < 40) variant = "destructive";

  return (
    <Badge variant={variant} className="text-xs">
      {formatPercent(score)}
    </Badge>
  );
}

/* ── Hook details list ── */
function HookDetailsList({ data }: { data: Json | null }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const hooks = data
    .map((h) => h as Record<string, Json>)
    .filter((h) => h.text)
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
    .slice(0, 4);

  if (hooks.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Top Hooks
      </p>
      {hooks.map((hook, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg bg-muted/50 p-2"
        >
          <ArrowRight className="mt-0.5 size-3 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-foreground line-clamp-2">
              {String(hook.text)}
            </p>
            {hook.score != null && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Score: {Number(hook.score).toFixed(2)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Audio quality badge ── */
function AudioQualityBadge({ rating }: { rating: number }) {
  let label: string;
  let variant: "default" | "secondary" | "destructive" = "secondary";

  if (rating >= 0.8) {
    label = "Excellent";
    variant = "default";
  } else if (rating >= 0.6) {
    label = "Good";
    variant = "secondary";
  } else if (rating >= 0.4) {
    label = "Average";
    variant = "secondary";
  } else {
    label = "Poor";
    variant = "destructive";
  }

  return (
    <Badge variant={variant} className="text-[10px]">
      {label} ({formatPercent(rating)})
    </Badge>
  );
}

/* ── Transcript brand mention analysis ── */
function TranscriptBrandMentions({ data }: { data: Json | null }) {
  if (!data || typeof data !== "object") return null;

  let entries: Array<{ brand: string; count: number; context: string }> = [];

  if (Array.isArray(data)) {
    entries = data
      .map((d) => {
        const obj = d as Record<string, Json>;
        return {
          brand: String(obj.brand ?? obj.name ?? ""),
          count: Number(obj.count ?? obj.mentions ?? 0),
          context: String(obj.context ?? obj.type ?? ""),
        };
      })
      .filter((e) => e.brand);
  }

  if (entries.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Spoken Brand Mentions
      </p>
      <div className="space-y-1.5">
        {entries.slice(0, 5).map((entry) => (
          <div
            key={entry.brand}
            className="flex items-center justify-between text-xs"
          >
            <span className="font-medium text-foreground">{entry.brand}</span>
            <div className="flex items-center gap-2">
              {entry.context && (
                <Badge variant="outline" className="text-[10px]">
                  {entry.context}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {entry.count}x
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
