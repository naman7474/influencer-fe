"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Globe,
  ShieldCheck,
  AlertTriangle,
  MessageCircle,
  Users,
  Sparkles,
} from "lucide-react";

import type { AudienceIntelligence } from "@/lib/types/database";
import { formatPercent } from "@/lib/format";
import {
  buildCreatorZoneProfile,
  ZONE_LABELS,
  type IndiaZone,
} from "@/lib/geo/india";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";

/* ------------------------------------------------------------------ */
/*  Chart color constants (match CSS variables)                        */
/* ------------------------------------------------------------------ */

const CHART_COLORS = {
  chart1: "var(--chart-1)",
  chart2: "var(--chart-2)",
  chart3: "var(--chart-3)",
  chart4: "var(--chart-4)",
  chart5: "var(--chart-5)",
};

const AUTHENTICITY_COLORS = [CHART_COLORS.chart2, CHART_COLORS.chart3, CHART_COLORS.chart5];

/* ------------------------------------------------------------------ */
/*  Prop types                                                         */
/* ------------------------------------------------------------------ */

export interface GeoRegion {
  region: string;
  confidence: number;
  signals?: string[];
}

export interface AudienceTabProps {
  audience: AudienceIntelligence | null;
  spokenLanguage?: string | null;
  creatorCity?: string | null;
  creatorCountry?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAuthenticityLabel(score: number): {
  text: string;
  className: string;
} {
  if (score > 0.8)
    return { text: "Highly Authentic", className: "text-success" };
  if (score >= 0.6)
    return { text: "Healthy", className: "text-warning" };
  return { text: "Review Recommended", className: "text-destructive" };
}

function getSentimentBadge(sentiment: string): {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
} {
  const s = sentiment.toLowerCase();
  if (s === "positive") return { variant: "default", label: "Positive" };
  if (s === "negative") return { variant: "destructive", label: "Negative" };
  if (s === "mixed") return { variant: "outline", label: "Mixed" };
  return { variant: "secondary", label: "Neutral" };
}

function getConversationDepthLabel(depth: number | null): string {
  if (depth == null) return "Unknown";
  if (depth >= 0.7) return "Deep";
  if (depth >= 0.4) return "Moderate";
  return "Shallow";
}

function getCommunityStrengthLabel(strength: number | null): string {
  if (strength == null) return "Unknown";
  if (strength >= 0.7) return "Strong";
  if (strength >= 0.4) return "Moderate";
  return "Weak";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AudienceTab({ audience, spokenLanguage, creatorCity, creatorCountry }: AudienceTabProps) {
  if (!audience) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="mb-3 size-10 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">
          No audience data available
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Audience intelligence has not been analyzed for this creator yet.
        </p>
      </div>
    );
  }

  /* -- Parse JSONB fields -- */
  const geoRegions: GeoRegion[] = Array.isArray(audience.geo_regions)
    ? (audience.geo_regions as unknown as GeoRegion[])
    : [];

  /* -- Zone profile from multi-signal -- */
  const zoneProfile = buildCreatorZoneProfile({
    geoRegions: audience.geo_regions,
    spokenLanguage,
    creatorCity,
    creatorCountry,
  });
  const hasZoneData = Object.values(zoneProfile).some((v) => v > 0.05);
  const sortedZones = (Object.entries(zoneProfile) as [IndiaZone, number][])
    .filter(([, v]) => v > 0.05)
    .sort((a, b) => b[1] - a[1]);

  const audienceLanguages: Record<string, number> =
    audience.audience_languages != null &&
    typeof audience.audience_languages === "object" &&
    !Array.isArray(audience.audience_languages)
      ? (audience.audience_languages as unknown as Record<string, number>)
      : {};

  const languageData = Object.entries(audienceLanguages)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) }))
    .sort((a, b) => b.value - a.value);

  /* -- Authenticity donut data -- */
  const authenticityData = [
    {
      name: "Substantive",
      value: (audience.substantive_comment_percentage ?? 0) * 100,
    },
    {
      name: "Generic",
      value: (audience.generic_comment_percentage ?? 0) * 100,
    },
    {
      name: "Emoji-only",
      value: (audience.emoji_only_percentage ?? 0) * 100,
    },
  ];

  const authenticityLabel =
    audience.authenticity_score != null
      ? getAuthenticityLabel(audience.authenticity_score)
      : null;

  const sentimentBadge = audience.overall_sentiment
    ? getSentimentBadge(audience.overall_sentiment)
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* ── Geographic Distribution ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            Geographic Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Zone-level distribution */}
          {hasZoneData && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Zone Distribution
              </p>
              <div className="flex gap-2">
                {sortedZones.map(([zone, pct]) => (
                  <div
                    key={zone}
                    className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-muted/50 p-2"
                  >
                    <span className="text-xs font-medium text-foreground">
                      {ZONE_LABELS[zone].replace(" India", "")}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              {spokenLanguage && (
                <p className="text-[11px] text-muted-foreground">
                  Includes signal from spoken language: <span className="font-medium">{spokenLanguage}</span>
                </p>
              )}
            </div>
          )}

          {/* Detailed region breakdown */}
          {geoRegions.length > 0 ? (
            <div className="space-y-3">
              {geoRegions.map((region) => (
                <div key={region.region} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {region.region}
                    </span>
                    <span className="text-muted-foreground">
                      {formatPercent(region.confidence)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${region.confidence * 100}%` }}
                    />
                  </div>
                  {region.signals && region.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {region.signals.map((signal) => (
                        <Badge
                          key={signal}
                          variant="secondary"
                          className="text-[11px] font-normal"
                        >
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No geographic data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Language Distribution ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-muted-foreground" />
            Language Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {languageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={languageData.length * 40 + 20}>
              <BarChart
                data={languageData}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Share"]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={CHART_COLORS.chart1}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">
              No language data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Authenticity Breakdown ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Authenticity Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* Donut chart */}
            <div className="relative flex-shrink-0">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={authenticityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={false}
                    stroke="none"
                  >
                    {authenticityData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={AUTHENTICITY_COLORS[index]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toFixed(1)}%`,
                      "",
                    ]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              {audience.authenticity_score != null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-foreground">
                    {Math.round(audience.authenticity_score * 100)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Score
                  </span>
                </div>
              )}
            </div>

            {/* Legend + interpretation */}
            <div className="flex-1 space-y-2">
              {authenticityData.map((entry, i) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ backgroundColor: AUTHENTICITY_COLORS[i] }}
                  />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="ml-auto font-medium text-foreground">
                    {entry.value.toFixed(1)}%
                  </span>
                </div>
              ))}

              {authenticityLabel && (
                <p className="pt-2 text-sm font-semibold">
                  Verdict:{" "}
                  <span className={authenticityLabel.className}>
                    {authenticityLabel.text}
                  </span>
                </p>
              )}

              {/* Suspicious patterns */}
              {audience.suspicious_patterns &&
                audience.suspicious_patterns.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {audience.suspicious_patterns.map((pattern) => (
                      <Badge
                        key={pattern}
                        variant="destructive"
                        className="text-[11px]"
                      >
                        <AlertTriangle className="mr-0.5 size-3" />
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sentiment ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            Audience Sentiment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall sentiment badge */}
          {sentimentBadge && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Overall:</span>
              <Badge variant={sentimentBadge.variant}>
                {sentimentBadge.label}
              </Badge>
            </div>
          )}

          {/* Sentiment score bar */}
          {audience.sentiment_score != null && (
            <Progress value={Math.round(audience.sentiment_score * 100)}>
              <ProgressLabel>Sentiment Score</ProgressLabel>
              <ProgressValue>
                {() => formatPercent(audience.sentiment_score!)}
              </ProgressValue>
            </Progress>
          )}

          {/* Positive themes */}
          {audience.positive_themes && audience.positive_themes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                Positive Themes
              </p>
              <div className="flex flex-wrap gap-1">
                {audience.positive_themes.map((theme) => (
                  <Badge
                    key={theme}
                    variant="secondary"
                    className="bg-success/10 text-success"
                  >
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Negative themes */}
          {audience.negative_themes && audience.negative_themes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                Negative Themes
              </p>
              <div className="flex flex-wrap gap-1">
                {audience.negative_themes.map((theme) => (
                  <Badge
                    key={theme}
                    variant="secondary"
                    className="bg-destructive/10 text-destructive"
                  >
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Demographics ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            Demographics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {audience.estimated_age_group && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Age Group</p>
                <Badge variant="outline">{audience.estimated_age_group}</Badge>
              </div>
            )}
            {audience.estimated_gender_skew && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Gender Skew</p>
                <Badge variant="outline">
                  {audience.estimated_gender_skew}
                </Badge>
              </div>
            )}
          </div>

          {/* Interest signals */}
          {audience.interest_signals &&
            audience.interest_signals.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Interest Signals
                </p>
                <div className="flex flex-wrap gap-1">
                  {audience.interest_signals.map((interest) => (
                    <Badge
                      key={interest}
                      variant="secondary"
                      className="font-normal"
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* ── Engagement Quality ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Engagement Quality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quality score */}
          {audience.engagement_quality_score != null && (
            <Progress
              value={Math.round(audience.engagement_quality_score * 100)}
            >
              <ProgressLabel>Quality Score</ProgressLabel>
              <ProgressValue>
                {() => formatPercent(audience.engagement_quality_score!)}
              </ProgressValue>
            </Progress>
          )}

          <div className="flex flex-wrap gap-3">
            {/* Conversation depth */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Conversation Depth
              </p>
              <Badge variant="outline">
                {getConversationDepthLabel(audience.conversation_depth)}
              </Badge>
            </div>

            {/* Community strength */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Community Strength
              </p>
              <Badge variant="outline">
                {getCommunityStrengthLabel(audience.community_strength)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
