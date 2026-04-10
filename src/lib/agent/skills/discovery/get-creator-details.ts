import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getCreatorDetailsTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL to get a creator's full profile from the database — metrics, content intelligence, audience data, and match score. Never fabricate creator details. Call it when the user asks about a specific creator.",
    inputSchema: z.object({
      creator_id: z.string().optional().describe("Creator UUID"),
      handle: z
        .string()
        .optional()
        .describe("Creator Instagram handle (without @)"),
    }),
    execute: async (params) => {
      if (!params.creator_id && !params.handle) {
        return { error: "Provide either creator_id or handle" };
      }

      // Query leaderboard view for full profile
      let query = supabase.from("mv_creator_leaderboard").select("*");
      if (params.creator_id) {
        query = query.eq("creator_id", params.creator_id);
      } else {
        query = query.ilike("handle", params.handle!);
      }

      const { data: creatorRaw } = await query.single();
      const creator = creatorRaw as Record<string, unknown> | null;
      if (!creator) return { error: "Creator not found" };

      // Get contact email from creators table
      const { data: creatorFullRaw } = await supabase
        .from("creators")
        .select("contact_email, biography, external_url")
        .eq("id", creator.creator_id)
        .single();
      const creatorFull = creatorFullRaw as Record<string, unknown> | null;

      // Get brand-specific match
      const { data: matchRaw } = await supabase
        .from("creator_brand_matches")
        .select("*")
        .eq("brand_id", brandId)
        .eq("creator_id", creator.creator_id)
        .single();
      const match = matchRaw as Record<string, unknown> | null;

      // Get past collaboration history with this brand
      const { data: campaignsRaw } = await supabase
        .from("campaign_creators")
        .select(
          "campaign_id, status, agreed_rate, campaigns!inner(name, goal, status, brand_id)"
        )
        .eq("creator_id", creator.creator_id)
        .eq("campaigns.brand_id", brandId);
      const campaigns = (campaignsRaw || []) as Record<string, unknown>[];

      return {
        profile: {
          id: creator.creator_id,
          handle: creator.handle,
          display_name: creator.display_name,
          followers: creator.followers,
          tier: creator.tier,
          city: creator.city,
          country: creator.country,
          is_verified: creator.is_verified,
          biography: creatorFull?.biography || null,
          contact_email: creatorFull?.contact_email || null,
          external_url: creatorFull?.external_url || null,
        },
        scores: {
          cpi: creator.cpi,
          engagement_quality: creator.engagement_quality,
          content_quality: creator.content_quality,
          audience_authenticity: creator.audience_authenticity,
          avg_engagement_rate: creator.avg_engagement_rate,
          engagement_trend: creator.engagement_trend,
          posts_per_week: creator.posts_per_week,
        },
        content: {
          primary_niche: creator.primary_niche,
          primary_tone: creator.primary_tone,
          primary_language: creator.primary_language,
        },
        audience: {
          primary_audience_language: creator.primary_audience_language,
          primary_country: creator.primary_country,
          authenticity_score: creator.authenticity_score,
          engagement_quality_score: creator.engagement_quality_score,
          community_strength: creator.community_strength,
        },
        brand_match: match
          ? {
              match_score: match.match_score,
              niche_fit: match.niche_fit_score,
              audience_geo: match.audience_geo_score,
              reasoning: match.match_reasoning,
              mentions_brand: match.already_mentions_brand,
              mentions_competitor: match.mentions_competitor,
            }
          : null,
        collaboration_history:
          campaigns.map((c: Record<string, unknown>) => ({
            campaign_id: c.campaign_id,
            status: c.status,
            agreed_rate: c.agreed_rate,
          })),
      };
    },
  });
}
