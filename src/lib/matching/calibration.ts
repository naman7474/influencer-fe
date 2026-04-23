/* ------------------------------------------------------------------ */
/*  Scoring Calibration Loader (W7)                                    */
/*                                                                     */
/*  Brand-safety sub-scores used to hardcode cutoffs (engagement-bait   */
/*  weight, authenticity thresholds, sponsored-rate bands). That means  */
/*  a "0.65" sub-score read as average even when it was the 95th        */
/*  percentile for our actual cohort. This loader reads the current     */
/*  percentile snapshot from `scoring_calibration` (written weekly by   */
/*  scripts/recalibrate_scoring_metrics.py) with a small in-process     */
/*  cache and falls back to the prior hardcoded defaults when a metric  */
/*  row is missing — so a fresh install never returns NULL cutoffs.     */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export interface Percentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export type CalibrationMetric =
  | "engagement_bait"
  | "authenticity"
  | "sponsored_rate";

/**
 * Starting-point defaults, kept in sync with the values
 * brand-safety.ts used to inline. Returned when the DB row is
 * missing or the query fails — never NULL, so scoring is always
 * defined.
 */
export const DEFAULT_PERCENTILES: Record<CalibrationMetric, Percentiles> = {
  engagement_bait: { p10: 0.05, p25: 0.15, p50: 0.3, p75: 0.55, p90: 0.75 },
  authenticity: { p10: 0.4, p25: 0.55, p50: 0.7, p75: 0.82, p90: 0.92 },
  sponsored_rate: { p10: 0.0, p25: 0.02, p50: 0.1, p75: 0.25, p90: 0.45 },
};

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = { value: Percentiles; loadedAt: number };
const cache = new Map<CalibrationMetric, CacheEntry>();

export async function getCalibration(
  supabase: SupabaseClient<Database>,
  metric: CalibrationMetric,
): Promise<Percentiles> {
  const now = Date.now();
  const hit = cache.get(metric);
  if (hit && now - hit.loadedAt < TTL_MS) {
    return hit.value;
  }

  let loaded: Percentiles | null = null;
  try {
    // Cast: `scoring_calibration` (migration 040) hasn't been
    // regenerated into the Database types yet. The narrow field set
    // we select is stable — no long-term type-safety loss.
    const { data, error } = await (
      supabase.from("scoring_calibration" as never) as unknown as {
        select: (cols: string) => {
          eq: (
            col: string,
            value: string,
          ) => {
            maybeSingle: () => Promise<{
              data: Record<string, string | number> | null;
              error: unknown;
            }>;
          };
        };
      }
    )
      .select("p10, p25, p50, p75, p90")
      .eq("metric", metric)
      .maybeSingle();
    if (!error && data) {
      loaded = {
        p10: Number(data.p10),
        p25: Number(data.p25),
        p50: Number(data.p50),
        p75: Number(data.p75),
        p90: Number(data.p90),
      };
    }
  } catch {
    // swallow — fall back to defaults, don't cache the miss
  }

  if (loaded) {
    cache.set(metric, { value: loaded, loadedAt: now });
    return loaded;
  }
  return DEFAULT_PERCENTILES[metric];
}

/**
 * Fetch the full calibration set in one go. Preferred when scoring a
 * large batch so we issue one network round-trip per metric rather
 * than one per creator × metric.
 */
export async function loadAllCalibrations(
  supabase: SupabaseClient<Database>,
): Promise<Record<CalibrationMetric, Percentiles>> {
  const metrics: CalibrationMetric[] = [
    "engagement_bait",
    "authenticity",
    "sponsored_rate",
  ];
  const entries = await Promise.all(
    metrics.map(async (m) => [m, await getCalibration(supabase, m)] as const),
  );
  return Object.fromEntries(entries) as Record<
    CalibrationMetric,
    Percentiles
  >;
}

/** For tests: wipe the in-memory cache. */
export function resetCalibrationCache(): void {
  cache.clear();
}

/**
 * Map a raw reading to a percentile band in [0, 1] by linear
 * interpolation between the provided quantile anchors.
 * Returns 0 at/below p10, 1 at/above p90.
 *
 * Note: for "lower is better" metrics (engagement_bait), callers
 * should use `1 - percentileRank(...)` themselves — this helper stays
 * direction-agnostic.
 */
export function percentileRank(value: number, p: Percentiles): number {
  if (value <= p.p10) return 0.1 * (value / Math.max(p.p10, 1e-9));
  if (value <= p.p25)
    return 0.1 + 0.15 * ((value - p.p10) / Math.max(p.p25 - p.p10, 1e-9));
  if (value <= p.p50)
    return 0.25 + 0.25 * ((value - p.p25) / Math.max(p.p50 - p.p25, 1e-9));
  if (value <= p.p75)
    return 0.5 + 0.25 * ((value - p.p50) / Math.max(p.p75 - p.p50, 1e-9));
  if (value <= p.p90)
    return 0.75 + 0.15 * ((value - p.p75) / Math.max(p.p90 - p.p75, 1e-9));
  return Math.min(1.0, 0.9 + 0.1 * ((value - p.p90) / Math.max(p.p90, 1e-9)));
}
