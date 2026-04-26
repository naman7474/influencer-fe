import { NextRequest, NextResponse } from "next/server";
import slugify from "slugify";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  generateUTMLink,
  generateShortCode,
  buildShortUrl,
} from "@/lib/utm";

/**
 * POST /api/campaigns/[id]/creators/[creator_id]/tracking-link
 *
 * Returns an existing tracking link for (campaign, creator) or creates one if
 * none exists. Idempotent — calling twice will not regenerate the short code.
 * Used by the campaign side panel when a creator's status flips to
 * `confirmed`, so the brand sees the link inline immediately.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; creator_id: string }> },
) {
  try {
    const { id: campaignId, creator_id: creatorId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id, brand_name, website")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as
      | { id: string; brand_name: string; website: string | null }
      | null;
    if (!brand) {
      return NextResponse.json(
        { error: "Brand profile not found." },
        { status: 404 },
      );
    }
    if (!brand.website) {
      return NextResponse.json(
        {
          error:
            "Brand website is required to generate tracking links. Update your brand profile.",
        },
        { status: 400 },
      );
    }

    const { data: campaignRow } = await supabase
      .from("campaigns")
      .select("id, name, brand_id")
      .eq("id", campaignId)
      .eq("brand_id", brand.id)
      .single();
    const campaign = campaignRow as
      | { id: string; name: string; brand_id: string }
      | null;
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found or access denied." },
        { status: 404 },
      );
    }

    // Already have a link? Return it as-is.
    const { data: existingRow } = await supabase
      .from("campaign_utm_links")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    if (existingRow) {
      return NextResponse.json({ link: existingRow, created: false });
    }

    // Resolve the campaign_creator + creator details.
    const { data: ccRow } = await supabase
      .from("campaign_creators")
      .select("id, creator_id, creators!inner (handle, tier)")
      .eq("campaign_id", campaignId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    const cc = ccRow as
      | {
          id: string;
          creator_id: string;
          creators: { handle: string; tier: string | null };
        }
      | null;
    if (!cc) {
      return NextResponse.json(
        { error: "Creator is not on this campaign." },
        { status: 404 },
      );
    }

    const fullUrl = generateUTMLink(
      brand.website,
      campaign.name,
      cc.creators.handle,
      cc.creators.tier ?? "unknown",
    );
    const shortCode = generateShortCode();
    const shortUrl = buildShortUrl(shortCode);

    const insertRow = {
      brand_id: brand.id,
      campaign_id: campaign.id,
      creator_id: cc.creator_id,
      campaign_creator_id: cc.id,
      utm_source: "instagram",
      utm_medium: "influencer",
      utm_campaign: slugify(campaign.name, { lower: true, strict: true }),
      utm_content: cc.creators.handle,
      utm_term: cc.creators.tier ?? "unknown",
      full_url: fullUrl,
      short_code: shortCode,
      short_url: shortUrl,
      click_count: 0,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("campaign_utm_links")
      .insert(insertRow as never)
      .select()
      .single();
    if (insertError) {
      console.error("tracking-link insert:", insertError);
      return NextResponse.json(
        { error: "Failed to create tracking link." },
        { status: 500 },
      );
    }

    return NextResponse.json({ link: inserted, created: true });
  } catch (err) {
    console.error("tracking-link error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
