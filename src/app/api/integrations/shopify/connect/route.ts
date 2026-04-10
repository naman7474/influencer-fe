import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeShopifyCredentials, saveShopifyOAuthCredentials } from "@/lib/composio-shopify";

/**
 * POST /api/integrations/shopify/connect
 *
 * Accepts { store_url, client_id, client_secret } from the brand.
 * Uses the Shopify client_credentials grant to exchange them for an
 * access token (no redirect needed), validates, and saves everything.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const storeUrl = body.store_url?.trim();
    const clientId = body.client_id?.trim();
    const clientSecret = body.client_secret?.trim();

    if (!storeUrl || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Store URL, Client ID, and Client Secret are all required." },
        { status: 400 }
      );
    }

    // Normalize store URL to https://<subdomain>.myshopify.com
    let shop = storeUrl;
    shop = shop.replace(/^https?:\/\//, "");
    shop = shop.replace(/\/.*$/, "");
    if (!shop.endsWith(".myshopify.com")) {
      shop = `${shop}.myshopify.com`;
    }
    const normalizedUrl = `https://${shop}`;

    // Fetch the brand for this user
    const { data: brandRow, error: brandError } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;

    if (brandError || !brand) {
      return NextResponse.json(
        { error: "Brand profile not found." },
        { status: 404 }
      );
    }

    // Exchange client credentials for an access token (no redirect)
    const tokenResult = await exchangeShopifyCredentials(normalizedUrl, clientId, clientSecret);

    if (!tokenResult.success) {
      return NextResponse.json(
        { error: tokenResult.error },
        { status: 400 }
      );
    }

    // Verify the token actually works by calling the shop endpoint
    try {
      const testRes = await fetch(
        `${normalizedUrl}/admin/api/2024-01/shop.json`,
        {
          headers: {
            "X-Shopify-Access-Token": tokenResult.accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (!testRes.ok) {
        return NextResponse.json(
          {
            error: `Token obtained but Shopify returned ${testRes.status} when verifying. Check your app's API scopes.`,
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Could not verify the connection with Shopify." },
        { status: 400 }
      );
    }

    // Save everything: client_id, client_secret (for token refresh), and the access token
    await saveShopifyOAuthCredentials(
      brand.id,
      normalizedUrl,
      clientId,
      clientSecret,
      tokenResult.accessToken
    );

    return NextResponse.json({
      success: true,
      message: "Shopify connected successfully.",
      brand_id: brand.id,
      store_url: normalizedUrl,
    });
  } catch (err) {
    console.error("Shopify connect error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
