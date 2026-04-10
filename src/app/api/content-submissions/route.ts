import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/content-submissions
 * Two auth modes:
 *  1. Public (creator): uses campaignCreatorId + token
 *  2. Authenticated (brand): uses session auth, no token needed
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await request.json();

    const {
      campaignCreatorId,
      token,
      contentUrl,
      captionText,
      submissionType,
    } = body;

    if (!campaignCreatorId) {
      return NextResponse.json(
        { error: "Missing campaignCreatorId." },
        { status: 400 }
      );
    }

    if (!contentUrl && !captionText) {
      return NextResponse.json(
        { error: "Please provide a content URL or caption text." },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cc: any;

    if (token) {
      // ── Public creator flow: verify token ──
      const { data: ccRow } = await supabase
        .from("campaign_creators")
        .select(
          "id, campaign_id, creator_id, submission_token, submission_token_expires_at"
        )
        .eq("id", campaignCreatorId)
        .single();

      cc = ccRow as any;

      if (!cc || cc.submission_token !== token) {
        return NextResponse.json(
          { error: "Invalid submission link." },
          { status: 403 }
        );
      }

      if (
        cc.submission_token_expires_at &&
        new Date(cc.submission_token_expires_at) < new Date()
      ) {
        return NextResponse.json(
          { error: "This submission link has expired." },
          { status: 403 }
        );
      }
    } else {
      // ── Authenticated brand flow: verify session ──
      const authSupabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await authSupabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Unauthorized. Provide a token or sign in." },
          { status: 401 }
        );
      }

      const { data: ccRow } = await supabase
        .from("campaign_creators")
        .select("id, campaign_id, creator_id")
        .eq("id", campaignCreatorId)
        .single();

      cc = ccRow as any;

      if (!cc) {
        return NextResponse.json(
          { error: "Campaign creator not found." },
          { status: 404 }
        );
      }
    }

    // Run basic compliance checks if we have campaign data
    let complianceCheck = null;
    if (captionText) {
      // Get campaign data for compliance
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("name, brand_id")
        .eq("id", cc.campaign_id)
        .single();

      // Get brand handle
      const { data: brandRow } = await supabase
        .from("brands")
        .select("brand_name")
        .eq("id", (campaign as { brand_id: string } | null)?.brand_id ?? "")
        .single();

      // Get discount code
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: codeRow } = await (supabase as any)
        .from("campaign_discount_codes")
        .select("code")
        .eq("campaign_creator_id", campaignCreatorId)
        .eq("is_active", true)
        .limit(1)
        .single();

      const brandName =
        (brandRow as { brand_name: string } | null)?.brand_name ?? "";
      const discountCode = (codeRow as { code: string } | null)?.code ?? "";

      complianceCheck = {
        has_ad_disclosure:
          /\b#ad\b/i.test(captionText) ||
          /\b#sponsored\b/i.test(captionText) ||
          /\b#partner\b/i.test(captionText),
        has_brand_tag: captionText
          .toLowerCase()
          .includes(`@${brandName.toLowerCase().replace(/\s+/g, "")}`),
        has_discount_code: discountCode
          ? captionText.toUpperCase().includes(discountCode.toUpperCase())
          : null,
      };
    }

    // Insert submission
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: submission, error: insertError } = await (supabase as any)
      .from("content_submissions")
      .insert({
        campaign_id: cc.campaign_id,
        campaign_creator_id: campaignCreatorId,
        creator_id: cc.creator_id,
        submission_type: submissionType || "draft",
        content_url: contentUrl || null,
        caption_text: captionText || null,
        compliance_check: complianceCheck,
        status: "submitted",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert submission error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit content." },
        { status: 500 }
      );
    }

    // Update campaign_creator content_status
    await supabase
      .from("campaign_creators")
      .update({ content_status: "submitted" } as never)
      .eq("id", campaignCreatorId);

    // Create notification for the brand
    const { data: creator } = await supabase
      .from("creators")
      .select("handle")
      .eq("id", cc.creator_id)
      .single();

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("brand_id, name")
      .eq("id", cc.campaign_id)
      .single();

    if (campaign) {
      await supabase.from("notifications").insert({
        brand_id: (campaign as { brand_id: string }).brand_id,
        type: "content_submitted",
        title: `@${(creator as { handle: string } | null)?.handle ?? "Creator"} submitted content`,
        body: `Content submitted for ${(campaign as { name: string }).name}. Review it in the Content tab.`,
        priority: "medium",
        campaign_id: cc.campaign_id,
        creator_id: cc.creator_id,
      } as never);
    }

    return NextResponse.json({ success: true, submission });
  } catch (err) {
    console.error("POST content-submission error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
