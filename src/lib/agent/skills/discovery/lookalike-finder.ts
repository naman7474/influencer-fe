import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function lookalikeFinder(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to find similar creators in the database. Returns real matches based on niche, tier, and engagement. Call it when the user says find more like this, similar creators, or lookalikes.",
    inputSchema: z.object({
      creator_id: z
        .string()
        .describe("UUID of the reference creator to find lookalikes for"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Max results (1-25)"),
    }),
    execute: async (params) => {
      // 1. Load reference creator
      const { data: refRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, followers, tier, cpi, avg_engagement_rate, primary_niche, city, country"
        )
        .eq("creator_id", params.creator_id)
        .single();
      const ref = refRaw as Record<string, unknown> | null;

      if (!ref) return { error: "Reference creator not found" };

      // 2. Search for creators with similar attributes
      const { data: candidatesRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, display_name, followers, tier, cpi, avg_engagement_rate, primary_niche, city, country, is_verified"
        )
        .neq("creator_id", params.creator_id)
        .eq("primary_niche", ref.primary_niche)
        .order("cpi", { ascending: false })
        .limit(50);
      const candidates = (candidatesRaw || []) as Record<string, unknown>[];

      if (!candidates.length) {
        return {
          reference: ref,
          results: [],
          count: 0,
          message: `No similar creators found in the ${ref.primary_niche} niche. Try a different reference creator.`,
        };
      }

      // 3. Score similarity
      const refFollowers = (ref.followers as number) || 0;
      const refEr = (ref.avg_engagement_rate as number) || 0;
      const refCpi = (ref.cpi as number) || 0;

      const scored = candidates.map((c) => {
        const cFollowers = (c.followers as number) || 0;
        const cEr = (c.avg_engagement_rate as number) || 0;
        const cCpi = (c.cpi as number) || 0;

        // Follower similarity (log scale — 10K vs 12K is more similar than 100K vs 120K)
        const followerSim =
          refFollowers > 0 && cFollowers > 0
            ? 1 -
              Math.abs(Math.log10(cFollowers) - Math.log10(refFollowers)) / 3
            : 0;

        // Engagement rate similarity
        const erSim =
          refEr > 0 && cEr > 0
            ? 1 - Math.min(Math.abs(cEr - refEr) / refEr, 1)
            : 0;

        // CPI similarity
        const cpiSim =
          refCpi > 0 && cCpi > 0
            ? 1 - Math.min(Math.abs(cCpi - refCpi) / 100, 1)
            : 0;

        // Tier match bonus
        const tierBonus = c.tier === ref.tier ? 0.15 : 0;

        // Location bonus (null-safe — don't reward null === null matches)
        const locationBonus =
          c.city && ref.city && c.city === ref.city ? 0.1 :
          c.country && ref.country && c.country === ref.country ? 0.05 : 0;

        const similarity = Math.min(
          1,
          followerSim * 0.25 + erSim * 0.25 + cpiSim * 0.25 + tierBonus + locationBonus + 0.1
        );

        return { ...(c as Record<string, unknown>), similarity_score: Math.round(similarity * 100) } as Record<string, unknown>;
      });

      // 4. Sort by similarity and limit
      scored.sort(
        (a, b) =>
          (b.similarity_score as number) - (a.similarity_score as number)
      );
      const topResults = scored.slice(0, Math.min(params.limit ?? 10, 25));

      // 5. Get brand match scores
      const ids = topResults.map((c) => c.creator_id);
      const { data: matchesRaw } = await supabase
        .from("creator_brand_matches")
        .select("creator_id, match_score, match_reasoning")
        .eq("brand_id", brandId)
        .in("creator_id", ids);
      const matches = (matchesRaw || []) as Record<string, unknown>[];
      const matchMap = new Map(
        matches.map((m) => [m.creator_id, m])
      );

      const results = topResults.map((c) => {
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
          similarity_score: c.similarity_score,
          match_score: match?.match_score ?? null,
        };
      });

      return {
        reference: {
          handle: ref.handle,
          followers: ref.followers,
          tier: ref.tier,
          niche: ref.primary_niche,
          cpi: ref.cpi,
          engagement_rate: ref.avg_engagement_rate,
        },
        results,
        count: results.length,
      };
    },
  });
}
