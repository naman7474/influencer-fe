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

    if (workerSecret && configuredSecret && workerSecret === configuredSecret) {
      const body = await request.json().catch(() => ({}));
      brandId = (body as { brand_id?: string }).brand_id ?? null;
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
    const matchCount = await computeMatchesForBrand(serviceSupabase, brandId);

    return NextResponse.json({
      success: true,
      matchCount,
    });
  } catch (err) {
    console.error("Matching compute error:", err);
    return NextResponse.json(
      { error: "Internal server error while computing matches." },
      { status: 500 }
    );
  }
}
