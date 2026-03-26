import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCampaignAttribution(
  supabase: SupabaseClient,
  brandId: string,
  campaignId: string
) {
  const [utmRes, ordersRes] = await Promise.all([
    supabase
      .from("campaign_utm_links")
      .select(
        "*, creator:creators(id, handle, display_name, avatar_url), campaign_creator:campaign_creators(id, agreed_rate)"
      )
      .eq("brand_id", brandId)
      .eq("campaign_id", campaignId)
      .order("revenue_attributed", { ascending: false }),
    supabase
      .from("attributed_orders")
      .select("*")
      .eq("brand_id", brandId)
      .eq("campaign_id", campaignId)
      .order("ordered_at", { ascending: false })
      .limit(50),
  ]);

  if (utmRes.error) {
    throw utmRes.error;
  }

  if (ordersRes.error) {
    throw ordersRes.error;
  }

  const links = utmRes.data ?? [];
  const totals = links.reduce(
    (acc, link) => {
      acc.clicks += Number(link.clicks ?? 0);
      acc.orders += Number(link.orders_attributed ?? 0);
      acc.revenue += Number(link.revenue_attributed ?? 0);
      return acc;
    },
    { clicks: 0, orders: 0, revenue: 0 }
  );

  return {
    summary: totals,
    links,
    orders: ordersRes.data ?? [],
  };
}

export async function getCreatorAttribution(
  supabase: SupabaseClient,
  brandId: string,
  campaignId: string,
  creatorId: string
) {
  const { data, error } = await supabase
    .from("campaign_utm_links")
    .select("*")
    .eq("brand_id", brandId)
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
