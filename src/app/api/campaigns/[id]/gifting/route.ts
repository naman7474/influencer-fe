import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createDraftOrder } from "@/lib/composio-shopify";

/**
 * GET /api/campaigns/[id]/gifting — list gifting orders for a campaign
 * POST /api/campaigns/[id]/gifting — create a new gifting draft order
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;
    if (!brand) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gifts } = await (supabase as any)
      .from("gifting_orders")
      .select(
        `
        *,
        creator:creators ( id, handle, display_name, avatar_url )
      `
      )
      .eq("campaign_id", campaignId)
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ gifts: gifts ?? [] });
  } catch (err) {
    console.error("GET gifting error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;
    if (!brand) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    const body = await request.json();
    const {
      campaignCreatorId,
      creatorId,
      productTitle,
      variantId,
      retailValue,
      shippingAddress,
      note,
    } = body;

    if (!creatorId || !productTitle) {
      return NextResponse.json(
        { error: "Creator and product are required." },
        { status: 400 }
      );
    }

    // Get creator handle for draft order note
    const { data: creatorRow } = await supabase
      .from("creators")
      .select("handle, display_name")
      .eq("id", creatorId)
      .single();

    const creator = creatorRow as {
      handle: string;
      display_name: string | null;
    } | null;

    // Get campaign name
    const { data: campaignRow } = await supabase
      .from("campaigns")
      .select("name")
      .eq("id", campaignId)
      .single();

    const campaignName =
      (campaignRow as { name: string } | null)?.name ?? "Campaign";

    let shopifyDraftOrderId: string | null = null;

    // Create draft order in Shopify if we have an address and variant
    if (shippingAddress && variantId) {
      try {
        const nameparts = (creator?.display_name ?? creator?.handle ?? "").split(" ");
        const { draftOrderId } = await createDraftOrder(brand.id, {
          lineItems: [
            {
              variantId,
              quantity: 1,
              appliedDiscount: {
                value: "100.0",
                valueType: "percentage",
                title: "Influencer Gift",
                description: `Gift for @${creator?.handle ?? "creator"}`,
              },
            },
          ],
          shippingAddress: {
            firstName: nameparts[0] || creator?.handle || "Creator",
            lastName: nameparts.slice(1).join(" ") || "",
            address1: shippingAddress.address,
            city: shippingAddress.city,
            province: shippingAddress.state,
            zip: shippingAddress.pin,
            country: shippingAddress.country || "IN",
            phone: shippingAddress.phone,
          },
          note: `Influencer gift — Campaign: ${campaignName} — Creator: @${creator?.handle ?? "unknown"}`,
          tags: "influencer-gift",
        });
        shopifyDraftOrderId = draftOrderId;
      } catch (shopifyErr) {
        console.error("Shopify draft order creation failed:", shopifyErr);
        // Continue — we'll store the gift order locally even if Shopify fails
      }
    }

    const status = shippingAddress
      ? shopifyDraftOrderId
        ? "draft_created"
        : "address_received"
      : "address_requested";

    // Store in our DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gift, error: insertError } = await (supabase as any)
      .from("gifting_orders")
      .insert({
        brand_id: brand.id,
        campaign_id: campaignId,
        campaign_creator_id: campaignCreatorId || null,
        creator_id: creatorId,
        shopify_draft_order_id: shopifyDraftOrderId,
        product_title: productTitle,
        variant_id: variantId || null,
        retail_value: retailValue || 0,
        status,
        shipping_address: shippingAddress || null,
        note: note || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert gifting order error:", insertError);
      return NextResponse.json(
        { error: "Failed to create gift order." },
        { status: 500 }
      );
    }

    // Send notification
    await supabase.from("notifications").insert({
      brand_id: brand.id,
      type: "gifting",
      title: `Gift created for @${creator?.handle ?? "creator"}`,
      body: `${productTitle} gift order ${status === "draft_created" ? "created in Shopify" : "recorded"} for @${creator?.handle ?? "creator"}.`,
      priority: "low",
      campaign_id: campaignId,
      creator_id: creatorId,
    } as never);

    return NextResponse.json({ success: true, gift });
  } catch (err) {
    console.error("POST gifting error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
