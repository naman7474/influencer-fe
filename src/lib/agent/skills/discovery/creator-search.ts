import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function creatorSearchTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to search the database for creators/influencers. This is the ONLY way to find real creator data — never invent creator profiles. Supports text search across handle, name, bio, and language. Call it whenever the user asks to find, discover, search, or recommend creators.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Free-text search across handle, name, bio, and language. Use for name searches, language (e.g. 'tamil', 'hindi'), keywords, etc."
        ),
      niche: z
        .string()
        .optional()
        .describe(
          "Content niche. Common values in database: beauty, fashion, lifestyle, health, entertainment, education, parenting. Uses case-insensitive match."
        ),
      min_followers: z.number().optional().describe("Minimum follower count"),
      max_followers: z.number().optional().describe("Maximum follower count"),
      tier: z
        .enum(["nano", "micro", "mid", "macro", "mega"])
        .optional()
        .describe("Creator tier by size"),
      city: z.string().optional().describe("Creator city (partial match)"),
      country: z
        .string()
        .optional()
        .describe("Creator country code. Only set if user explicitly requests a specific country."),
      language: z
        .string()
        .optional()
        .describe("Primary spoken language (e.g. Tamil, Hindi, English)"),
      min_cpi: z
        .number()
        .optional()
        .describe("Minimum CPI (Creator Performance Index) score"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Max results to return (1-25)"),
    }),
    execute: async (params) => {
      const { data, error } = await supabase.rpc("fn_search_creators", {
        p_query: params.query || null,
        p_niche: params.niche || null,
        p_min_followers: params.min_followers || null,
        p_max_followers: params.max_followers || null,
        p_min_cpi: params.min_cpi || null,
        p_tier: params.tier || null,
        p_city: params.city || null,
        p_country: params.country || null,
        p_language: params.language || null,
        p_limit: Math.min(params.limit ?? 10, 25),
        p_offset: 0,
      });
      const creators = (data || []) as Record<string, unknown>[];

      if (error) {
        return {
          results: [],
          count: 0,
          error: `Search failed: ${error.message}`,
        };
      }

      if (!creators?.length) {
        return {
          results: [],
          count: 0,
          message:
            "No creators found matching these criteria. Try broadening your filters (larger follower range, different niche, or remove city filter).",
        };
      }

      // Get brand-specific match scores
      const creatorIds = creators.map((c: Record<string, unknown>) => c.id);
      const { data: matchesRaw } = await supabase
        .from("creator_brand_matches")
        .select(
          "creator_id, match_score, niche_fit_score, audience_geo_score, match_reasoning"
        )
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds);
      const matches = (matchesRaw || []) as Record<string, unknown>[];

      const matchMap = new Map(
        matches.map((m: Record<string, unknown>) => [m.creator_id, m])
      );

      const results = creators.map((c: Record<string, unknown>) => {
        const match = matchMap.get(c.id) as
          | Record<string, unknown>
          | undefined;
        return {
          id: c.id,
          handle: c.handle,
          display_name: c.display_name,
          followers: c.followers,
          tier: c.tier,
          cpi_score: c.cpi,
          engagement_rate: c.avg_engagement_rate,
          niche: c.primary_niche,
          language: c.primary_spoken_language,
          city: c.city,
          country: c.country,
          is_verified: c.is_verified,
          match_score: match?.match_score ?? null,
          match_reasoning: match?.match_reasoning ?? null,
        };
      });

      // Sort by match score (if available) then CPI
      results.sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          ((b.match_score as number) || (b.cpi_score as number) || 0) -
          ((a.match_score as number) || (a.cpi_score as number) || 0)
      );

      return {
        results,
        count: results.length,
        total_in_database:
          (creators[0] as Record<string, unknown>)?.total_count ??
          results.length,
      };
    },
  });
}
