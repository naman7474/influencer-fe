"use client";

import { Clock } from "lucide-react";
import type { CreatorScore, Json } from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BestTimeHeatmapProps {
  scores: CreatorScore | null;
}

/**
 * Parses comment_hour_distribution JSON into a 24-element array of counts
 * (hour 0..23). Accepts either:
 *   • `{ "0": 12, "1": 5, ... }` — object form
 *   • `[12, 5, ...]` — array form
 *   • `[{ hour: 0, count: 12 }, ...]` — list form
 */
function parseHourDistribution(data: Json | null | undefined): number[] | null {
  if (data == null) return null;

  const counts = new Array<number>(24).fill(0);
  let found = false;

  if (Array.isArray(data)) {
    if (data.length === 24 && data.every((v) => typeof v === "number")) {
      return data as number[];
    }
    for (const row of data) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const obj = row as Record<string, Json>;
        const hour = Number(obj.hour ?? obj.h ?? obj.time ?? -1);
        const count = Number(obj.count ?? obj.value ?? obj.n ?? 0);
        if (hour >= 0 && hour < 24 && !Number.isNaN(count)) {
          counts[hour] += count;
          found = true;
        }
      }
    }
    return found ? counts : null;
  }

  if (typeof data === "object") {
    for (const [key, val] of Object.entries(data as Record<string, Json>)) {
      const hour = Number(key);
      const count = Number(val);
      if (hour >= 0 && hour < 24 && !Number.isNaN(count)) {
        counts[hour] += count;
        found = true;
      }
    }
    return found ? counts : null;
  }

  return null;
}

export function BestTimeHeatmap({ scores }: BestTimeHeatmapProps) {
  const counts = parseHourDistribution(scores?.comment_hour_distribution);
  if (!counts) return null;

  const max = Math.max(...counts);
  if (max === 0) return null;

  const peakHour = counts.indexOf(max);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Best time to post
          </span>
          <span className="text-[11px] font-normal text-muted-foreground">
            Peak: {formatHour(peakHour)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-px">
          {counts.map((c, h) => {
            const intensity = c / max;
            return (
              <div
                key={h}
                className="group/cell relative flex-1"
                title={`${formatHour(h)}: ${c} comments`}
              >
                <div
                  className={cn(
                    "rounded-sm",
                    intensity > 0 ? "bg-primary" : "bg-muted",
                  )}
                  style={{
                    height: `${Math.max(4, intensity * 48)}px`,
                    opacity: intensity > 0 ? 0.25 + intensity * 0.75 : 0.3,
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* Hour axis — show every 4h */}
        <div className="mt-1.5 flex gap-px text-[10px] text-muted-foreground">
          {counts.map((_, h) => (
            <div key={h} className="flex-1 text-center">
              {h % 4 === 0 ? h : ""}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Based on when followers comment — post ~1h before peak for best reach.
        </p>
      </CardContent>
    </Card>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}
