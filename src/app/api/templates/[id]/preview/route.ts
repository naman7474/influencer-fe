import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveTemplate, type MergeContext } from "@/lib/outreach/merge-fields";

/**
 * POST /api/templates/[id]/preview
 * Preview a template with merge fields resolved for a specific creator.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
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
      .select("*")
      .eq("auth_user_id", user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brand = brandRow as Record<string, any> | null;
    if (!brand) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    // Fetch template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templateRow } = await (supabase as any)
      .from("outreach_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = templateRow as Record<string, any> | null;
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const body = await request.json();
    const { creator_id, campaign_id } = body as {
      creator_id: string;
      campaign_id?: string;
    };

    if (!creator_id) {
      return NextResponse.json(
        { error: "creator_id is required." },
        { status: 400 }
      );
    }

    // Fetch creator data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creatorRow } = await (supabase as any)
      .from("creators")
      .select("*")
      .eq("id", creator_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creator = creatorRow as Record<string, any> | null;
    if (!creator) {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }

    // Fetch creator scores
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scoresRow } = await (supabase as any)
      .from("creator_scores")
      .select("avg_engagement_rate, cpi")
      .eq("creator_id", creator_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scores = scoresRow as Record<string, any> | null;

    // Fetch caption intelligence
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: captionIntelRow } = await (supabase as any)
      .from("caption_intelligence")
      .select("primary_niche, primary_tone, organic_brand_mentions, paid_brand_mentions")
      .eq("creator_id", creator_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const captionIntel = captionIntelRow as Record<string, any> | null;

    // Fetch recent posts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: postsData } = await (supabase as any)
      .from("posts")
      .select("description")
      .eq("creator_id", creator_id)
      .order("posted_at", { ascending: false })
      .limit(3);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = (postsData ?? []) as any[];

    // Fetch campaign if provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let campaign: Record<string, any> | null = null;
    if (campaign_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: campaignData } = await (supabase as any)
        .from("campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single();
      campaign = campaignData;
    }

    // Fetch UTM link and discount code if campaign exists
    let utmLink = "";
    let discountCode = "";
    let discountPercent = "";
    if (campaign_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: utm } = await (supabase as any)
        .from("campaign_utm_links")
        .select("full_url")
        .eq("campaign_id", campaign_id)
        .eq("creator_id", creator_id)
        .single();
      utmLink = utm?.full_url || "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: discount } = await (supabase as any)
        .from("campaign_discount_codes")
        .select("code, discount_percentage")
        .eq("campaign_id", campaign_id)
        .eq("creator_id", creator_id)
        .single();
      discountCode = discount?.code || "";
      discountPercent = discount?.discount_percentage?.toString() || "";
    }

    const ctx: MergeContext = {
      creator: {
        handle: creator.handle,
        display_name: creator.display_name,
        followers: creator.followers,
        tier: creator.tier,
        city: creator.city,
        country: creator.country,
        contact_email: creator.contact_email,
        category: creator.category,
      },
      creatorScores: {
        avg_engagement_rate: scores?.avg_engagement_rate ?? null,
        cpi: scores?.cpi ?? null,
      },
      captionIntelligence: {
        primary_niche: captionIntel?.primary_niche ?? null,
        primary_tone: captionIntel?.primary_tone ?? null,
        organic_brand_mentions: (captionIntel?.organic_brand_mentions as string[]) || [],
        paid_brand_mentions: (captionIntel?.paid_brand_mentions as string[]) || [],
      },
      posts: (posts || []).map((p) => ({
        description: p.description,
      })),
      brand: {
        brand_name: brand.brand_name,
        industry: brand.industry,
        website: brand.website,
        gmail_email: brand.gmail_email as string | null,
        product_categories: (brand.product_categories as string[]) || [],
        competitor_brands: (brand.competitor_brands as string[]) || [],
      },
      campaign: campaign
        ? {
            name: campaign.name,
            description: campaign.description,
            content_format: campaign.content_format,
            budget_per_creator: campaign.budget_per_creator,
            end_date: campaign.end_date,
          }
        : undefined,
      senderName:
        (brand.email_sender_name as string) || user.user_metadata?.full_name || "Team",
      discountCode,
      discountPercent,
      utmLink,
    };

    const resolvedSubject = resolveTemplate(template.subject || "", ctx);
    const resolvedBody = resolveTemplate(template.body, ctx);

    return NextResponse.json({
      subject: resolvedSubject,
      body: resolvedBody,
      creator: {
        handle: creator.handle,
        display_name: creator.display_name,
        contact_email: creator.contact_email,
      },
    });
  } catch (err) {
    console.error("Template preview error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
