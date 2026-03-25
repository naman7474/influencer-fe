import { NextResponse } from "next/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { buildShopifyOAuthUrl, normalizeShopifyStoreUrl } from "@/lib/shopify";
import { createClient } from "@/lib/supabase/server";

const SHOPIFY_STATE_COOKIE = "shopify_oauth_state";

function encodeStateCookie(value: Record<string, string>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shop = normalizeShopifyStoreUrl(url.searchParams.get("shop") || "");

  if (!shop) {
    return NextResponse.redirect(new URL("/onboarding?shopify=error", request.url));
  }

  try {
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);
    const state = crypto.randomUUID();
    const redirectResponse = NextResponse.redirect(
      buildShopifyOAuthUrl(shop, state)
    );

    redirectResponse.cookies.set(
      SHOPIFY_STATE_COOKIE,
      encodeStateCookie({
        brand_id: brand.brand_id,
        shop,
        state,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 10,
        path: "/",
      }
    );

    return redirectResponse;
  } catch {
    return NextResponse.redirect(new URL("/onboarding?shopify=error", request.url));
  }
}
