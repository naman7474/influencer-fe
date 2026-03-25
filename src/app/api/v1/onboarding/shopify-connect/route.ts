import { apiError, apiOk } from "@/lib/api";
import { triggerShopifySyncJob } from "@/lib/jobs";
import { saveShopifyConnect } from "@/lib/mutations/onboarding";
import { requireBrandContext } from "@/lib/queries/brand";
import { normalizeShopifyStoreUrl } from "@/lib/shopify";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      store_url?: string;
      admin_access_token?: string;
    };
    const storeUrl = normalizeShopifyStoreUrl(body.store_url || "");
    const adminAccessToken = body.admin_access_token?.trim() || "";

    if (!storeUrl) {
      return apiError(400, {
        code: "validation_error",
        message: "A valid .myshopify.com store URL is required.",
      });
    }

    if (!adminAccessToken) {
      return apiError(400, {
        code: "validation_error",
        message: "A Shopify admin access token is required.",
      });
    }

    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    await saveShopifyConnect(
      supabase,
      brand.brand_id,
      storeUrl,
      adminAccessToken
    );
    await triggerShopifySyncJob(brand.brand_id);

    return apiOk({
      status: "queued" as const,
      shopify_connected: true,
      sync_status: "queued" as const,
    });
  } catch (error) {
    return apiError(500, {
      code: "shopify_connect_failed",
      message:
        error instanceof Error
          ? error.message
          : "Unable to save Shopify credentials.",
    });
  }
}
