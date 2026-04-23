import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Daily cron: refresh Shopify geo data for connected brands.
 *
 * Enqueues a `shopify_geo_sync` background_jobs row per connected
 * brand whose last sync is older than 24h (or has never synced).
 * The uq_background_jobs_active_per_brand partial index suppresses
 * duplicates when a job is already queued/running.
 *
 * Authenticated via CRON_SECRET. Recommend scheduling at 03:00 UTC.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const staleBefore = new Date(Date.now() - 24 * 3_600_000).toISOString();

    // Find brands that are connected and either never synced or stale.
    const { data: brandsRaw, error: brandErr } = await supabase
      .from("brands")
      .select(
        "id, shopify_geo_sync_completed_at, shopify_geo_sync_status"
      )
      .eq("shopify_connected", true);

    if (brandErr) {
      return NextResponse.json({ error: brandErr.message }, { status: 500 });
    }

    type BrandRow = {
      id: string;
      shopify_geo_sync_completed_at: string | null;
      shopify_geo_sync_status: string | null;
    };
    const candidates = ((brandsRaw ?? []) as BrandRow[]).filter((b) => {
      // Skip brands already queued/running; rely on the unique partial
      // index to also guard against duplicate inserts.
      if (
        b.shopify_geo_sync_status === "queued" ||
        b.shopify_geo_sync_status === "running"
      ) {
        return false;
      }
      return (
        !b.shopify_geo_sync_completed_at ||
        b.shopify_geo_sync_completed_at < staleBefore
      );
    });

    let enqueued = 0;
    let skipped = 0;

    for (const brand of candidates) {
      const { error: insertErr } = await supabase
        .from("background_jobs")
        .insert({
          job_type: "shopify_geo_sync",
          brand_id: brand.id,
          payload: { mode: "incremental", window_days: 30 },
          status: "queued",
        } as never);

      if (insertErr) {
        // Duplicate-queue insertions hit the uq_background_jobs_active_per_brand
        // partial unique index and get silently skipped.
        if (insertErr.code === "23505") {
          skipped++;
        } else {
          console.error(
            "[cron/shopify-geo-refresh] insert error for brand",
            brand.id,
            insertErr
          );
        }
        continue;
      }
      enqueued++;

      // Mark the brand as queued so the status column reflects the job.
      await supabase
        .from("brands")
        .update({ shopify_geo_sync_status: "queued" } as never)
        .eq("id", brand.id);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      candidates: candidates.length,
      enqueued,
      skipped,
    });
  } catch (err) {
    console.error("[cron/shopify-geo-refresh] error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
