import { apiError, apiOk } from "@/lib/api";
import { triggerShopifySyncJob } from "@/lib/jobs";
import { normalizeShopifyStoreUrl } from "@/lib/shopify";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      shopify_store_url?: string | null;
      shopify_admin_access_token?: string | null;
    };
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const normalizedStoreUrl = body.shopify_store_url
      ? normalizeShopifyStoreUrl(body.shopify_store_url)
      : brand.shopify_store_url;
    const nextAdminToken = body.shopify_admin_access_token?.trim() || null;
    const hasStoredCredential =
      Boolean(nextAdminToken) || Boolean(brand.shopify_connected);

    if (body.shopify_store_url && !normalizedStoreUrl) {
      return apiError(400, {
        code: "validation_error",
        message: "A valid .myshopify.com store URL is required.",
      });
    }

    if (!normalizedStoreUrl) {
      return apiError(400, {
        code: "validation_error",
        message: "A Shopify store URL is required.",
      });
    }

    if (!nextAdminToken && !brand.shopify_store_url) {
      return apiError(400, {
        code: "validation_error",
        message: "Add a Shopify admin access token to start sync.",
      });
    }

    const { data, error } = await supabase
      .from("brands")
      .update({
        shopify_store_url: normalizedStoreUrl,
        shopify_admin_access_token: nextAdminToken || undefined,
        shopify_connected: hasStoredCredential,
        shopify_sync_status: hasStoredCredential ? "queued" : "idle",
        shopify_sync_error: null,
        shopify_sync_started_at: null,
        shopify_sync_completed_at: null,
      })
      .eq("id", brand.brand_id)
      .select(
        "shopify_store_url, shopify_connected, shopify_connected_at, shopify_last_sync_at, shopify_sync_status, shopify_sync_error"
      )
      .single();

    if (error) {
      throw error;
    }

    if (hasStoredCredential) {
      await triggerShopifySyncJob(brand.brand_id);
    }

    return apiOk({ shopify: data });
  } catch (error) {
    return apiError(500, {
      code: "shopify_settings_update_failed",
      message:
        error instanceof Error ? error.message : "Unable to update Shopify settings.",
    });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { error } = await supabase
      .from("brands")
      .update({
        shopify_store_url: null,
        shopify_access_token: null,
        shopify_admin_access_token: null,
        shopify_connected: false,
        shopify_connected_at: null,
        shopify_last_sync_at: null,
        shopify_sync_status: "idle",
        shopify_sync_error: null,
        shopify_sync_started_at: null,
        shopify_sync_completed_at: null,
      })
      .eq("id", brand.brand_id);

    if (error) {
      throw error;
    }

    return apiOk({ disconnected: true });
  } catch (error) {
    return apiError(500, {
      code: "shopify_disconnect_failed",
      message:
        error instanceof Error ? error.message : "Unable to disconnect Shopify.",
    });
  }
}
