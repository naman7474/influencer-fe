import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resetCalibrationCache } from "@/lib/matching/calibration";

/**
 * Weekly cron: trigger percentile recalibration for scoring metrics.
 *
 * The heavy lifting (statistical aggregation) runs in the Python
 * pipeline workers — this route just enqueues a background job that
 * the worker picks up and delegates to
 * `scripts/recalibrate_scoring_metrics.py` + `recalibrate_er_benchmarks.py`.
 * It also wipes the in-process calibration cache so the next brand-match
 * compute picks up the fresh percentiles without waiting for TTL.
 *
 * Authenticated via CRON_SECRET. Recommend scheduling Sunday 04:00 UTC.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // A single job row per run; Python-side worker dispatches to the
    // two recalibration scripts in sequence. We reuse background_jobs
    // so we inherit stale-job recovery (W8) and the monitoring UI.
    const { error: insertErr } = await supabase
      .from("background_jobs")
      .insert({
        job_type: "scoring_recalibration",
        brand_id: null,
        payload: {
          targets: ["er_benchmarks", "scoring_calibration"],
        },
        status: "queued",
      } as never);

    // Clear the in-process calibration cache in this runtime so reads
    // after the weekly job completes pick up fresh values on the next
    // brand-match compute, rather than serving 5-minute-stale data.
    resetCalibrationCache();

    if (insertErr && insertErr.code !== "23505") {
      console.error("[cron/recalibrate-scoring] insert error:", insertErr);
      return NextResponse.json(
        { error: insertErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      enqueued: insertErr ? 0 : 1,
      cache_cleared: true,
    });
  } catch (err) {
    console.error("[cron/recalibrate-scoring] error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
