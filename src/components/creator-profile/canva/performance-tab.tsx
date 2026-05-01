"use client";

import * as React from "react";

import type { CreatorScore } from "@/lib/types/database";
import type { ContentItem } from "@/lib/types/creator-detail";
import { formatFollowers } from "@/lib/format";

import { SectionCard } from "./section-card";
import { EmptyCard } from "./empty-card";

interface PerformanceTabProps {
  scores: CreatorScore | null;
  content: ContentItem[];
  accent: string;
}

const MIN_POPULATED_POSTS = 3;

interface SeriesResult {
  values: number[];
  /** Number of plotted data points (= count of posts with usable values). */
  count: number;
  hasData: boolean;
}

/**
 * Order one value per post chronologically (oldest → newest).
 * One data point per post — no calendar bucketing — so a creator who
 * shipped 20 videos in a single week doesn't get folded into a single
 * data point that swamps the trend with the average of those 20.
 *
 * Posts missing a usable date or value are dropped. We still require
 * `MIN_POPULATED_POSTS` plotted points before we render a trendline,
 * because a 1- or 2-point line is not a trend.
 */
function seriesByVideo<T>(
  items: T[],
  getDate: (item: T) => string | null,
  getValue: (item: T) => number | null,
): SeriesResult {
  const points: { ts: number; value: number }[] = [];
  for (const it of items) {
    const d = getDate(it);
    const v = getValue(it);
    if (!d || v == null || !Number.isFinite(v)) continue;
    const ts = new Date(d).getTime();
    if (Number.isNaN(ts)) continue;
    points.push({ ts, value: v });
  }
  if (points.length < MIN_POPULATED_POSTS) {
    return { values: [], count: 0, hasData: false };
  }
  // Oldest → newest. The DB query returns newest-first, but trend reads
  // left-to-right as time-ascending.
  points.sort((a, b) => a.ts - b.ts);
  return {
    values: points.map((p) => p.value),
    count: points.length,
    hasData: true,
  };
}

function BigSpark({
  data,
  color,
  height = 80,
  format,
}: {
  data: number[];
  color: string;
  height?: number;
  format: (v: number) => string;
}) {
  const reactId = React.useId();
  const gradId = `canva-perf-grad-${reactId.replace(/:/g, "")}`;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const w = 600;
  const h = height;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const xs = data.map((_, i) => (i / Math.max(data.length - 1, 1)) * w);
  const ys = data.map((v) => h - ((v - min) / span) * (h - 12) - 6);
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const area = `M0,${h} L${xs.map((x, i) => `${x} ${ys[i]}`).join(" L")} L${w},${h} Z`;

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const hoverX = hover != null ? (xs[hover] / w) * 100 : 0;
  const hoverY = hover != null ? (ys[hover] / h) * 100 : 0;
  const hoverValue = hover != null ? data[hover] : 0;
  // Each data point is one post (oldest = index 0, newest = last index).
  const postLabel =
    hover == null
      ? ""
      : (() => {
          const total = data.length;
          if (hover === total - 1) return "latest post";
          if (hover === 0) return `oldest of ${total}`;
          return `post #${hover + 1} of ${total}`;
        })();

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ width: "100%", height, cursor: "crosshair" }}
      onPointerMove={handleMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hover != null && (
          <>
            <line
              x1={xs[hover]}
              x2={xs[hover]}
              y1={0}
              y2={h}
              stroke="var(--border-strong)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={xs[hover]}
              cy={ys[hover]}
              r={4.5}
              fill="var(--card)"
              stroke={color}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] shadow-md"
          style={{
            left: `${hoverX}%`,
            top: `calc(${hoverY}% - 14px)`,
            transform: `translate(-50%, -100%)`,
            whiteSpace: "nowrap",
          }}
        >
          <div className="font-heading text-[13px] font-extrabold leading-none text-foreground">
            {format(hoverValue)}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            {postLabel}
          </div>
        </div>
      )}
    </div>
  );
}

function buildAxisLabels(count: number, last: number, format: (v: number) => string): string[] {
  // Posts indexed 1..count where 1 is oldest and `count` is newest.
  if (count <= 1) return [`now: ${format(last)}`];
  const oldest = "oldest";
  const newest = `latest: ${format(last)}`;
  // Two intermediates at ~1/3 and ~2/3 of the range, expressed as post #.
  const mid1 = Math.round(1 + (count - 1) / 3);
  const mid2 = Math.round(1 + ((count - 1) * 2) / 3);
  const mids: string[] = [];
  const seen = new Set<number>();
  for (const m of [mid1, mid2]) {
    if (m <= 1 || m >= count) continue;
    if (seen.has(m)) continue;
    seen.add(m);
    mids.push(`#${m}`);
  }
  return [oldest, ...mids, newest];
}

function TrendCard({
  title,
  subtitle,
  data,
  count,
  hasData,
  color,
  format,
}: {
  title: string;
  subtitle: string;
  data: number[];
  count: number;
  hasData: boolean;
  color: string;
  format: (v: number) => string;
}) {
  if (!hasData) {
    return (
      <SectionCard title={title} subtitle={subtitle}>
        <EmptyCard
          title="Not enough recent posts to chart"
          description="Need at least 3 posts with usable values to plot a trend."
        />
      </SectionCard>
    );
  }
  const first = data[0] ?? 0;
  const last = data[data.length - 1] ?? 0;
  const delta = first === 0 ? 0 : ((last - first) / first) * 100;
  const positive = delta >= 0;
  const labels = buildAxisLabels(count, last, format);

  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      right={
        <div
          className="text-base font-extrabold"
          style={{ color: positive ? "var(--success)" : "var(--destructive)" }}
        >
          {positive ? "+" : ""}
          {Math.round(delta)}%
        </div>
      }
    >
      <BigSpark data={data} color={color} height={70} format={format} />
      <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </SectionCard>
  );
}

interface FormatBucket {
  name: string;
  count: number;
  totalViews: number;
  totalEng: number;
  engCount: number;
}

function aggregateFormats(content: ContentItem[]): FormatBucket[] {
  const map = new Map<string, FormatBucket>();
  for (const item of content) {
    let name: string;
    let views = 0;
    let eng: number | null = null;
    if (item.kind === "ig_post") {
      name = item.content_type ?? "Post";
      views = item.video_view_count ?? item.video_play_count ?? 0;
      eng =
        item.engagement_rate != null
          ? item.engagement_rate <= 1
            ? item.engagement_rate * 100
            : item.engagement_rate
          : null;
    } else {
      name = item.is_short ? "Shorts" : item.is_livestream ? "Live" : "Long-form";
      views = item.view_count ?? 0;
      // synthetic eng = (likes+comments)/views
      if (item.view_count > 0) {
        eng = ((item.like_count + item.comment_count) / item.view_count) * 100;
      }
    }
    if (!map.has(name)) {
      map.set(name, {
        name,
        count: 0,
        totalViews: 0,
        totalEng: 0,
        engCount: 0,
      });
    }
    const bucket = map.get(name)!;
    bucket.count += 1;
    bucket.totalViews += views;
    if (eng != null && Number.isFinite(eng)) {
      bucket.totalEng += eng;
      bucket.engCount += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const FORMAT_COLORS = [
  "var(--canva-pink)",
  "var(--canva-purple)",
  "var(--canva-teal)",
  "var(--canva-yellow)",
];

function FormatsCard({ content }: { content: ContentItem[] }) {
  const buckets = aggregateFormats(content);
  if (!buckets.length) {
    return (
      <SectionCard
        title="Performance by format"
        subtitle="What works best"
        span={2}
      >
        <EmptyCard title="No content sample available" />
      </SectionCard>
    );
  }
  const maxViews = Math.max(...buckets.map((b) => b.totalViews / Math.max(b.count, 1)), 1);
  return (
    <SectionCard
      title="Performance by format"
      subtitle="Average reach and engagement by content type"
      span={2}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.slice(0, 3).map((b, i) => {
          const avgViews = Math.round(b.totalViews / Math.max(b.count, 1));
          const avgEng = b.engCount ? b.totalEng / b.engCount : null;
          return (
            <div key={b.name} className="rounded-xl bg-muted p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: FORMAT_COLORS[i % FORMAT_COLORS.length] }}
                />
                <span className="text-[13px] font-extrabold text-foreground">
                  {b.name}
                </span>
                <span className="ml-auto rounded-md bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {b.count} posts
                </span>
              </div>
              <div className="mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Avg views
                </div>
                <div className="font-heading text-[22px] font-extrabold text-foreground">
                  {formatFollowers(avgViews)}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-card">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.min(100, (avgViews / maxViews) * 100)}%`,
                      background: FORMAT_COLORS[i % FORMAT_COLORS.length],
                    }}
                  />
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Engagement{" "}
                <b className="text-foreground">
                  {avgEng != null ? `${avgEng.toFixed(1)}%` : "—"}
                </b>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-heading text-base font-extrabold text-foreground">
        {value}
      </div>
    </div>
  );
}

function fmtPctRate(r: number | null | undefined): string | null {
  if (r == null) return null;
  return r <= 1 ? `${(r * 100).toFixed(1)}%` : `${r.toFixed(1)}%`;
}

function OtherMetricsCard({ scores }: { scores: CreatorScore | null }) {
  if (!scores) {
    return null;
  }
  const pills: { label: string; value: string }[] = [];
  const sponsored = fmtPctRate(scores.sponsored_post_rate);
  if (sponsored) pills.push({ label: "Sponsored rate", value: sponsored });

  if (scores.sponsored_vs_organic_delta != null) {
    const d = scores.sponsored_vs_organic_delta;
    const sign = d >= 0 ? "+" : "";
    pills.push({
      label: "Sponsored vs organic",
      value: `${sign}${(d <= 1 && d >= -1 ? d * 100 : d).toFixed(1)}%`,
    });
  }
  if (scores.posting_consistency_stddev != null) {
    pills.push({
      label: "Cadence σ",
      value: scores.posting_consistency_stddev.toFixed(2),
    });
  }
  if (scores.avg_rewatch_rate != null) {
    const r = fmtPctRate(scores.avg_rewatch_rate);
    if (r) pills.push({ label: "Rewatch rate", value: r });
  }
  if (scores.avg_views_to_likes_ratio != null) {
    pills.push({
      label: "Views / like",
      value: scores.avg_views_to_likes_ratio.toFixed(1),
    });
  }
  if (scores.creator_reply_rate != null) {
    const r = fmtPctRate(scores.creator_reply_rate);
    if (r) pills.push({ label: "Creator reply", value: r });
  }
  if (scores.avg_reel_length_seconds != null) {
    pills.push({
      label: "Avg reel len",
      value: `${scores.avg_reel_length_seconds.toFixed(0)}s`,
    });
  }
  if (scores.brand_mentions_count != null) {
    pills.push({
      label: "Brand mentions",
      value: scores.brand_mentions_count.toString(),
    });
  }

  // YT-specific score columns aren't in the generated DB types yet (schema
  // drift since migration 043 — multi_platform_schema). Cast to read them.
  const ytExtras = scores as unknown as {
    avg_views_per_sub?: number | null;
    watch_through_proxy?: number | null;
    upload_cadence_days?: number | null;
    subscriber_growth_proxy?: number | null;
  };
  if (ytExtras.avg_views_per_sub != null) {
    pills.push({
      label: "Views / sub",
      value: `${(ytExtras.avg_views_per_sub * 100).toFixed(1)}%`,
    });
  }
  if (ytExtras.watch_through_proxy != null) {
    pills.push({
      label: "Watch-through",
      value: `${(ytExtras.watch_through_proxy * 100).toFixed(1)}%`,
    });
  }
  if (ytExtras.upload_cadence_days != null) {
    const d = ytExtras.upload_cadence_days;
    pills.push({
      label: "Upload cadence",
      value: d < 1 ? `${(d * 24).toFixed(1)}h` : `${d.toFixed(1)}d`,
    });
  }
  if (ytExtras.subscriber_growth_proxy != null) {
    pills.push({
      label: "Sub growth",
      value: `${(ytExtras.subscriber_growth_proxy * 100).toFixed(1)}%`,
    });
  }

  if (!pills.length) return null;

  return (
    <SectionCard
      title="Other performance metrics"
      subtitle="Latest creator-score snapshot"
      span={2}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {pills.map((p) => (
          <StatPill key={p.label} label={p.label} value={p.value} />
        ))}
      </div>
    </SectionCard>
  );
}

export function PerformanceTab({ scores, content, accent }: PerformanceTabProps) {
  const engagement = React.useMemo(
    () =>
      seriesByVideo(
        content,
        (c) => (c.kind === "ig_post" ? c.date_posted : c.published_at),
        (c) => {
          if (c.kind === "ig_post") {
            const r = c.engagement_rate;
            if (r == null) return null;
            return r <= 1 ? r * 100 : r;
          }
          if (c.view_count > 0) {
            return ((c.like_count + c.comment_count) / c.view_count) * 100;
          }
          return null;
        },
      ),
    [content],
  );

  const views = React.useMemo(() => {
    // Views/day instead of absolute views — otherwise the newest video
    // always looks "down" because it's had hours, not months, to accumulate.
    // Floor age at 1 day so a brand-new post doesn't overshoot wildly from
    // a tiny denominator (and so the launch spike doesn't dominate).
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return seriesByVideo(
      content,
      (c) => (c.kind === "ig_post" ? c.date_posted : c.published_at),
      (c) => {
        const dateStr = c.kind === "ig_post" ? c.date_posted : c.published_at;
        const total =
          c.kind === "ig_post"
            ? c.video_view_count ?? c.video_play_count ?? c.likes ?? null
            : c.view_count ?? null;
        if (total == null || !dateStr) return null;
        const ts = new Date(dateStr).getTime();
        if (Number.isNaN(ts)) return null;
        const days = Math.max(1, (now - ts) / DAY_MS);
        return total / days;
      },
    );
  }, [content]);

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <TrendCard
        title="Engagement trend"
        subtitle={
          engagement.hasData
            ? `Per post · last ${engagement.count} ${engagement.count === 1 ? "post" : "posts"} · oldest → newest`
            : "Per post · oldest → newest"
        }
        data={engagement.values}
        count={engagement.count}
        hasData={engagement.hasData}
        color={accent}
        format={(v) => `${v.toFixed(1)}%`}
      />
      <TrendCard
        title="Views trend"
        subtitle={
          views.hasData
            ? `Views per day · last ${views.count} ${views.count === 1 ? "post" : "posts"} · age-normalized`
            : "Views per day · age-normalized"
        }
        data={views.values}
        count={views.count}
        hasData={views.hasData}
        color="var(--canva-purple)"
        format={(v) => `${formatFollowers(Math.round(v))}/day`}
      />
      <FormatsCard content={content} />
      <OtherMetricsCard scores={scores} />
    </div>
  );
}
