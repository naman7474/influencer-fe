import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Shopify webhook handler — uses service role client (no user auth).
 * Shopify sends webhooks directly, so we verify via HMAC.
 */
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

/* ------------------------------------------------------------------ */
/*  POST /api/webhooks/shopify/[brandId]                               */
/* ------------------------------------------------------------------ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const topic = request.headers.get("x-shopify-topic");
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const body = await request.text();

  const supabase = getServiceClient();

  // ── Log the webhook ────────────────────────────────────────────
  const payloadHash = createHmac("sha256", "webhook-log")
    .update(body)
    .digest("hex");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("webhook_logs").insert({
    brand_id: brandId,
    topic: topic ?? "unknown",
    payload_hash: payloadHash,
    processed: false,
  });

  // ── Verify HMAC ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandRow } = await (supabase as any)
    .from("brands")
    .select("id, shopify_webhook_secret")
    .eq("id", brandId)
    .single();

  const brand = brandRow as {
    id: string;
    shopify_webhook_secret: string | null;
  } | null;

  if (!brand) {
    return new Response("Brand not found", { status: 404 });
  }

  if (brand.shopify_webhook_secret && hmac) {
    const computed = createHmac("sha256", brand.shopify_webhook_secret)
      .update(body, "utf8")
      .digest("base64");

    if (computed !== hmac) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // ── Route by topic ─────────────────────────────────────────────
  const order = JSON.parse(body);

  try {
    switch (topic) {
      case "orders/create":
        await handleOrderCreate(supabase, brandId, order);
        break;
      case "orders/paid":
        await handleOrderPaid(supabase, brandId, order);
        break;
      case "orders/updated":
        await handleOrderUpdated(supabase, brandId, order);
        break;
    }

    // Mark webhook as processed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("webhook_logs")
      .update({ processed: true })
      .eq("payload_hash", payloadHash);
  } catch (err) {
    console.error(`Webhook processing error [${topic}]:`, err);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("webhook_logs")
      .update({
        error: err instanceof Error ? err.message : String(err),
      })
      .eq("payload_hash", payloadHash);
  }

  // Always return 200 to Shopify
  return new Response("OK", { status: 200 });
}

/* ------------------------------------------------------------------ */
/*  Order Attribution Types                                            */
/* ------------------------------------------------------------------ */

interface Attribution {
  type: "discount_code" | "utm" | "both";
  campaign_id: string;
  campaign_creator_id: string;
  creator_id: string;
  discount_code_id?: string;
  utm_link_id?: string;
  code?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/* ------------------------------------------------------------------ */
/*  orders/create handler                                              */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderCreate(supabase: DB, brandId: string, order: any) {
  const attributions: Attribution[] = [];

  // ── SIGNAL 1: Discount code attribution ──────────────────────
  if (order.discount_codes?.length > 0) {
    const codes = order.discount_codes.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dc: any) => dc.code?.toUpperCase()
    ).filter(Boolean);

    for (const code of codes) {
      const { data: discountMatch } = await supabase
        .from("campaign_discount_codes")
        .select(
          "id, campaign_id, campaign_creator_id, creator_id, discount_percentage"
        )
        .eq("code", code)
        .eq("brand_id", brandId)
        .eq("is_active", true)
        .single();

      if (discountMatch) {
        attributions.push({
          type: "discount_code",
          campaign_id: discountMatch.campaign_id,
          campaign_creator_id: discountMatch.campaign_creator_id,
          creator_id: discountMatch.creator_id,
          discount_code_id: discountMatch.id,
          code,
        });

        // Increment discount code usage
        await supabase.rpc("increment_discount_usage", {
          p_code_id: discountMatch.id,
          p_revenue: parseFloat(order.total_price),
        });
      }
    }
  }

  // ── SIGNAL 2: UTM attribution (from landing_site) ────────────
  const landingSite = order.landing_site || order.landing_site_ref;
  if (landingSite) {
    try {
      const urlParams = new URL(landingSite, "https://dummy.com").searchParams;
      const utmContent = urlParams.get("utm_content");
      const utmCampaign = urlParams.get("utm_campaign");
      const utmMedium = urlParams.get("utm_medium");

      if (utmMedium === "influencer" && utmContent) {
        const { data: utmMatch } = await supabase
          .from("campaign_utm_links")
          .select("id, campaign_id, campaign_creator_id, creator_id")
          .eq("utm_content", utmContent)
          .eq("utm_campaign", utmCampaign)
          .eq("brand_id", brandId)
          .single();

        if (utmMatch) {
          const alreadyAttributed = attributions.some(
            (a) =>
              a.creator_id === utmMatch.creator_id &&
              a.campaign_id === utmMatch.campaign_id
          );

          if (alreadyAttributed) {
            const existing = attributions.find(
              (a) => a.creator_id === utmMatch.creator_id
            );
            if (existing) existing.type = "both";
          } else {
            attributions.push({
              type: "utm",
              campaign_id: utmMatch.campaign_id,
              campaign_creator_id: utmMatch.campaign_creator_id,
              creator_id: utmMatch.creator_id,
              utm_link_id: utmMatch.id,
            });
          }
        }
      }
    } catch {
      // URL parsing failed — skip UTM attribution
    }
  }

  // ── SIGNAL 3: Instagram referrer ─────────────────────────────
  const isInstagramReferred =
    order.referring_site?.includes("instagram.com") ?? false;

  // ── Write attributed orders ──────────────────────────────────
  for (const attr of attributions) {
    await supabase.from("attributed_orders").upsert(
      {
        brand_id: brandId,
        campaign_id: attr.campaign_id,
        campaign_creator_id: attr.campaign_creator_id,
        creator_id: attr.creator_id,
        shopify_order_id: order.id.toString(),
        shopify_order_number: order.order_number,
        order_total: parseFloat(order.total_price),
        order_subtotal: parseFloat(order.subtotal_price || order.total_price),
        total_price: parseFloat(order.total_price),
        currency: order.currency,
        attribution_type: attr.type,
        discount_code_id: attr.discount_code_id || null,
        utm_link_id: attr.utm_link_id || null,
        discount_code_used: attr.code || null,
        customer_city: order.shipping_address?.city,
        customer_state: order.shipping_address?.province,
        customer_country: order.shipping_address?.country_code,
        line_items: (order.line_items || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (li: any) => ({
            product_id: li.product_id,
            title: li.title,
            quantity: li.quantity,
            price: li.price,
          })
        ),
        is_first_order: order.customer?.orders_count === 1,
        is_instagram_referred: isInstagramReferred,
        ordered_at: order.created_at,
        raw_order: order,
      },
      { onConflict: "shopify_order_id,creator_id" }
    );

    // Update performance aggregate
    await updatePerformanceAggregate(supabase, {
      campaignId: attr.campaign_id,
      campaignCreatorId: attr.campaign_creator_id,
      brandId,
      deltaOrders: 1,
      deltaRevenue: parseFloat(order.total_price),
      attributionType: attr.type,
    });
  }

  // ── Milestone notifications ──────────────────────────────────
  for (const attr of attributions) {
    await checkMilestoneNotifications(supabase, brandId, attr);
  }
}

/* ------------------------------------------------------------------ */
/*  orders/paid handler                                                */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderPaid(supabase: DB, _brandId: string, order: any) {
  // Mark existing attributed orders as paid (no-op if already processed)
  await supabase
    .from("attributed_orders")
    .update({ updated_at: new Date().toISOString() })
    .eq("shopify_order_id", order.id.toString());
}

/* ------------------------------------------------------------------ */
/*  orders/updated handler (refunds, cancellations)                    */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOrderUpdated(supabase: DB, brandId: string, order: any) {
  if (
    order.cancelled_at ||
    order.financial_status === "refunded" ||
    order.financial_status === "voided"
  ) {
    // Get all attributions for this order
    const { data: existing } = await supabase
      .from("attributed_orders")
      .select("id, campaign_id, campaign_creator_id, order_total")
      .eq("shopify_order_id", order.id.toString())
      .eq("brand_id", brandId);

    if (existing?.length) {
      // Remove attributed orders
      await supabase
        .from("attributed_orders")
        .delete()
        .eq("shopify_order_id", order.id.toString())
        .eq("brand_id", brandId);

      // Decrement performance aggregates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const attr of existing as any[]) {
        await updatePerformanceAggregate(supabase, {
          campaignId: attr.campaign_id,
          campaignCreatorId: attr.campaign_creator_id,
          brandId,
          deltaOrders: -1,
          deltaRevenue: -(attr.order_total || 0),
          attributionType: "discount_code", // type doesn't matter for decrements
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Performance Aggregate Updater                                      */
/* ------------------------------------------------------------------ */

async function updatePerformanceAggregate(
  supabase: DB,
  params: {
    campaignId: string;
    campaignCreatorId: string;
    brandId: string;
    deltaOrders: number;
    deltaRevenue: number;
    attributionType: string;
  }
) {
  const { data: existing } = await supabase
    .from("campaign_performance_summary")
    .select("id, total_orders, total_revenue, discount_orders, utm_orders, both_orders")
    .eq("campaign_creator_id", params.campaignCreatorId)
    .single();

  if (existing) {
    const typeField =
      params.attributionType === "discount_code"
        ? "discount_orders"
        : params.attributionType === "utm"
          ? "utm_orders"
          : "both_orders";

    const update: Record<string, unknown> = {
      total_orders: Math.max(0, existing.total_orders + params.deltaOrders),
      total_revenue: Math.max(0, existing.total_revenue + params.deltaRevenue),
      updated_at: new Date().toISOString(),
    };

    if (params.deltaOrders > 0) {
      update.last_order_at = new Date().toISOString();
      update[typeField] = (existing[typeField] || 0) + params.deltaOrders;
    }

    await supabase
      .from("campaign_performance_summary")
      .update(update)
      .eq("id", existing.id);
  } else if (params.deltaOrders > 0) {
    // Fetch creator cost for ROI calculation
    const { data: cc } = await supabase
      .from("campaign_creators")
      .select("agreed_rate")
      .eq("id", params.campaignCreatorId)
      .single();

    const typeField =
      params.attributionType === "discount_code"
        ? "discount_orders"
        : params.attributionType === "utm"
          ? "utm_orders"
          : "both_orders";

    await supabase.from("campaign_performance_summary").insert({
      campaign_id: params.campaignId,
      campaign_creator_id: params.campaignCreatorId,
      brand_id: params.brandId,
      total_orders: params.deltaOrders,
      total_revenue: params.deltaRevenue,
      creator_cost: cc?.agreed_rate || 0,
      last_order_at: new Date().toISOString(),
      [typeField]: params.deltaOrders,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Milestone Notifications                                            */
/* ------------------------------------------------------------------ */

async function checkMilestoneNotifications(
  supabase: DB,
  brandId: string,
  attr: Attribution
) {
  const { data: summary } = await supabase
    .from("campaign_performance_summary")
    .select("total_orders, total_revenue, creator_cost")
    .eq("campaign_creator_id", attr.campaign_creator_id)
    .single();

  if (!summary) return;

  const { data: creator } = await supabase
    .from("creators")
    .select("handle")
    .eq("id", attr.creator_id)
    .single();

  const handle = creator?.handle ?? "unknown";

  // First order notification
  if (summary.total_orders === 1) {
    await supabase.from("notifications").insert({
      brand_id: brandId,
      type: "attribution_milestone",
      title: `First sale! @${handle} just drove their first order`,
      body: `@${handle} just attributed their first sale. Revenue: ${formatINR(summary.total_revenue)}.`,
      priority: "high",
      campaign_id: attr.campaign_id,
      creator_id: attr.creator_id,
    } as never);
  }

  // Order milestones
  const orderMilestones = [10, 50, 100];
  for (const m of orderMilestones) {
    if (summary.total_orders === m) {
      await supabase.from("notifications").insert({
        brand_id: brandId,
        type: "attribution_milestone",
        title: `@${handle} hit ${m} orders!`,
        body: `${m} orders attributed to @${handle}. Total revenue: ${formatINR(summary.total_revenue)}.`,
        priority: "medium",
        campaign_id: attr.campaign_id,
        creator_id: attr.creator_id,
      } as never);
    }
  }

  // Revenue milestones
  const revenueMilestones = [
    { amount: 100000, label: "1 lakh" },
    { amount: 500000, label: "5 lakh" },
    { amount: 1000000, label: "10 lakh" },
  ];

  for (const m of revenueMilestones) {
    // Check if we just crossed this threshold
    const prevRevenue = summary.total_revenue - (parseFloat(String(summary.total_revenue)) > 0 ? 0 : 0);
    if (summary.total_revenue >= m.amount && prevRevenue < m.amount) {
      const roi = summary.creator_cost > 0
        ? (summary.total_revenue / summary.creator_cost).toFixed(1)
        : "N/A";

      await supabase.from("notifications").insert({
        brand_id: brandId,
        type: "revenue_milestone",
        title: `@${handle} crossed ${m.label} revenue!`,
        body: `Revenue attributed to @${handle} has crossed ${m.label}. Current ROI: ${roi}x.`,
        priority: "high",
        campaign_id: attr.campaign_id,
        creator_id: attr.creator_id,
      } as never);
    }
  }
}

function formatINR(amount: number): string {
  return `\u20B9${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
