import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function warmLeadDetectorTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to find warm leads — creators who organically mention your brand. Queries real database data. Call it when the user asks about warm leads, organic mentions, or easy wins.",
    inputSchema: z.object({
      min_match_score: z
        .number()
        .optional()
        .default(50)
        .describe(
          "Minimum brand match score (0-100 scale). Default 50."
        ),
      limit: z
        .number()
        .optional()
        .default(15)
        .describe("Max results (1-25)"),
    }),
    execute: async (params) => {
      // match_score is stored as 0-1 in the DB, but the tool's param is
      // exposed as 0-100 to the LLM for natural-language friendliness.
      const minScore01 = (params.min_match_score ?? 50) / 100;

      // 1. Find creators who already mention the brand
      const { data: matchesRaw } = await supabase
        .from("creator_brand_matches")
        .select(
          "creator_id, match_score, niche_fit_score, audience_geo_score, match_reasoning, already_mentions_brand, mentions_competitor"
        )
        .eq("brand_id", brandId)
        .eq("already_mentions_brand", true)
        .gte("match_score", minScore01)
        .order("match_score", { ascending: false })
        .limit(50);
      const matches = (matchesRaw || []) as Record<string, unknown>[];

      if (matches.length === 0) {
        return {
          results: [],
          count: 0,
          message:
            "No warm leads found. This means no analyzed creators organically mention your brand. Try lowering the min_match_score or ensure your creator data is up to date.",
        };
      }

      // 2. Check which creators have NOT been contacted
      const creatorIds = matches.map((m) => m.creator_id as string);
      const { data: outreachRaw } = await supabase
        .from("outreach_messages")
        .select("creator_id")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds)
        .in("status", ["sent", "delivered", "opened", "replied"]);
      const contacted = new Set(
        ((outreachRaw || []) as Record<string, unknown>[]).map(
          (o) => o.creator_id as string
        )
      );

      // Filter to un-contacted only
      const warmMatches = matches.filter(
        (m) => !contacted.has(m.creator_id as string)
      );

      if (warmMatches.length === 0) {
        return {
          results: [],
          count: 0,
          total_mentioners: matches.length,
          already_contacted: contacted.size,
          message: `Found ${matches.length} creators mentioning your brand, but all ${contacted.size} have already been contacted.`,
        };
      }

      // 3. Load creator profiles
      const warmIds = warmMatches
        .slice(0, Math.min(params.limit ?? 15, 25))
        .map((m) => m.creator_id as string);

      const { data: creatorsRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, display_name, followers, tier, cpi, avg_engagement_rate, primary_niche, city, country"
        )
        .in("creator_id", warmIds)
        .order("cpi", { ascending: false });
      const creators = (creatorsRaw || []) as Record<string, unknown>[];

      const matchMap = new Map(
        warmMatches.map((m) => [m.creator_id, m])
      );

      const results = creators.map((c) => {
        const match = matchMap.get(c.creator_id) as Record<string, unknown> | undefined;
        return {
          id: c.creator_id,
          handle: c.handle,
          display_name: c.display_name,
          followers: c.followers,
          tier: c.tier,
          cpi_score: c.cpi,
          engagement_rate: c.avg_engagement_rate,
          niche: c.primary_niche,
          city: c.city,
          match_score: match?.match_score ?? null,
          match_reasoning: match?.match_reasoning ?? null,
          is_warm_lead: true,
          why_warm: "Creator organically mentions your brand in their content",
        };
      });

      return {
        results,
        count: results.length,
        total_mentioners: matches.length,
        already_contacted: contacted.size,
        un_contacted: warmMatches.length,
      };
    },
  });
}
