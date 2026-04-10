import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function ambassadorIdentifierTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "Identify creators who qualify as brand ambassadors — those with 3+ completed campaigns and consistently high performance. Use when the user asks about 'ambassadors', 'long-term partners', 'who are our best creators', or 'ambassador program'.",
    inputSchema: z.object({
      min_campaigns: z
        .number()
        .optional()
        .default(3)
        .describe("Minimum completed campaigns"),
      min_roi: z
        .number()
        .optional()
        .default(2)
        .describe("Minimum lifetime ROI"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Max results"),
    }),
    execute: async (params) => {
      // 1. Query relationship summaries for ambassador-caliber creators
      const { data: relsRaw } = await supabase
        .from("mv_creator_relationship_summary")
        .select("*")
        .eq("brand_id", brandId)
        .gte("total_campaigns", params.min_campaigns ?? 3)
        .gte("lifetime_roi", params.min_roi ?? 2)
        .order("lifetime_roi", { ascending: false })
        .limit(params.limit ?? 10);
      const rels = (relsRaw || []) as Record<string, unknown>[];

      if (rels.length === 0) {
        return {
          results: [],
          count: 0,
          message: `No creators found with ${params.min_campaigns ?? 3}+ campaigns and ${params.min_roi ?? 2}x+ ROI. This is normal for early-stage brands. Consider lowering thresholds.`,
        };
      }

      // 2. Load creator profiles
      const creatorIds = rels.map((r) => r.creator_id as string);
      const { data: creatorsRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, display_name, followers, tier, cpi, avg_engagement_rate, primary_niche, city"
        )
        .in("creator_id", creatorIds);
      const creators = (creatorsRaw || []) as Record<string, unknown>[];
      const creatorMap = new Map(
        creators.map((c) => [c.creator_id as string, c])
      );

      // 3. Check brand match data
      const { data: matchesRaw } = await supabase
        .from("creator_brand_matches")
        .select("creator_id, match_score, already_mentions_brand")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds);
      const matchMap = new Map(
        ((matchesRaw || []) as Record<string, unknown>[]).map((m) => [
          m.creator_id as string,
          m,
        ])
      );

      const results = rels.map((r) => {
        const creator = creatorMap.get(r.creator_id as string);
        const match = matchMap.get(r.creator_id as string);

        return {
          creator_id: r.creator_id,
          handle: creator?.handle ?? r.creator_id,
          display_name: creator?.display_name,
          tier: creator?.tier,
          followers: creator?.followers,
          cpi: creator?.cpi,
          niche: creator?.primary_niche,
          city: creator?.city,
          ambassador_metrics: {
            total_campaigns: r.total_campaigns,
            total_spend: r.total_spend,
            total_revenue: r.total_revenue,
            total_orders: r.total_orders,
            lifetime_roi: r.lifetime_roi,
            last_campaign: r.last_campaign_completed,
          },
          brand_affinity: {
            match_score: match?.match_score ?? null,
            organically_mentions_brand:
              match?.already_mentions_brand ?? false,
          },
          ambassador_tier:
            (r.lifetime_roi as number) >= 5 && (r.total_campaigns as number) >= 5
              ? "platinum"
              : (r.lifetime_roi as number) >= 3
                ? "gold"
                : "silver",
        };
      });

      return {
        results,
        count: results.length,
        summary: {
          platinum: results.filter((r) => r.ambassador_tier === "platinum").length,
          gold: results.filter((r) => r.ambassador_tier === "gold").length,
          silver: results.filter((r) => r.ambassador_tier === "silver").length,
        },
      };
    },
  });
}
