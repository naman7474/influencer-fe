import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate monthly relationship health summaries for each brand.
 */
export async function generateRelationshipHealth(
  supabase: SupabaseClient
) {
  const { data: brandsRaw } = await supabase
    .from("brands")
    .select("id, brand_name");
  const brands = (brandsRaw || []) as Record<string, unknown>[];

  const results: { brandId: string; totalCreators: number; atRisk: number }[] =
    [];

  for (const brand of brands) {
    const brandId = brand.id as string;

    const { data: relsRaw } = await supabase
      .from("mv_creator_relationship_summary")
      .select("creator_id, total_campaigns, lifetime_roi, last_campaign_completed, reply_count")
      .eq("brand_id", brandId)
      .gte("total_campaigns", 1);
    const rels = (relsRaw || []) as Record<string, unknown>[];

    if (rels.length === 0) continue;

    // Count at-risk relationships
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 120);
    const atRisk = rels.filter((r) => {
      const last = r.last_campaign_completed as string | null;
      const roi = (r.lifetime_roi as number) || 0;
      return (last && last < cutoff.toISOString()) || roi < 1;
    });

    if (atRisk.length > 0) {
      await supabase.from("notifications").insert({
        brand_id: brandId,
        type: "agent_insight",
        title: `Monthly relationship health: ${atRisk.length} at-risk`,
        body: `Of your ${rels.length} creator relationships, ${atRisk.length} are at risk (inactive or low ROI). Ask the agent for details.`,
        link: "/dashboard",
      } as never);
    }

    results.push({
      brandId,
      totalCreators: rels.length,
      atRisk: atRisk.length,
    });
  }

  return results;
}

/**
 * Generate monthly performance trend notifications.
 */
export async function generatePerformanceTrends(
  supabase: SupabaseClient
) {
  const { data: brandsRaw } = await supabase
    .from("brands")
    .select("id");
  const brands = (brandsRaw || []) as Record<string, unknown>[];

  const results: { brandId: string; activeCampaigns: number }[] = [];

  for (const brand of brands) {
    const brandId = brand.id as string;

    // Get active campaigns with performance
    const { data: campaignsRaw } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("brand_id", brandId)
      .eq("status", "active");
    const campaigns = (campaignsRaw || []) as Record<string, unknown>[];

    if (campaigns.length === 0) continue;

    for (const campaign of campaigns) {
      const { data: perfRaw } = await supabase
        .from("campaign_performance_summary")
        .select("total_revenue, total_orders, creator_cost")
        .eq("campaign_id", campaign.id);
      const perf = (perfRaw || []) as Record<string, unknown>[];

      const totalRevenue = perf.reduce(
        (sum, p) => sum + ((p.total_revenue as number) || 0),
        0
      );
      const totalOrders = perf.reduce(
        (sum, p) => sum + ((p.total_orders as number) || 0),
        0
      );

      if (totalOrders > 0) {
        await supabase.from("notifications").insert({
          brand_id: brandId,
          type: "agent_insight",
          title: `Campaign "${campaign.name}" update`,
          body: `${totalOrders} orders totaling ₹${totalRevenue.toLocaleString("en-IN")} this month. Ask the agent for a full report.`,
          link: `/campaigns/${campaign.id}`,
        } as never);
      }
    }

    results.push({ brandId, activeCampaigns: campaigns.length });
  }

  return results;
}
