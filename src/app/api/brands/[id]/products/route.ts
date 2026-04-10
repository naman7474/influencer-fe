import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProducts } from "@/lib/composio-shopify";

/**
 * GET /api/brands/[id]/products — list synced products
 * POST /api/brands/[id]/products — trigger product catalog sync
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: products } = await supabase
      .from("brand_products")
      .select("*")
      .eq("brand_id", brandId)
      .order("title", { ascending: true });

    return NextResponse.json({ products: products ?? [] });
  } catch (err) {
    console.error("GET products error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Sync products from Shopify via Composio
    try {
      const products = await getProducts(brandId);

      for (const product of products) {
        await supabase.from("brand_products").upsert(
          {
            brand_id: brandId,
            shopify_product_id: product.id.toString(),
            title: product.title,
            description: product.body_html ?? null,
            product_type: product.product_type ?? null,
            images: product.images?.map((i) => i.src) ?? [],
            image_url: product.images?.[0]?.src ?? null,
            variants: JSON.stringify(
              product.variants?.map((v) => ({
                id: v.id.toString(),
                title: v.title,
                price: v.price,
                sku: v.sku,
                inventory_quantity: v.inventory_quantity,
                available: (v.inventory_quantity ?? 0) > 0,
              })) ?? []
            ),
            status: product.status ?? "active",
          } as never,
          { onConflict: "brand_id,shopify_product_id" }
        );
      }

      return NextResponse.json({
        success: true,
        synced: products.length,
      });
    } catch (syncErr) {
      console.error("Product sync error:", syncErr);
      return NextResponse.json(
        {
          error:
            "Failed to sync products from Shopify. Check your Shopify connection.",
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("POST products sync error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
