import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateUTMLink, generateShortCode, buildShortUrl } from "@/lib/utm";
import slugify from "slugify";

/**
 * POST /api/campaigns/[id]/utm
 *
 * Generates UTM links for all confirmed creators in a campaign
 * and upserts them into the campaign_utm_links table.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();

    // ── 1. Authenticate user ──────────────────────────────────────────
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

    // ── 2. Get brand data ─────────────────────────────────────────────
    const { data: brandRow, error: brandError } = await supabase
      .from("brands")
      .select("id, brand_name, website")
      .eq("auth_user_id", user.id)
      .single();

    if (brandError || !brandRow) {
      return NextResponse.json(
        { error: "Brand profile not found." },
        { status: 404 }
      );
    }

    const brand = brandRow as { id: string; brand_name: string; website: string | null };

    if (!brand.website) {
      return NextResponse.json(
        { error: "Brand website is required to generate UTM links. Update your brand profile." },
        { status: 400 }
      );
    }

    // ── 3. Get campaign data ──────────────────────────────────────────
    const { data: campaignRow, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, brand_id")
      .eq("id", campaignId)
      .eq("brand_id", brand.id)
      .single();

    if (campaignError || !campaignRow) {
      return NextResponse.json(
        { error: "Campaign not found or access denied." },
        { status: 404 }
      );
    }

    const campaign = campaignRow as { id: string; name: string; brand_id: string };

    // ── 4. Get all confirmed campaign creators ────────────────────────
    const { data: campaignCreators, error: ccError } = await supabase
      .from("campaign_creators")
      .select(
        `
        id,
        creator_id,
        creators!inner (
          handle,
          tier
        )
      `
      )
      .eq("campaign_id", campaignId)
      .eq("status", "confirmed");

    if (ccError) {
      return NextResponse.json(
        { error: "Failed to fetch campaign creators." },
        { status: 500 }
      );
    }

    if (!campaignCreators?.length) {
      return NextResponse.json(
        { error: "No confirmed creators found in this campaign." },
        { status: 404 }
      );
    }

    // ── 5. Generate UTM links and upsert ──────────────────────────────
    type CampaignCreatorRow = {
      id: string;
      creator_id: string;
      creators: { handle: string; tier: string | null };
    };

    const links: Array<{
      brand_id: string;
      campaign_id: string;
      creator_id: string;
      campaign_creator_id: string;
      utm_source: string;
      utm_medium: string;
      utm_campaign: string;
      utm_content: string;
      utm_term: string;
      full_url: string;
      short_code: string;
      short_url: string;
      click_count: number;
    }> = [];

    for (const row of campaignCreators as unknown as CampaignCreatorRow[]) {
      const creator = row.creators;
      const fullUrl = generateUTMLink(
        brand.website!,
        campaign.name,
        creator.handle,
        creator.tier ?? "unknown"
      );
      const shortCode = generateShortCode();
      const shortUrl = buildShortUrl(shortCode);

      links.push({
        brand_id: brand.id,
        campaign_id: campaign.id,
        creator_id: row.creator_id,
        campaign_creator_id: row.id,
        utm_source: "instagram",
        utm_medium: "influencer",
        utm_campaign: slugify(campaign.name, { lower: true, strict: true }),
        utm_content: creator.handle,
        utm_term: creator.tier ?? "unknown",
        full_url: fullUrl,
        short_code: shortCode,
        short_url: shortUrl,
        click_count: 0,
      });
    }

    const { error: upsertError } = await supabase
      .from("campaign_utm_links")
      .upsert(links as never[], {
        onConflict: "campaign_id,creator_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("UTM link upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save UTM links." },
        { status: 500 }
      );
    }

    // ── 6. Return generated links ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      count: links.length,
      links: links.map((l) => ({
        creator_id: l.creator_id,
        full_url: l.full_url,
      })),
    });
  } catch (err) {
    console.error("UTM generation error:", err);
    return NextResponse.json(
      { error: "Internal server error while generating UTM links." },
      { status: 500 }
    );
  }
}
