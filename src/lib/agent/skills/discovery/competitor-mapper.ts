import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export function competitorMapperTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "CALL THIS TOOL to find creators who work with competitor brands. Queries real data from the database. Call it when the user asks about competitors' influencers or competitor analysis.",
    inputSchema: z.object({
      competitor_name: z
        .string()
        .optional()
        .describe("Specific competitor brand name to search for. If omitted, uses all competitors from brand profile."),
      limit: z
        .number()
        .optional()
        .default(15)
        .describe("Max results (1-25)"),
    }),
    execute: async (params) => {
      // 1. Load brand's competitor list
      const { data: brandRaw } = await supabase
        .from("brands")
        .select("competitor_brands, brand_name")
        .eq("id", brandId)
        .single();
      const brand = brandRaw as Record<string, unknown> | null;

      if (!brand) return { error: "Brand not found" };

      const competitors = params.competitor_name
        ? [params.competitor_name]
        : ((brand.competitor_brands as string[]) || []);

      if (competitors.length === 0) {
        return {
          error:
            "No competitor brands configured. Update your brand profile to add competitors, or specify a competitor_name.",
        };
      }

      // 2. Search caption intelligence for brand mentions
      // Query creators whose captions mention any competitor (paid or organic)
      const { data: mentionsRaw } = await supabase
        .from("caption_intelligence")
        .select(
          "creator_id, organic_brand_mentions, paid_brand_mentions"
        )
        .order("created_at", { ascending: false });
      const mentions = (mentionsRaw || []) as Record<string, unknown>[];

      // Filter for mentions matching competitors (case-insensitive)
      const competitorLower = competitors.map((c) => c.toLowerCase());
      const creatorMentions = new Map<
        string,
        { organic: string[]; paid: string[] }
      >();

      for (const row of mentions) {
        const creatorId = row.creator_id as string;
        const organic = (row.organic_brand_mentions as string[]) || [];
        const paid = (row.paid_brand_mentions as string[]) || [];

        const matchedOrganic = organic.filter((m) =>
          competitorLower.some((c) => m.toLowerCase().includes(c))
        );
        const matchedPaid = paid.filter((m) =>
          competitorLower.some((c) => m.toLowerCase().includes(c))
        );

        if (matchedOrganic.length > 0 || matchedPaid.length > 0) {
          if (!creatorMentions.has(creatorId)) {
            creatorMentions.set(creatorId, { organic: [], paid: [] });
          }
          const existing = creatorMentions.get(creatorId)!;
          existing.organic.push(...matchedOrganic);
          existing.paid.push(...matchedPaid);
        }
      }

      if (creatorMentions.size === 0) {
        return {
          competitors,
          results: [],
          count: 0,
          message: `No creators found mentioning ${competitors.join(", ")}. This could mean they use different brand names or the data hasn't been analyzed yet.`,
        };
      }

      // 3. Load creator profiles
      const creatorIds = [...creatorMentions.keys()].slice(
        0,
        Math.min(params.limit ?? 15, 25)
      );
      const { data: creatorsRaw } = await supabase
        .from("mv_creator_leaderboard")
        .select(
          "creator_id, handle, display_name, followers, tier, cpi, avg_engagement_rate, primary_niche, city"
        )
        .in("creator_id", creatorIds)
        .order("cpi", { ascending: false });
      const creators = (creatorsRaw || []) as Record<string, unknown>[];

      // 4. Get brand match scores
      const { data: matchesRaw } = await supabase
        .from("creator_brand_matches")
        .select("creator_id, match_score, already_mentions_brand")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds);
      const matches = (matchesRaw || []) as Record<string, unknown>[];
      const matchMap = new Map(matches.map((m) => [m.creator_id, m]));

      const results = creators.map((c) => {
        const mention = creatorMentions.get(c.creator_id as string);
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
          competitor_mentions: {
            organic: mention?.organic || [],
            paid: mention?.paid || [],
          },
          already_mentions_your_brand: match?.already_mentions_brand ?? false,
          match_score: match?.match_score ?? null,
        };
      });

      return {
        competitors,
        results,
        count: results.length,
      };
    },
  });
}
