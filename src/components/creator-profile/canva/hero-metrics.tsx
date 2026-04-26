import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

import type { ContentItem } from "@/lib/types/creator-detail";
import { formatFollowers, formatPercent } from "@/lib/format";

import { cn } from "@/lib/utils";

interface HeroMetricsProps {
  followers: number | null;
  avgEngagementRate: number | null;
  postsPerWeek: number | null;
  content: ContentItem[];
}

interface HeroMetricProps {
  label: string;
  value: string;
  delta?: number | null;
  big?: boolean;
}

function HeroMetric({ label, value, delta, big }: HeroMetricProps) {
  const positive = delta != null ? delta >= 0 : null;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap items-baseline gap-1.5">
        <div
          className={cn(
            "font-heading font-extrabold leading-none tracking-tight text-foreground",
            big ? "text-[30px]" : "text-[22px]",
          )}
        >
          {value}
        </div>
        {positive != null && delta != null && delta !== 0 && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-bold",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {positive ? "+" : ""}
            {delta}%
          </div>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div aria-hidden className="hidden h-9 w-px shrink-0 bg-border md:block" />;
}

export function computeAvgViews(content: ContentItem[]): number | null {
  if (!content.length) return null;
  const totals = content.reduce(
    (acc, item) => {
      if (item.kind === "ig_post") {
        const v = item.video_view_count ?? item.video_play_count;
        if (v && v > 0) {
          acc.sum += v;
          acc.count += 1;
        }
      } else {
        if (item.view_count && item.view_count > 0) {
          acc.sum += item.view_count;
          acc.count += 1;
        }
      }
      return acc;
    },
    { sum: 0, count: 0 },
  );
  return totals.count > 0 ? Math.round(totals.sum / totals.count) : null;
}

function fmtEng(rate: number | null): string {
  if (rate == null) return "—";
  // DB stores either 0..1 (decimal) or 0..100 (percent). Normalize.
  return rate <= 1 ? formatPercent(rate, 1) : `${rate.toFixed(1)}%`;
}

export function HeroMetrics({
  followers,
  avgEngagementRate,
  postsPerWeek,
  content,
}: HeroMetricsProps) {
  const avgViews = React.useMemo(() => computeAvgViews(content), [content]);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-5">
      <HeroMetric
        label="Followers"
        value={followers != null ? formatFollowers(followers) : "—"}
        big
      />
      <Divider />
      <HeroMetric
        label="Avg engagement"
        value={fmtEng(avgEngagementRate)}
      />
      <Divider />
      <HeroMetric
        label="Avg views"
        value={avgViews != null ? formatFollowers(avgViews) : "—"}
      />
      <Divider />
      <HeroMetric
        label="Posts / week"
        value={postsPerWeek != null ? postsPerWeek.toFixed(1) : "—"}
      />
    </div>
  );
}
