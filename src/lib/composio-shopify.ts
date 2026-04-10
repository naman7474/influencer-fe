/* ------------------------------------------------------------------ */
/*  Shopify Admin API — Client Credentials Grant                       */
/*  Each brand stores client_id + client_secret; tokens are exchanged  */
/*  server-side and auto-refreshed every 24 h.                         */
/*  Uses Shopify Admin REST API 2024-01.                               */
/* ------------------------------------------------------------------ */

import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_VERSION = "2024-01";

/** Token buffer: refresh 1 hour before actual expiry (24h) */
const TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Connection helpers                                                  */
/* ------------------------------------------------------------------ */

interface ShopifyCredentials {
  storeUrl: string; // e.g. "https://my-store.myshopify.com"
  accessToken: string;
}

/* ------------------------------------------------------------------ */
/*  Client-credentials token exchange                                  */
/* ------------------------------------------------------------------ */

/**
 * Exchange client_id + client_secret for a short-lived access token
 * using Shopify's client_credentials grant (no redirect needed).
 */
export async function exchangeShopifyCredentials(
  storeUrl: string,
  clientId: string,
  clientSecret: string
): Promise<{ success: true; accessToken: string } | { success: false; error: string }> {
  try {
    const res = await fetch(`${storeUrl}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `Shopify returned ${res.status}. ${text || "Check your Client ID and Client Secret."}`,
      };
    }

    const data = await res.json();
    if (!data.access_token) {
      return { success: false, error: "No access token in Shopify response." };
    }

    return { success: true, accessToken: data.access_token };
  } catch {
    return {
      success: false,
      error: "Could not reach Shopify. Check that the store URL is correct.",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Credential persistence                                             */
/* ------------------------------------------------------------------ */

/**
 * Save Shopify client credentials + the first access token after
 * a successful connect.
 */
export async function saveShopifyOAuthCredentials(
  brandId: string,
  storeUrl: string,
  clientId: string,
  clientSecret: string,
  accessToken: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase
    .from("brands")
    .update({
      shopify_store_url: storeUrl,
      shopify_client_id: clientId,
      shopify_client_secret: clientSecret,
      shopify_admin_access_token: accessToken,
      shopify_connected: true,
      shopify_connected_at: new Date().toISOString(),
    } as never)
    .eq("id", brandId);
}

/* ------------------------------------------------------------------ */
/*  Get credentials (with auto-refresh)                                */
/* ------------------------------------------------------------------ */

/**
 * Resolve brand_id → Shopify store URL + valid access token.
 * If the token is older than ~23 hours, automatically refreshes it
 * using the stored client_id / client_secret.
 */
export async function getShopifyCredentials(
  brandId: string
): Promise<ShopifyCredentials> {
  const supabase = await createServerSupabaseClient();
  const { data: brandRow } = await supabase
    .from("brands")
    .select(
      "shopify_store_url, shopify_admin_access_token, shopify_client_id, shopify_client_secret, shopify_connected_at"
    )
    .eq("id", brandId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brand = brandRow as any;
  if (!brand?.shopify_store_url || !brand?.shopify_connected_at) {
    throw new Error(
      "Shopify not connected. Please connect Shopify in Settings."
    );
  }

  // Check if the token needs a refresh (older than ~23 hours)
  const tokenAge = Date.now() - new Date(brand.shopify_connected_at).getTime();
  const needsRefresh =
    !brand.shopify_admin_access_token ||
    (brand.shopify_client_id &&
      brand.shopify_client_secret &&
      tokenAge > 24 * 60 * 60 * 1000 - TOKEN_REFRESH_BUFFER_MS);

  if (needsRefresh && brand.shopify_client_id && brand.shopify_client_secret) {
    const result = await exchangeShopifyCredentials(
      brand.shopify_store_url,
      brand.shopify_client_id,
      brand.shopify_client_secret
    );

    if (result.success) {
      // Persist the new token
      await supabase
        .from("brands")
        .update({
          shopify_admin_access_token: result.accessToken,
          shopify_connected_at: new Date().toISOString(),
        } as never)
        .eq("id", brandId);

      return {
        storeUrl: brand.shopify_store_url,
        accessToken: result.accessToken,
      };
    }

    // If refresh failed but we have an existing token, try it anyway
    if (brand.shopify_admin_access_token) {
      return {
        storeUrl: brand.shopify_store_url,
        accessToken: brand.shopify_admin_access_token,
      };
    }

    throw new Error("Shopify token expired and refresh failed. Please reconnect in Settings.");
  }

  if (!brand.shopify_admin_access_token) {
    throw new Error(
      "Shopify not connected. Please connect Shopify in Settings."
    );
  }

  return {
    storeUrl: brand.shopify_store_url,
    accessToken: brand.shopify_admin_access_token,
  };
}

/* ------------------------------------------------------------------ */
/*  Generic REST caller                                                */
/* ------------------------------------------------------------------ */

async function shopifyFetch(
  creds: ShopifyCredentials,
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = `${creds.storeUrl}/admin/api/${API_VERSION}${endpoint}`;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "X-Shopify-Access-Token": creds.accessToken,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text}`);
  }

  // DELETE responses may have no body
  if (res.status === 204) return {};
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Discount Code Operations                                           */
/* ------------------------------------------------------------------ */

interface DiscountCodeResult {
  code: string;
  shopifyDiscountId: string;
}

export function generateCodeName(
  handle: string,
  percent: number,
  suffix?: string
): string {
  const clean = handle.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const base = `${clean}${percent}`;
  return suffix ? `${base}_${suffix}` : base;
}

export async function createDiscountCode(
  brandId: string,
  campaign: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
  },
  creator: { handle: string },
  discountPercent: number,
  retryCount = 0
): Promise<DiscountCodeResult> {
  const suffix =
    retryCount > 0
      ? String(Math.floor(Math.random() * 90) + 10)
      : undefined;
  const code = generateCodeName(creator.handle, discountPercent, suffix);
  const creds = await getShopifyCredentials(brandId);

  try {
    // Step 1: Create a price rule
    const priceRuleBody = {
      price_rule: {
        title: `${campaign.name} — @${creator.handle}${suffix ? ` (${suffix})` : ""}`,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "percentage",
        value: `-${discountPercent}`,
        customer_selection: "all",
        starts_at: campaign.start_date
          ? new Date(campaign.start_date).toISOString()
          : new Date().toISOString(),
        ends_at: campaign.end_date
          ? new Date(campaign.end_date).toISOString()
          : undefined,
      },
    };

    const priceRuleRes = await shopifyFetch(creds, "/price_rules.json", {
      method: "POST",
      body: priceRuleBody,
    });

    const priceRuleId = priceRuleRes.price_rule?.id;
    if (!priceRuleId) {
      throw new Error("Failed to create price rule");
    }

    // Step 2: Create a discount code under that price rule
    const codeRes = await shopifyFetch(
      creds,
      `/price_rules/${priceRuleId}/discount_codes.json`,
      {
        method: "POST",
        body: { discount_code: { code } },
      }
    );

    return {
      code,
      shopifyDiscountId: String(
        codeRes.discount_code?.id || priceRuleId
      ),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("already exists") && retryCount < 3) {
      return createDiscountCode(
        brandId,
        campaign,
        creator,
        discountPercent,
        retryCount + 1
      );
    }
    throw new Error(`Failed to create discount code: ${message}`);
  }
}

export async function deactivateDiscountCode(
  brandId: string,
  shopifyDiscountId: string
): Promise<void> {
  const creds = await getShopifyCredentials(brandId);
  try {
    await shopifyFetch(
      creds,
      `/price_rules/${shopifyDiscountId}.json`,
      { method: "DELETE" }
    );
  } catch {
    // Ignore — may already be deleted
  }
}

/* ------------------------------------------------------------------ */
/*  Draft Order Operations (Gifting)                                   */
/* ------------------------------------------------------------------ */

interface DraftOrderResult {
  draftOrderId: string;
}

export async function createDraftOrder(
  brandId: string,
  params: {
    lineItems: Array<{
      variantId: string;
      quantity: number;
      appliedDiscount?: {
        value: string;
        valueType: string;
        title: string;
        description: string;
      };
    }>;
    shippingAddress: {
      firstName: string;
      lastName: string;
      address1: string;
      city: string;
      province: string;
      zip: string;
      country: string;
      phone?: string;
    };
    note?: string;
    tags?: string;
  }
): Promise<DraftOrderResult> {
  const creds = await getShopifyCredentials(brandId);

  const body = {
    draft_order: {
      line_items: params.lineItems.map((li) => ({
        variant_id: li.variantId,
        quantity: li.quantity,
        applied_discount: li.appliedDiscount
          ? {
              value: li.appliedDiscount.value,
              value_type: li.appliedDiscount.valueType,
              title: li.appliedDiscount.title,
              description: li.appliedDiscount.description,
            }
          : undefined,
      })),
      shipping_address: {
        first_name: params.shippingAddress.firstName,
        last_name: params.shippingAddress.lastName,
        address1: params.shippingAddress.address1,
        city: params.shippingAddress.city,
        province: params.shippingAddress.province,
        zip: params.shippingAddress.zip,
        country: params.shippingAddress.country,
        phone: params.shippingAddress.phone,
      },
      note: params.note,
      tags: params.tags,
      use_customer_default_address: false,
    },
  };

  const res = await shopifyFetch(creds, "/draft_orders.json", {
    method: "POST",
    body,
  });

  return {
    draftOrderId: String(res.draft_order?.id || ""),
  };
}

/* ------------------------------------------------------------------ */
/*  Product Catalog Operations                                         */
/* ------------------------------------------------------------------ */

export interface ShopifyProduct {
  id: string;
  title: string;
  body_html?: string;
  product_type?: string;
  status?: string;
  images?: Array<{ src: string }>;
  variants?: Array<{
    id: string;
    title: string;
    price: string;
    sku?: string;
    inventory_quantity?: number;
  }>;
}

export async function getProducts(
  brandId: string,
  limit = 250
): Promise<ShopifyProduct[]> {
  const creds = await getShopifyCredentials(brandId);
  const res = await shopifyFetch(
    creds,
    `/products.json?limit=${limit}&status=active`
  );
  return res.products || [];
}

/* ------------------------------------------------------------------ */
/*  Order Operations (for reconciliation)                              */
/* ------------------------------------------------------------------ */

export interface ShopifyOrder {
  id: number;
  order_number: number;
  total_price: string;
  subtotal_price: string;
  currency: string;
  discount_codes?: Array<{ code: string; amount: string; type: string }>;
  discount_applications?: Array<{ type: string; code?: string }>;
  landing_site?: string;
  landing_site_ref?: string;
  referring_site?: string;
  shipping_address?: {
    city?: string;
    province?: string;
    country_code?: string;
  };
  customer?: { orders_count?: number };
  line_items: Array<{
    product_id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
}

export async function getOrders(
  brandId: string,
  params: {
    created_at_min?: string;
    created_at_max?: string;
    discount_code?: string;
    status?: string;
    limit?: number;
  }
): Promise<ShopifyOrder[]> {
  const creds = await getShopifyCredentials(brandId);

  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 250));
  query.set("status", params.status ?? "any");
  if (params.created_at_min) query.set("created_at_min", params.created_at_min);
  if (params.created_at_max) query.set("created_at_max", params.created_at_max);

  const res = await shopifyFetch(creds, `/orders.json?${query.toString()}`);
  return res.orders || [];
}
