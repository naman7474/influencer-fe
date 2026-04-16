import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/brands/[id]/guidelines
 * Fetch brand guidelines for the authenticated brand owner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await params;
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Verify brand ownership
    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("auth_user_id", user.id)
      .single();

    if (!brandData) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { data: guidelines } = await supabase
      .from("brand_guidelines")
      .select("*")
      .eq("brand_id", brandId)
      .single();

    return NextResponse.json({ data: guidelines });
  } catch (err) {
    console.error("[brands/[id]/guidelines] GET Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch guidelines" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/brands/[id]/guidelines
 * Upsert brand guidelines for the authenticated brand owner.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await params;
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Verify brand ownership
    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("auth_user_id", user.id)
      .single();

    if (!brandData) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const body = await request.json();

    const guidelinesData = {
      brand_id: brandId,
      forbidden_topics: body.forbidden_topics ?? [],
      content_dos: body.content_dos ?? [],
      content_donts: body.content_donts ?? [],
      required_disclosures: body.required_disclosures ?? [],
      preferred_content_themes: body.preferred_content_themes ?? [],
      content_rating: body.content_rating ?? "general",
      require_paid_partnership_label: body.require_paid_partnership_label ?? true,
      max_sponsored_post_rate: body.max_sponsored_post_rate ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from("brand_guidelines")
      .upsert(guidelinesData as never, { onConflict: "brand_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save guidelines: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[brands/[id]/guidelines] PUT Error:", err);
    return NextResponse.json(
      { error: "Failed to save guidelines" },
      { status: 500 }
    );
  }
}
