"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Megaphone,
  Play,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

import type { CreatorScore, Post } from "@/lib/types/database";
import {
  formatPercent,
  formatEngagementRate,
  formatFollowers,
} from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";

/* ------------------------------------------------------------------ */
/*  Chart color constants                                              */
/* ------------------------------------------------------------------ */

const CHART_COLORS = {
  chart1: "var(--chart-1)",
  chart2: "var(--chart-2)",
  chart3: "var(--chart-3)",
  chart4: "var(--chart-4)",
  chart5: "var(--chart-5)",
};

/* ------------------------------------------------------------------ */
/*  Prop types                                                         */
/* ------------------------------------------------------------------ */

export interface EngagementByContentType {
  [key: string]: number;
}

export interface PerformanceTabProps {
  scores: CreatorScore | null;
  posts: Post[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDeltaColor(delta: number): string {
  if (delta < 0.15) return "text-success";
  if (delta < 0.3) return "text-warning";
  return "text-destructive";
}

function getDeltaBg(delta: number): string {
  if (delta < 0.15) return "bg-success/10";
  if (delta < 0.3) return "bg-warning/10";
  return "bg-destructive/10";
}

function getContentTypeBadgeVariant(
  type: string | null
): "default" | "secondary" | "outline" {
  if (!type) return "secondary";
  const t = type.toLowerCase();
  if (t === "video") return "default";
  if (t === "carousel") return "outline";
  return "secondary";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PerformanceTab({ scores, posts }: PerformanceTabProps) {
  /* -- Engagement trend data from posts -- */
  const engagementTrendData = posts
    .filter((p) => p.date_posted && p.engagement_rate != null)
    .sort(
      (a, b) =>
        new Date(a.date_posted!).getTime() - new Date(b.date_posted!).getTime()
    )
    .map((p) => ({
      date: formatDate(p.date_posted!),
      rate: parseFloat(((p.engagement_rate ?? 0) * 100).toFixed(2)),
    }));

  /* -- Performance by format -- */
  const engagementByType: EngagementByContentType =
    scores?.engagement_by_content_type != null &&
    typeof scores.engagement_by_content_type === "object" &&
    !Array.isArray(scores.engagement_by_content_type)
      ? (scores.engagement_by_content_type as unknown as EngagementByContentType)
      : {};

  const formatData = Object.entries(engagementByType).map(([name, value]) => ({
    name,
    rate: parseFloat((value * 100).toFixed(2)),
  }));

  const FORMAT_BAR_COLORS: Record<string, string> = {
    Video: CHART_COLORS.chart1,
    Carousel: CHART_COLORS.chart3,
    Image: CHART_COLORS.chart4,
  };

  /* -- Sponsored vs organic delta -- */
  const sponsoredDelta = scores?.sponsored_vs_organic_delta ?? 0;
  const absDelta = Math.abs(sponsoredDelta);

  /* -- Recent posts (last 12) -- */
  const recentPosts = [...posts]
    .sort(
      (a, b) =>
        new Date(b.date_posted ?? b.created_at).getTime() -
        new Date(a.date_posted ?? a.created_at).getTime()
    )
    .slice(0, 12);

  const hasScores = scores != null;

  if (!hasScores && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart3 className="mb-3 size-10 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">
          No performance data available
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance metrics have not been computed for this creator yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Row 1: Engagement trend + Performance by format ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Engagement trend line chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              Engagement Trend
            </CardTitle>
            <CardDescription>
              Engagement rate over time from recent posts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {engagementTrendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={240} minWidth={0}>
                <LineChart
                  data={engagementTrendData}
                  margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Engagement"]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={CHART_COLORS.chart1}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS.chart1 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Not enough data points to render a trend.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Performance by format */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" />
              Performance by Format
            </CardTitle>
            <CardDescription>
              Average engagement rate by content type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formatData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240} minWidth={0}>
                <BarChart
                  data={formatData}
                  margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${value}%`,
                      "Avg Engagement",
                    ]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar
                    dataKey="rate"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    {formatData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          FORMAT_BAR_COLORS[entry.name] ?? CHART_COLORS.chart2
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No content type breakdown available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Posting frequency */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="size-4 text-muted-foreground" />
              Posting Frequency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {scores?.posts_per_week != null
                ? scores.posts_per_week.toFixed(1)
                : "--"}
            </p>
            <p className="text-xs text-muted-foreground">posts per week</p>
            {scores?.posting_consistency_stddev != null && (
              <p className="mt-2 text-xs text-muted-foreground">
                Consistency:{" "}
                <span className="font-medium text-foreground">
                  {scores.posting_consistency_stddev < 1
                    ? "Very consistent"
                    : scores.posting_consistency_stddev < 2
                      ? "Consistent"
                      : "Irregular"}
                </span>
                <span className="ml-1 text-muted-foreground">
                  (stddev: {scores.posting_consistency_stddev.toFixed(2)})
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sponsored vs Organic */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Megaphone className="size-4 text-muted-foreground" />
              Sponsored vs Organic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scores?.sponsored_post_rate != null && (
              <div>
                <Progress
                  value={Math.round(scores.sponsored_post_rate * 100)}
                >
                  <ProgressLabel>Sponsored Rate</ProgressLabel>
                  <ProgressValue>
                    {() => formatPercent(scores.sponsored_post_rate!)}
                  </ProgressValue>
                </Progress>
              </div>
            )}
            {scores?.sponsored_vs_organic_delta != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Delta:</span>
                <Badge
                  variant="secondary"
                  className={`${getDeltaBg(absDelta)} ${getDeltaColor(absDelta)}`}
                >
                  {absDelta < 0.15
                    ? "Minimal drop"
                    : absDelta < 0.3
                      ? "Moderate drop"
                      : "Significant drop"}
                  {" "}
                  ({formatPercent(absDelta)})
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reel metrics: Rewatch rate */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Play className="size-4 text-muted-foreground" />
              Avg Rewatch Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {scores?.avg_rewatch_rate != null
                ? formatPercent(scores.avg_rewatch_rate)
                : "--"}
            </p>
            <p className="text-xs text-muted-foreground">
              of viewers rewatch reels
            </p>
          </CardContent>
        </Card>

        {/* Reel metrics: Views to likes */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4 text-muted-foreground" />
              Views-to-Likes Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {scores?.avg_views_to_likes_ratio != null
                ? `${scores.avg_views_to_likes_ratio.toFixed(1)}x`
                : "--"}
            </p>
            <p className="text-xs text-muted-foreground">
              average views per like
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Recent posts gallery ── */}
      {recentPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted-foreground" />
              Recent Posts
            </CardTitle>
            <CardDescription>
              Last {recentPosts.length} posts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {recentPosts.map((post) => (
                <a
                  key={post.id}
                  href={post.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/post flex flex-col overflow-hidden rounded-lg border border-border bg-muted/30 transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  {/* Thumbnail / placeholder */}
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    {post.thumbnail_url ? (
                      <img
                        src={post.thumbnail_url}
                        alt={post.description?.slice(0, 60) ?? "Post"}
                        className="size-full object-cover transition-transform group-hover/post:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-8" />
                      </div>
                    )}
                    {/* Content type badge overlay */}
                    {post.content_type && (
                      <div className="absolute left-1.5 top-1.5">
                        <Badge
                          variant={getContentTypeBadgeVariant(
                            post.content_type
                          )}
                          className="text-[10px] shadow-sm"
                        >
                          {post.content_type}
                        </Badge>
                      </div>
                    )}
                    {/* External link icon */}
                    {post.url && (
                      <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover/post:opacity-100">
                        <ExternalLink className="size-4 text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="space-y-1 p-2">
                    {post.engagement_rate != null && (
                      <p className="text-xs font-semibold text-foreground">
                        ER: {formatEngagementRate(post.engagement_rate)}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {post.likes != null && (
                        <span>{formatFollowers(post.likes)} likes</span>
                      )}
                      {post.num_comments != null && (
                        <span>{formatFollowers(post.num_comments)} comments</span>
                      )}
                    </div>
                    {post.date_posted && (
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateFull(post.date_posted)}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
