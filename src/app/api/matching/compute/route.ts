import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeMatchesForBrand } from "@/lib/matching/engine";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();

    // ── 1. Authenticate user ────────────────────────────────────────
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

    // ── 2. Get their brand_id ───────────────────────────────────────
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

    // ── 3. Compute matches (service role to bypass RLS on upsert) ───
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const matchCount = await computeMatchesForBrand(serviceSupabase, brand.id);

    // ── 4. Return result ────────────────────────────────────────────
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
