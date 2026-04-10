"use client";

import { cn } from "@/lib/utils";

interface NegotiationResult {
  creator: {
    handle: string;
    tier: string;
    cpi: number;
    cpi_percentile: string;
    engagement_rate: number;
    followers: number;
  };
  negotiation: {
    round: number;
    creator_ask: number;
    recommended_counter: number;
    savings_vs_ask: number;
    justification: string;
  };
  market_context: {
    market_min: number;
    market_median: number;
    market_max: number;
    brand_historical_avg: number | null;
    ask_vs_median_percent: number;
  };
}

export function NegotiationCard({ data }: { data: NegotiationResult }) {
  const { creator, negotiation, market_context } = data;
  const { market_min, market_median, market_max } = market_context;
  const range = market_max - market_min;

  // Calculate positions on the range bar (0-100%)
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const medianPos = clamp(((market_median - market_min) / range) * 100);
  const askPos = clamp(
    ((negotiation.creator_ask - market_min) / range) * 100
  );
  const counterPos = clamp(
    ((negotiation.recommended_counter - market_min) / range) * 100
  );

  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">
          Negotiation — {creator.handle}
        </span>
        <span className="text-muted-foreground">Round {negotiation.round}</span>
      </div>

      {/* Two-column: Ask vs Counter */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground mb-1">Creator Ask</p>
          <p className="text-base font-bold text-red-600 dark:text-red-400">
            ₹{negotiation.creator_ask.toLocaleString("en-IN")}
          </p>
          <p className="text-muted-foreground mt-0.5">
            {market_context.ask_vs_median_percent > 0 ? "+" : ""}
            {market_context.ask_vs_median_percent}% vs median
          </p>
        </div>
        <div className="rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-2 text-center">
          <p className="text-muted-foreground mb-1">Recommended Counter</p>
          <p className="text-base font-bold text-green-600 dark:text-green-400">
            ₹{negotiation.recommended_counter.toLocaleString("en-IN")}
          </p>
          {negotiation.savings_vs_ask > 0 && (
            <p className="text-green-600 dark:text-green-400 mt-0.5">
              Save ₹{negotiation.savings_vs_ask.toLocaleString("en-IN")}
            </p>
          )}
        </div>
      </div>

      {/* Market rate range bar */}
      <div>
        <p className="text-muted-foreground mb-1.5">Market Rate Range</p>
        <div className="relative h-3 rounded-full bg-muted">
          {/* Median marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/50"
            style={{ left: `${medianPos}%` }}
          />
          {/* Creator ask marker */}
          <div
            className="absolute -top-0.5 h-4 w-2 rounded bg-red-500"
            style={{ left: `${askPos}%` }}
            title={`Ask: ₹${negotiation.creator_ask.toLocaleString("en-IN")}`}
          />
          {/* Counter marker */}
          <div
            className="absolute -top-0.5 h-4 w-2 rounded bg-green-500"
            style={{ left: `${counterPos}%` }}
            title={`Counter: ₹${negotiation.recommended_counter.toLocaleString("en-IN")}`}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>₹{market_min.toLocaleString("en-IN")}</span>
          <span>Median: ₹{market_median.toLocaleString("en-IN")}</span>
          <span>₹{market_max.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* CPI + Tier badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge label={creator.tier} />
        <Badge
          label={`CPI ${creator.cpi}`}
          variant={
            creator.cpi >= 70
              ? "green"
              : creator.cpi >= 50
                ? "yellow"
                : "red"
          }
        />
        <Badge label={`ER ${creator.engagement_rate}%`} />
        {market_context.brand_historical_avg && (
          <Badge
            label={`Avg paid: ₹${market_context.brand_historical_avg.toLocaleString("en-IN")}`}
          />
        )}
      </div>

      {/* Justification */}
      <p className="text-muted-foreground italic">
        {negotiation.justification}
      </p>
    </div>
  );
}

function Badge({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "green" | "yellow" | "red";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        variant === "green" &&
          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        variant === "yellow" &&
          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        variant === "red" &&
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        variant === "default" &&
          "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}
