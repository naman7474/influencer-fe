"use client";

import { TrendingUp } from "lucide-react";
import type { Creator, CreatorScore } from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GrowthSignalsProps {
  creator: Creator;
  scores: CreatorScore | null;
}

function toPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.round(v > 1 ? v : v * 100);
}

export function GrowthSignals({ creator, scores }: GrowthSignalsProps) {
  const growth = toPct(scores?.growth_trajectory);
  const avgER = scores?.avg_engagement_rate ?? null;
  const medER = scores?.median_engagement_rate ?? null;
  const erDeltaPct =
    avgER != null && medER != null && medER > 0
      ? ((avgER - medER) / medER) * 100
      : null;

  const ratio = creator.follower_following_ratio;
  const efficiency = creator.posts_to_follower_efficiency;

  const rows: { label: string; value: string; hint?: string; color?: string }[] =
    [];

  if (growth != null) {
    rows.push({
      label: "Growth trajectory",
      value: `${growth}`,
      hint: trajectoryHint(growth),
      color: scoreColor(growth),
    });
  }

  if (ratio != null) {
    rows.push({
      label: "Follower/Following ratio",
      value: ratio >= 1 ? `${ratio.toFixed(0)}:1` : `1:${(1 / ratio).toFixed(0)}`,
      hint: ratioHint(ratio, creator.tier),
      color: ratio < 1 && creator.tier !== "nano" ? "text-warning" : undefined,
    });
  }

  if (efficiency != null) {
    rows.push({
      label: "Followers per post",
      value: Math.round(efficiency).toLocaleString(),
      hint: "Lifetime efficiency",
    });
  }

  if (erDeltaPct != null) {
    rows.push({
      label: "Avg vs median ER",
      value: `${erDeltaPct >= 0 ? "+" : ""}${erDeltaPct.toFixed(0)}%`,
      hint:
        Math.abs(erDeltaPct) < 20
          ? "Consistent performance"
          : "A few posts skew the average",
      color: Math.abs(erDeltaPct) > 50 ? "text-warning" : undefined,
    });
  }

  if (rows.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          Growth Signals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <dt className="text-muted-foreground">{r.label}</dt>
                {r.hint && (
                  <dd className="text-[11px] text-muted-foreground/70">
                    {r.hint}
                  </dd>
                )}
              </div>
              <dd
                className={cn(
                  "shrink-0 text-right font-semibold tabular-nums",
                  r.color ?? "text-foreground",
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function trajectoryHint(pct: number): string {
  if (pct >= 75) return "Accelerating";
  if (pct >= 50) return "Steady growth";
  if (pct >= 30) return "Flat";
  return "Stalled or declining";
}

function scoreColor(pct: number): string {
  if (pct >= 70) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-destructive";
}

function ratioHint(ratio: number, tier: string | null): string {
  if (ratio >= 100) return "Very healthy — organic growth";
  if (ratio >= 10) return "Healthy";
  if (ratio >= 1) return "Acceptable";
  if (tier === "nano") return "Normal for nano";
  return "Unusual — follows back heavily";
}
