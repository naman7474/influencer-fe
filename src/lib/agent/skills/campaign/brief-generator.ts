import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function briefGeneratorTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "Generate a personalized creative brief for a creator in a campaign. Combines brand context, campaign goals, and creator profile to produce a tailored content brief. Use when the user asks to 'write a brief', 'create a content brief', or 'draft creator instructions'.",
    inputSchema: z.object({
      campaign_id: z.string().describe("Campaign UUID"),
      creator_id: z.string().describe("Creator UUID"),
    }),
    execute: async (params) => {
      // 1. Load campaign
      const { data: campaignRaw } = await supabase
        .from("campaigns")
        .select(
          "id, name, goal, budget, start_date, end_date, discount_percent, brief_requirements, status"
        )
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();
      const campaign = campaignRaw as Record<string, unknown> | null;

      if (!campaign)
        return { error: "Campaign not found or access denied" };

      // 2. Load brand
      const { data: brandRaw } = await supabase
        .from("brands")
        .select(
          "brand_name, brand_description, website, target_audience, brand_values, industry"
        )
        .eq("id", brandId)
        .single();
      const brand = brandRaw as Record<string, unknown> | null;

      if (!brand) return { error: "Brand not found" };

      // 3. Load creator profile
      const { data: creatorRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, display_name, followers, tier, primary_niche, avg_engagement_rate, city"
        )
        .eq("creator_id", params.creator_id)
        .single();
      const creator = creatorRaw as Record<string, unknown> | null;

      if (!creator) return { error: "Creator not found" };

      // 4. Check campaign_creator record
      const { data: ccRaw } = await supabase
        .from("campaign_creators")
        .select("id, status, agreed_rate")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id)
        .single();
      const cc = ccRaw as Record<string, unknown> | null;

      if (!cc) {
        return {
          error:
            "Creator is not part of this campaign. Add them first.",
        };
      }

      // 5. Get creator's discount code if exists
      const { data: codeRaw } = await supabase
        .from("campaign_discount_codes")
        .select("code")
        .eq("campaign_id", params.campaign_id)
        .eq("creator_id", params.creator_id)
        .single();
      const discountCode = (codeRaw as Record<string, unknown> | null)?.code as
        | string
        | null;

      // 6. Get caption intelligence for tone/style context
      const { data: captionRaw } = await supabase
        .from("caption_intelligence")
        .select("primary_tone, content_themes, avg_caption_length")
        .eq("creator_id", params.creator_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const captionIntel = captionRaw as Record<string, unknown> | null;

      // 7. Build brief
      const requirements = (campaign.brief_requirements as string[]) || [];
      const brief = {
        campaign_name: campaign.name,
        brand_name: brand.brand_name,
        creator_handle: creator.handle,
        creator_name: creator.display_name,

        // Brand context
        brand_description: brand.brand_description,
        brand_website: brand.website,
        target_audience: brand.target_audience,
        brand_values: brand.brand_values,

        // Campaign details
        campaign_goal: campaign.goal,
        campaign_dates: {
          start: campaign.start_date,
          end: campaign.end_date,
        },

        // Creator-specific
        creator_niche: creator.primary_niche,
        creator_tier: creator.tier,
        creator_city: creator.city,
        creator_tone: captionIntel?.primary_tone ?? null,
        content_themes: captionIntel?.content_themes ?? null,

        // Requirements
        content_requirements: [
          "Include #ad or #sponsored disclosure",
          `Tag @${(brand.brand_name as string || "").replace(/\s+/g, "").toLowerCase()} in the post`,
          ...(discountCode
            ? [`Mention discount code: ${discountCode}`]
            : []),
          ...requirements,
        ],

        // Discount code
        discount_code: discountCode,
        discount_percent: campaign.discount_percent,

        // Suggested content direction (based on creator's style)
        suggested_direction: buildSuggestedDirection(
          creator,
          brand,
          campaign,
          captionIntel
        ),
      };

      return { brief };
    },
  });
}

function buildSuggestedDirection(
  creator: Record<string, unknown>,
  brand: Record<string, unknown>,
  campaign: Record<string, unknown>,
  captionIntel: Record<string, unknown> | null
): string {
  const niche = (creator.primary_niche as string) || "lifestyle";
  const tone = (captionIntel?.primary_tone as string) || "engaging";
  const goal = (campaign.goal as string) || "";
  const brandName = (brand.brand_name as string) || "the brand";

  let direction = `Create ${tone} content in your ${niche} style that authentically showcases ${brandName}.`;

  if (goal.toLowerCase().includes("awareness")) {
    direction += ` Focus on introducing the brand to your audience — emphasize what makes it unique.`;
  } else if (goal.toLowerCase().includes("conversion") || goal.toLowerCase().includes("sales")) {
    direction += ` Focus on driving purchases — share your genuine experience and encourage your audience to try it.`;
  } else if (goal.toLowerCase().includes("launch")) {
    direction += ` Build excitement around the launch — tease before and showcase on launch day.`;
  }

  return direction;
}
