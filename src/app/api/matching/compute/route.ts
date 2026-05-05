import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeMatchesForBrand } from "@/lib/matching/engine";

/**
 * POST /api/matching/compute
 *
 * Two auth paths:
 *  1. User session (browser) — resolves brand_id from the logged-in user.
 *  2. Worker secret + explicit brand_id in body — used by the pipeline worker
 *     after the creator fanout finishes (no user session available).
 */
export async function POST(request: NextRequest) {
  try {
    let brandId: string | null = null;

    // ── Try worker-secret auth first (pipeline callback) ────────────
    const workerSecret = request.headers.get("x-worker-secret");
    const configuredSecret = process.env.MATCHING_COMPUTE_SECRET;

    let limit: number | undefined;
    if (workerSecret && configuredSecret && workerSecret === configuredSecret) {
      const body = (await request.json().catch(() => ({}))) as {
        brand_id?: string;
        limit?: number;
      };
      brandId = body.brand_id ?? null;
      // Optional cap on creator pool. Engine default is 200 (top by CPI).
      // Pass higher to score against more of the corpus — trade-off is
      // compute time (~50ms/creator) and DB row count.
      if (typeof body.limit === "number" && body.limit > 0) {
        limit = Math.min(body.limit, 10000);
      }
      if (!brandId) {
        return NextResponse.json(
          { error: "brand_id required when using worker secret auth" },
          { status: 400 }
        );
      }
    }

    // ── Fall back to user session auth (browser) ────────────────────
    if (!brandId) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Unauthorized. Please sign in." },
          { status: 401 }
        );
      }

      const { data: brandRow, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      const brand = brandRow as { id: string } | null;

      if (brandError || !brand) {
        return NextResponse.json(
          { error: "Brand profile not found. Complete onboarding first." },
          { status: 404 }
        );
      }
      brandId = brand.id;
    }

    // ── Compute matches (service role to bypass RLS on upsert) ──────
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const matchCount = await computeMatchesForBrand(
      serviceSupabase,
      brandId,
      limit ?? 200
    );

    return NextResponse.json({
      success: true,
      matchCount,
    });
  } catch (err) {
    console.error("Matching compute error:", err);
    // Distinguish caller-fixable preconditions from real internal errors.
    // The engine throws a "Brand … has no completed platform analysis"
    // message when no IG/YT analysis exists yet — a 422 with that exact
    // message tells the operator what to do instead of hiding it as 500.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("no completed platform analysis")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Internal server error while computing matches." },
      { status: 500 }
    );
  }
}
