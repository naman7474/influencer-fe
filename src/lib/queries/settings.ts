import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSettingsOverview(
  supabase: SupabaseClient,
  brandId: string
) {
  const [brandRes, templatesRes] = await Promise.all([
    supabase
      .from("brands")
      .select(
        "brand_name, website, industry, default_campaign_goal, shopify_store_url, shopify_connected, shopify_connected_at, shopify_last_sync_at, shopify_admin_access_token, shopify_sync_status, shopify_sync_error, instagram_connected, instagram_connected_at"
      )
      .eq("id", brandId)
      .single(),
    supabase
      .from("outreach_templates")
      .select("*")
      .eq("brand_id", brandId)
      .order("updated_at", { ascending: false }),
  ]);

  if (brandRes.error) throw brandRes.error;
  if (templatesRes.error) throw templatesRes.error;

  return {
    brand: brandRes.data,
    templates: templatesRes.data ?? [],
    has_admin_token: Boolean(brandRes.data.shopify_admin_access_token),
  };
}
