import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getShopifyCredentials } from "@/lib/composio-shopify";
import { syncBrandGeo, type SyncMode } from "@/lib/shopify/geo-sync";

/**
 * POST /api/integrations/shopify/sync-geo
 *
 * Body: { brand_id?: string, mode: "initial" | "incremental" | "manual", window_days?: number }
 *
 * Two auth paths:
 *  1. User session — resolves brand_id from the logged-in brand.
 *  2. Worker secret (x-worker-secret header) — trusted callers pass brand_id directly.
 *
 * On completion, fires a downstream POST to /api/matching/compute so match
 * scores reflect the refreshed geo zones.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      brand_id?: string;
      mode?: SyncMode;
      window_days?: number;
    };
    const mode: SyncMode = body.mode ?? "manual";
    if (!["initial", "incremental", "manual"].includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode: ${mode}` },
        { status: 400 }
      );
    }

    let brandId: string | null = null;

    // Worker-secret auth (trusted callers)
    const workerSecret = request.headers.get("x-worker-secret");
    const configuredSecret = process.env.MATCHING_COMPUTE_SECRET;
    if (
      workerSecret &&
      configuredSecret &&
      workerSecret === configuredSecret
    ) {
      brandId = body.brand_id ?? null;
      if (!brandId) {
        return NextResponse.json(
          { error: "brand_id required when using worker secret auth" },
          { status: 400 }
        );
      }
    }

    // User session fallback
    if (!brandId) {
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
      brandId = brand.id;
    }

    // Resolve Shopify credentials (with auto-refresh)
    let storeUrl: string;
    let accessToken: string;
    try {
      const creds = await getShopifyCredentials(brandId);
      storeUrl = creds.storeUrl;
      accessToken = creds.accessToken;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: msg, brand_id: brandId },
        { status: 400 }
      );
    }

    // Service-role client for the actual sync (bypasses RLS on upsert)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Load product_categories for category_relevance scoring
    const { data: brandCats } = await serviceSupabase
      .from("brands")
      .select("product_categories")
      .eq("id", brandId)
      .single();
    const productCategories =
      ((brandCats as { product_categories?: string[] } | null)
        ?.product_categories ?? []) as string[];

    const result = await syncBrandGeo(serviceSupabase, {
      brandId,
      storeUrl,
      accessToken,
      productCategories,
      mode,
      windowDays: body.window_days,
    });

    // Fire-and-forget downstream recompute. We intentionally do not
    // await the fetch so the sync response returns promptly.
    if (configuredSecret) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        new URL(request.url).origin;
      fetch(`${baseUrl}/api/matching/compute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": configuredSecret,
        },
        body: JSON.stringify({ brand_id: brandId }),
      }).catch((err) => {
        console.error("Downstream matching/compute failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      brand_id: brandId,
      mode,
      ...result,
    });
  } catch (err) {
    console.error("Shopify sync-geo error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
