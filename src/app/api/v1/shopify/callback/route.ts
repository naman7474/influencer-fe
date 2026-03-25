import { NextResponse } from "next/server";
import { triggerShopifySyncJob } from "@/lib/jobs";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  exchangeShopifyAccessToken,
  normalizeShopifyStoreUrl,
} from "@/lib/shopify";

const SHOPIFY_STATE_COOKIE = "shopify_oauth_state";
export const runtime = "nodejs";

function decodeStateCookie(
  value: string | undefined
): { brand_id: string; shop: string; state: string } | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = normalizeShopifyStoreUrl(url.searchParams.get("shop") || "");
  const state = url.searchParams.get("state");
  const cookieValue = request.headers
    .get("cookie")
    ?.split("; ")
    .find((cookie) => cookie.startsWith(`${SHOPIFY_STATE_COOKIE}=`))
    ?.split("=")[1];
  const statePayload = decodeStateCookie(cookieValue);
  const redirectUrl = new URL("/onboarding", request.url);

  if (!code || !shop || !statePayload || statePayload.shop !== shop || statePayload.state !== state) {
    redirectUrl.searchParams.set("shopify", "error");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const accessToken = await exchangeShopifyAccessToken(shop, code);
    const serviceRoleClient = createServiceRoleClient();

    const { error } = await serviceRoleClient
      .from("brands")
      .update({
        shopify_store_url: shop,
        shopify_access_token: accessToken,
        shopify_connected: true,
        shopify_connected_at: new Date().toISOString(),
        shopify_sync_status: "queued",
        shopify_sync_error: null,
        shopify_sync_started_at: null,
        shopify_sync_completed_at: null,
        onboarding_step: 2,
      })
      .eq("id", statePayload.brand_id);

    if (error) {
      throw error;
    }

    await triggerShopifySyncJob(statePayload.brand_id);

    redirectUrl.searchParams.set("shopify", "connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(SHOPIFY_STATE_COOKIE);
    return response;
  } catch {
    redirectUrl.searchParams.set("shopify", "error");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(SHOPIFY_STATE_COOKIE);
    return response;
  }
}
