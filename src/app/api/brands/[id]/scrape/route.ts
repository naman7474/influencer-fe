import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { analyzeBrandWebsite } from "@/lib/scraping/brand-analyzer";

/**
 * POST /api/brands/[id]/scrape
 * Re-analyze the brand's website and update brand identity fields.
 * Authenticated — brand owner only.
 */
export async function POST(
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
      .select("id, website")
      .eq("id", brandId)
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as { id: string; website: string | null } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    if (!brand.website) {
      return NextResponse.json(
        { error: "Brand has no website configured" },
        { status: 400 }
      );
    }

    const normalizedUrl = brand.website.startsWith("http")
      ? brand.website
      : `https://${brand.website}`;

    const result = await analyzeBrandWebsite(normalizedUrl);

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error || "Failed to analyze website" },
        { status: 502 }
      );
    }

    const extraction = result.data;

    // Update brand fields from extraction (only non-null extracted values)
    const updates: Record<string, unknown> = {
      last_scraped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (extraction.description) updates.brand_description = extraction.description;
    if (extraction.brand_values?.length) updates.brand_values = extraction.brand_values;
    if (extraction.target_audience) updates.target_audience = extraction.target_audience;
    if (extraction.industry && !brand) updates.industry = extraction.industry;
    if (extraction.logo_url) updates.logo_url = extraction.logo_url;
    if (extraction.product_categories?.length) {
      updates.product_categories = extraction.product_categories;
    }

    await supabase
      .from("brands")
      .update(updates as never)
      .eq("id", brandId);

    return NextResponse.json({ data: extraction });
  } catch (err) {
    console.error("[brands/[id]/scrape] Error:", err);
    return NextResponse.json(
      { error: "Failed to scrape website" },
      { status: 500 }
    );
  }
}
