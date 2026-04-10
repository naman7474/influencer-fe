import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function reengagementRecommenderTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "Find high-performing past creators who haven't been contacted recently and recommend them for re-engagement. Use when the user asks about 're-engage', 'bring back creators', 'past performers', or 'who should we work with again'.",
    inputSchema: z.object({
      min_roi: z
        .number()
        .optional()
        .default(1.5)
        .describe("Minimum lifetime ROI to consider"),
      inactive_days: z
        .number()
        .optional()
        .default(90)
        .describe("Minimum days since last interaction"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Max results"),
    }),
    execute: async (params) => {
      // 1. Get relationship summaries for this brand
      const { data: relsRaw } = await supabase
        .from("mv_creator_relationship_summary")
        .select("*")
        .eq("brand_id", brandId)
        .gte("lifetime_roi", params.min_roi ?? 1.5)
        .gte("total_campaigns", 1)
        .order("lifetime_roi", { ascending: false });
      const rels = (relsRaw || []) as Record<string, unknown>[];

      if (rels.length === 0) {
        return {
          results: [],
          count: 0,
          message: `No past creators found with ROI >= ${params.min_roi ?? 1.5}x. Lower the threshold or run more campaigns.`,
        };
      }

      // 2. Filter by inactivity
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (params.inactive_days ?? 90));
      const cutoffStr = cutoffDate.toISOString();

      const inactive = rels.filter((r) => {
        const lastCompleted = r.last_campaign_completed as string | null;
        if (!lastCompleted) return true; // never completed = definitely inactive
        return lastCompleted < cutoffStr;
      });

      if (inactive.length === 0) {
        return {
          results: [],
          count: 0,
          message: `All high-performing creators have been active in the last ${params.inactive_days ?? 90} days.`,
        };
      }

      // 3. Load creator profiles
      const creatorIds = inactive
        .slice(0, Math.min(params.limit ?? 10, 25))
        .map((r) => r.creator_id as string);

      const { data: creatorsRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, display_name, followers, tier, cpi, avg_engagement_rate, primary_niche"
        )
        .in("creator_id", creatorIds);
      const creators = (creatorsRaw || []) as Record<string, unknown>[];
      const creatorMap = new Map(
        creators.map((c) => [c.creator_id as string, c])
      );

      // 4. Check for recent outreach
      const { data: outreachRaw } = await supabase
        .from("outreach_messages")
        .select("creator_id")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds)
        .gte("created_at", cutoffStr);
      const recentlyContacted = new Set(
        ((outreachRaw || []) as Record<string, unknown>[]).map(
          (o) => o.creator_id as string
        )
      );

      const results = inactive
        .filter((r) => !recentlyContacted.has(r.creator_id as string))
        .slice(0, params.limit ?? 10)
        .map((r) => {
          const creator = creatorMap.get(r.creator_id as string);
          const lastCompleted = r.last_campaign_completed as string | null;
          const daysSince = lastCompleted
            ? Math.floor(
                (Date.now() - new Date(lastCompleted).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null;

          return {
            creator_id: r.creator_id,
            handle: creator?.handle ?? r.creator_id,
            display_name: creator?.display_name,
            tier: creator?.tier,
            followers: creator?.followers,
            cpi: creator?.cpi,
            niche: creator?.primary_niche,
            past_performance: {
              total_campaigns: r.total_campaigns,
              total_spend: r.total_spend,
              total_revenue: r.total_revenue,
              lifetime_roi: r.lifetime_roi,
            },
            last_campaign: lastCompleted,
            days_inactive: daysSince,
            re_engagement_priority:
              (r.lifetime_roi as number) >= 3
                ? "high"
                : (r.lifetime_roi as number) >= 2
                  ? "medium"
                  : "low",
          };
        });

      return {
        results,
        count: results.length,
        total_high_performers: rels.length,
        filtered_by_inactivity: inactive.length,
        excluded_recently_contacted: recentlyContacted.size,
      };
    },
  });
}
