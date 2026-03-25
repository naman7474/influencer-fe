import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSettingsOverview(
  supabase: SupabaseClient,
  brandId: string
) {
  const [brandRes, productsRes] = await Promise.all([
    supabase
      .from("brands")
      .select(
        "brand_name, website, industry, default_campaign_goal, shopify_store_url, shopify_connected, shopify_connected_at, shopify_last_sync_at, shopify_admin_access_token, shopify_sync_status, shopify_sync_error"
      )
      .eq("id", brandId)
      .single(),
    supabase
      .from("brand_products")
      .select("id, title, product_type, image_url, min_price, max_price")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  if (brandRes.error) throw brandRes.error;
  if (productsRes.error) throw productsRes.error;

  return {
    brand: brandRes.data,
    products: productsRes.data ?? [],
    has_admin_token: Boolean(brandRes.data.shopify_admin_access_token),
  };
}
