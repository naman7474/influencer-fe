import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Scan for new matching creators that the brand hasn't seen yet.
 * Creates notifications for brands with new high-match creators.
 */
export async function scanNewMatchingCreators(supabase: SupabaseClient) {
  // Get all active brands
  const { data: brandsRaw } = await supabase
    .from("brands")
    .select("id, brand_name");
  const brands = (brandsRaw || []) as Record<string, unknown>[];

  const results: { brandId: string; newMatches: number }[] = [];

  for (const brand of brands) {
    const brandId = brand.id as string;

    // Find high-match creators added in the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: matchesRaw } = await supabase
      .from("creator_brand_matches")
      .select("creator_id, match_score")
      .eq("brand_id", brandId)
      .gte("match_score", 70)
      .gte("created_at", weekAgo.toISOString())
      .order("match_score", { ascending: false })
      .limit(10);
    const matches = (matchesRaw || []) as Record<string, unknown>[];

    if (matches.length > 0) {
      await supabase.from("notifications").insert({
        brand_id: brandId,
        type: "agent_insight",
        title: `${matches.length} new high-match creators found`,
        body: `We found ${matches.length} new creators with 70%+ match scores this week. Ask the agent about them!`,
        link: "/dashboard",
      } as never);

      results.push({ brandId, newMatches: matches.length });
    }
  }

  return results;
}

/**
 * Find high-performing past creators who can be re-engaged.
 */
export async function scanReengagementOpportunities(
  supabase: SupabaseClient
) {
  const { data: brandsRaw } = await supabase
    .from("brands")
    .select("id");
  const brands = (brandsRaw || []) as Record<string, unknown>[];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const results: { brandId: string; opportunities: number }[] = [];

  for (const brand of brands) {
    const brandId = brand.id as string;

    const { data: relsRaw } = await supabase
      .from("mv_creator_relationship_summary")
      .select("creator_id, lifetime_roi, last_campaign_completed")
      .eq("brand_id", brandId)
      .gte("lifetime_roi", 2)
      .lte("last_campaign_completed", cutoffDate.toISOString());
    const rels = (relsRaw || []) as Record<string, unknown>[];

    if (rels.length > 0) {
      await supabase.from("notifications").insert({
        brand_id: brandId,
        type: "agent_insight",
        title: `${rels.length} creators ready for re-engagement`,
        body: `${rels.length} high-performing creators haven't worked with you in 90+ days. Consider re-engaging them.`,
        link: "/dashboard",
      } as never);

      results.push({ brandId, opportunities: rels.length });
    }
  }

  return results;
}

/**
 * Identify potential brand ambassadors.
 */
export async function scanAmbassadorCandidates(
  supabase: SupabaseClient
) {
  const { data: brandsRaw } = await supabase
    .from("brands")
    .select("id");
  const brands = (brandsRaw || []) as Record<string, unknown>[];

  const results: { brandId: string; candidates: number }[] = [];

  for (const brand of brands) {
    const brandId = brand.id as string;

    const { data: relsRaw } = await supabase
      .from("mv_creator_relationship_summary")
      .select("creator_id")
      .eq("brand_id", brandId)
      .gte("total_campaigns", 3)
      .gte("lifetime_roi", 3);
    const rels = (relsRaw || []) as Record<string, unknown>[];

    if (rels.length > 0) {
      await supabase.from("notifications").insert({
        brand_id: brandId,
        type: "agent_insight",
        title: `${rels.length} ambassador candidates identified`,
        body: `${rels.length} creators have 3+ campaigns and 3x+ ROI. They could be great ambassadors.`,
        link: "/dashboard",
      } as never);

      results.push({ brandId, candidates: rels.length });
    }
  }

  return results;
}
