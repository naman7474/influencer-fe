import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recomputeMatchesForCreator } from "@/lib/matching/engine";

/**
 * POST /api/matching/recompute-creator
 * Body: { creator_id: string }
 *
 * Worker-only endpoint (requires x-worker-secret). Called by the
 * pipeline handler when a standalone creator pipeline finishes.
 * Recomputes creator_brand_matches for every brand that either has
 * Shopify connected or already has brand_shopify_geo data.
 */
export async function POST(request: NextRequest) {
  try {
    const workerSecret = request.headers.get("x-worker-secret");
    const configuredSecret = process.env.MATCHING_COMPUTE_SECRET;
    if (
      !workerSecret ||
      !configuredSecret ||
      workerSecret !== configuredSecret
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      creator_id?: string;
    };
    const creatorId = body.creator_id;
    if (!creatorId) {
      return NextResponse.json(
        { error: "creator_id required" },
        { status: 400 }
      );
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const result = await recomputeMatchesForCreator(
      serviceSupabase,
      creatorId
    );

    return NextResponse.json({
      success: true,
      creator_id: creatorId,
      ...result,
    });
  } catch (err) {
    console.error("recompute-creator error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
