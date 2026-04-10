import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function geoOpportunityFinderTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to find geographic opportunities from real Shopify and creator data. Matches underperforming regions with available creators. Call it when the user asks about geographic gaps, regional opportunities, or new markets.",
    inputSchema: z.object({
      min_gap_score: z
        .number()
        .optional()
        .default(0.3)
        .describe("Minimum gap score to consider (0-1, higher = bigger opportunity)"),
      min_cpi: z
        .number()
        .optional()
        .default(50)
        .describe("Minimum CPI score for creators"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Max regions to return"),
    }),
    execute: async (params) => {
      // 1. Load brand's geographic gaps
      const { data: geoRaw } = await supabase
        .from("brand_shopify_geo")
        .select("city, state, country, sessions, orders, revenue, conversion_rate, gap_score, problem_type")
        .eq("brand_id", brandId)
        .gte("gap_score", params.min_gap_score ?? 0.3)
        .order("gap_score", { ascending: false })
        .limit(params.limit ?? 10);
      const geoGaps = (geoRaw || []) as Record<string, unknown>[];

      if (geoGaps.length === 0) {
        return {
          results: [],
          count: 0,
          message:
            "No significant geographic gaps found. This could mean your Shopify data hasn't been synced or your regional performance is balanced.",
        };
      }

      // 2. For each gap region, find creators
      const results: Record<string, unknown>[] = [];

      for (const gap of geoGaps) {
        const city = gap.city as string | null;
        const state = gap.state as string | null;

        let creatorQuery = supabase
          .from("mv_creator_leaderboard")
          .select(
            "creator_id, handle, display_name, followers, tier, cpi, avg_engagement_rate, primary_niche, city, country"
          )
          .gte("cpi", params.min_cpi ?? 50)
          .order("cpi", { ascending: false })
          .limit(5);

        // Try audience_country match (city/country on creators are mostly null)
        if (city) {
          // Search biography for city mentions as fallback since city field is often null
          creatorQuery = creatorQuery.or(`city.ilike.%${city}%,biography.ilike.%${city}%`);
        } else if (state) {
          creatorQuery = creatorQuery.or(`city.ilike.%${state}%,biography.ilike.%${state}%`);
        }

        const { data: creatorsRaw } = await creatorQuery;
        const creators = (creatorsRaw || []) as Record<string, unknown>[];

        // Get match scores for these creators
        const creatorIds = creators.map((c) => c.creator_id as string);
        let matchMap = new Map<string, Record<string, unknown>>();
        if (creatorIds.length > 0) {
          const { data: matchesRaw } = await supabase
            .from("creator_brand_matches")
            .select("creator_id, match_score")
            .eq("brand_id", brandId)
            .in("creator_id", creatorIds);
          matchMap = new Map(
            ((matchesRaw || []) as Record<string, unknown>[]).map((m) => [
              m.creator_id as string,
              m,
            ])
          );
        }

        results.push({
          region: {
            city: gap.city,
            state: gap.state,
            country: gap.country,
          },
          gap_analysis: {
            gap_score: gap.gap_score,
            problem_type: gap.problem_type,
            current_sessions: gap.sessions,
            current_orders: gap.orders,
            current_revenue: gap.revenue,
            conversion_rate: gap.conversion_rate,
          },
          available_creators: creators.map((c) => ({
            id: c.creator_id,
            handle: c.handle,
            followers: c.followers,
            tier: c.tier,
            cpi_score: c.cpi,
            engagement_rate: c.avg_engagement_rate,
            niche: c.primary_niche,
            match_score:
              (matchMap.get(c.creator_id as string) as Record<string, unknown>)
                ?.match_score ?? null,
          })),
          creator_count: creators.length,
        });
      }

      return {
        results,
        regions_analyzed: results.length,
        regions_with_creators: results.filter(
          (r) => (r.creator_count as number) > 0
        ).length,
      };
    },
  });
}
