import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function audienceOverlapCheckTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to check audience overlap between creators using real data. Never estimate overlap percentages. Call it when the user asks about audience overlap, shared followers, or deduplication.",
    inputSchema: z.object({
      creator_ids: z
        .array(z.string())
        .min(2)
        .max(10)
        .describe("Array of creator UUIDs to check overlap between (2-10)"),
    }),
    execute: async (params) => {
      const { creator_ids } = params;

      // 1. Load creator profiles for context
      const { data: creatorsRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select("creator_id, handle, followers, tier, primary_niche")
        .in("creator_id", creator_ids);
      const creators = (creatorsRaw || []) as Record<string, unknown>[];

      if (creators.length < 2) {
        return {
          error: `Only found ${creators.length} of ${creator_ids.length} creators. Check the IDs and try again.`,
        };
      }

      const creatorMap = new Map(
        creators.map((c) => [c.creator_id as string, c])
      );

      // 2. Query all pairwise overlaps
      const { data: overlapsRaw } = await supabase
        .from("audience_overlaps")
        .select("*")
        .or(
          creator_ids
            .map(
              (id) =>
                `and(creator_a_id.eq.${id},creator_b_id.in.(${creator_ids.join(",")})),and(creator_b_id.eq.${id},creator_a_id.in.(${creator_ids.join(",")}))`
            )
            .join(",")
        );
      const overlaps = (overlapsRaw || []) as Record<string, unknown>[];

      // 3. Build pair results
      const pairResults: Record<string, unknown>[] = [];
      const seen = new Set<string>();

      for (const overlap of overlaps) {
        const aId = overlap.creator_a_id as string;
        const bId = overlap.creator_b_id as string;
        const pairKey = [aId, bId].sort().join("-");

        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        if (!creator_ids.includes(aId) || !creator_ids.includes(bId)) continue;

        const creatorA = creatorMap.get(aId);
        const creatorB = creatorMap.get(bId);

        pairResults.push({
          creator_a: creatorA?.handle ?? aId,
          creator_b: creatorB?.handle ?? bId,
          shared_commenters: overlap.shared_commenters,
          jaccard_similarity: overlap.jaccard_similarity,
          overlap_coefficient: overlap.overlap_coefficient,
          overlap_level: overlap.overlap_level,
        });
      }

      // 4. Check for missing pairs (no overlap data)
      for (let i = 0; i < creator_ids.length; i++) {
        for (let j = i + 1; j < creator_ids.length; j++) {
          const pairKey = [creator_ids[i], creator_ids[j]].sort().join("-");
          if (!seen.has(pairKey)) {
            const creatorA = creatorMap.get(creator_ids[i]);
            const creatorB = creatorMap.get(creator_ids[j]);
            pairResults.push({
              creator_a: creatorA?.handle ?? creator_ids[i],
              creator_b: creatorB?.handle ?? creator_ids[j],
              shared_commenters: null,
              jaccard_similarity: null,
              overlap_level: "unknown",
              note: "No overlap data available for this pair",
            });
          }
        }
      }

      // Sort by overlap descending
      pairResults.sort(
        (a, b) =>
          ((b.jaccard_similarity as number) || 0) -
          ((a.jaccard_similarity as number) || 0)
      );

      return {
        creators: creators.map((c) => ({
          id: c.creator_id,
          handle: c.handle,
          followers: c.followers,
          tier: c.tier,
          niche: c.primary_niche,
        })),
        overlaps: pairResults,
        pairs_analyzed: pairResults.length,
        high_overlap_pairs: pairResults.filter(
          (p) => ((p.jaccard_similarity as number) || 0) > 0.15
        ).length,
      };
    },
  });
}
