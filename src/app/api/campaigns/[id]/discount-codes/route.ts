import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createDiscountCode,
  generateCodeName,
} from "@/lib/composio-shopify";

/**
 * GET /api/campaigns/[id]/discount-codes
 * List all discount codes for a campaign.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
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
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found." },
        { status: 404 }
      );
    }

    const { data: codes, error } = await supabase
      .from("campaign_discount_codes" as never)
      .select(
        `
        *,
        creator:creators (
          id, handle, display_name, avatar_url
        )
      `
      )
      .eq("campaign_id", campaignId)
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch discount codes error:", error);
      return NextResponse.json(
        { error: "Failed to fetch discount codes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ codes: codes ?? [] });
  } catch (err) {
    console.error("GET discount-codes error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/[id]/discount-codes
 * Generate discount codes for all confirmed creators (or one specific creator).
 *
 * Body: { creatorId?: string, discountPercent?: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
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
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found." },
        { status: 404 }
      );
    }

    // Get campaign
    const { data: campaignRow, error: campError } = await supabase
      .from("campaigns")
      .select("id, name, start_date, end_date, brand_id, default_discount_percentage")
      .eq("id", campaignId)
      .eq("brand_id", brand.id)
      .single();

    const campaign = campaignRow as {
      id: string;
      name: string;
      start_date: string | null;
      end_date: string | null;
      brand_id: string;
      default_discount_percentage: number | null;
    } | null;

    if (campError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetCreatorId = body.creatorId as string | undefined;
    const discountPercent =
      (body.discountPercent as number) ??
      campaign.default_discount_percentage ??
      15;

    // Get confirmed creators (or a specific one)
    let query = supabase
      .from("campaign_creators")
      .select(
        `
        id,
        creator_id,
        creators!inner ( handle )
      `
      )
      .eq("campaign_id", campaignId)
      .in("status", ["confirmed", "content_live", "completed"]);

    if (targetCreatorId) {
      query = query.eq("creator_id", targetCreatorId);
    }

    const { data: campaignCreators, error: ccError } = await query;

    if (ccError) {
      return NextResponse.json(
        { error: "Failed to fetch campaign creators." },
        { status: 500 }
      );
    }

    if (!campaignCreators?.length) {
      return NextResponse.json(
        { error: "No confirmed creators found." },
        { status: 404 }
      );
    }

    // Get existing codes to skip duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCodes } = await (supabase as any)
      .from("campaign_discount_codes")
      .select("campaign_creator_id")
      .eq("campaign_id", campaignId)
      .eq("is_active", true);

    const existingCreatorIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((existingCodes ?? []) as any[]).map((c: any) => c.campaign_creator_id)
    );

    type CampaignCreatorRow = {
      id: string;
      creator_id: string;
      creators: { handle: string };
    };

    const results: Array<{
      creatorId: string;
      handle: string;
      code: string;
      status: string;
    }> = [];

    for (const row of campaignCreators as unknown as CampaignCreatorRow[]) {
      // Skip if code already exists for this creator
      if (existingCreatorIds.has(row.id)) {
        results.push({
          creatorId: row.creator_id,
          handle: row.creators.handle,
          code: "",
          status: "already_exists",
        });
        continue;
      }

      const handle = row.creators.handle;

      try {
        // Create discount code via Composio → Shopify
        const { code, shopifyDiscountId } = await createDiscountCode(
          brand.id,
          campaign,
          { handle },
          discountPercent
        );

        // Store in our DB
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("campaign_discount_codes").insert({
          campaign_id: campaignId,
          campaign_creator_id: row.id,
          creator_id: row.creator_id,
          brand_id: brand.id,
          code,
          shopify_discount_id: shopifyDiscountId,
          discount_percentage: discountPercent,
          usage_count: 0,
          revenue_attributed: 0,
        });

        results.push({
          creatorId: row.creator_id,
          handle,
          code,
          status: "created",
        });
      } catch (shopifyErr) {
        console.error(
          `Failed to create discount code for @${handle}:`,
          shopifyErr
        );

        // Fallback: generate code locally without Shopify sync
        const fallbackCode = generateCodeName(handle, discountPercent);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("campaign_discount_codes").insert({
          campaign_id: campaignId,
          campaign_creator_id: row.id,
          creator_id: row.creator_id,
          brand_id: brand.id,
          code: fallbackCode,
          shopify_discount_id: null,
          discount_percentage: discountPercent,
          usage_count: 0,
          revenue_attributed: 0,
        });

        results.push({
          creatorId: row.creator_id,
          handle,
          code: fallbackCode,
          status: "created_local_only",
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: results.filter((r) => r.status.startsWith("created")).length,
      results,
    });
  } catch (err) {
    console.error("POST discount-codes error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
