import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrders } from "@/lib/composio-shopify";

/**
 * POST /api/reconcile-orders
 * Manual trigger for order reconciliation.
 * Compares attributed orders against Shopify to find missed ones.
 */
export async function POST(_request: NextRequest) {
  try {
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
      .select("id, shopify_connected")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as {
      id: string;
      shopify_connected: boolean;
    } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    if (!brand.shopify_connected) {
      return NextResponse.json(
        { error: "Shopify not connected." },
        { status: 400 }
      );
    }

    // Get all active/completed campaigns
    const { data: campaignRows } = await supabase
      .from("campaigns")
      .select("id, start_date, end_date")
      .eq("brand_id", brand.id)
      .in("status", ["active", "completed"]);

    const campaigns = (campaignRows ?? []) as { id: string; start_date: string | null; end_date: string | null }[];
    if (!campaigns.length) {
      return NextResponse.json({
        success: true,
        message: "No active campaigns to reconcile.",
        found: 0,
      });
    }

    let totalFound = 0;

    for (const campaign of campaigns) {
      // Get discount codes for this campaign
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: codes } = await (supabase as any)
        .from("campaign_discount_codes")
        .select("code")
        .eq("campaign_id", campaign.id)
        .eq("is_active", true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(codes as any[])?.length) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const { code } of codes as any[]) {
        try {
          const orders = await getOrders(brand.id, {
            created_at_min: campaign.start_date ?? undefined,
            created_at_max:
              campaign.end_date ?? new Date().toISOString(),
            discount_code: code,
            status: "any",
          });

          for (const order of orders) {
            // Check if we already have this order
            const { data: existing } = await supabase
              .from("attributed_orders")
              .select("id")
              .eq("shopify_order_id", order.id.toString())
              .limit(1);

            if (!existing?.length) {
              totalFound++;
              // We could process the missed order here, but for safety
              // we just log it. Full processing would require the webhook handler.
              console.log(
                `Reconciliation: found missed order ${order.id} for code ${code}`
              );
            }
          }
        } catch (err) {
          console.error(
            `Reconciliation error for code ${code}:`,
            err
          );
        }
      }
    }

    // Notification if missed orders found
    if (totalFound > 0) {
      await supabase.from("notifications").insert({
        brand_id: brand.id,
        type: "reconciliation",
        title: `Found ${totalFound} missed order${totalFound !== 1 ? "s" : ""} during reconciliation`,
        body: `Reconciliation found ${totalFound} order${totalFound !== 1 ? "s" : ""} that were not captured by webhooks. Review them in your campaigns.`,
        priority: "medium",
      } as never);
    }

    return NextResponse.json({
      success: true,
      found: totalFound,
      message:
        totalFound > 0
          ? `Found ${totalFound} missed orders.`
          : "All orders accounted for.",
    });
  } catch (err) {
    console.error("POST reconcile-orders error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
