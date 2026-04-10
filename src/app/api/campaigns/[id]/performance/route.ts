import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/campaigns/[id]/performance
 * Returns campaign performance data: KPIs, per-creator breakdown, attribution mix, timeseries.
 */
export async function GET(
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

    // ── Per-creator performance summary ─────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: summaries } = await (supabase as any)
      .from("campaign_performance_summary")
      .select(
        `
        *,
        campaign_creator:campaign_creators (
          id,
          agreed_rate,
          creator:creators (
            id, handle, display_name, avatar_url
          )
        )
      `
      )
      .eq("campaign_id", campaignId)
      .eq("brand_id", brand.id)
      .order("total_revenue", { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perCreator = ((summaries ?? []) as any[]).map((s) => ({
      campaignCreatorId: s.campaign_creator_id,
      handle: s.campaign_creator?.creator?.handle ?? "unknown",
      displayName: s.campaign_creator?.creator?.display_name,
      avatarUrl: s.campaign_creator?.creator?.avatar_url,
      spent: s.creator_cost ?? 0,
      orders: s.total_orders ?? 0,
      revenue: s.total_revenue ?? 0,
      roi: s.roi_ratio ?? 0,
      clicks: s.total_clicks ?? 0,
      discountOrders: s.discount_orders ?? 0,
      utmOrders: s.utm_orders ?? 0,
      bothOrders: s.both_orders ?? 0,
    }));

    // ── Aggregate KPIs ──────────────────────────────────────────
    const totalSpend = perCreator.reduce((sum: number, c: { spent: number }) => sum + c.spent, 0);
    const totalRevenue = perCreator.reduce((sum: number, c: { revenue: number }) => sum + c.revenue, 0);
    const totalOrders = perCreator.reduce((sum: number, c: { orders: number }) => sum + c.orders, 0);
    const totalROI = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    // ── Attribution breakdown ───────────────────────────────────
    const discountOrders = perCreator.reduce((s: number, c: { discountOrders: number }) => s + c.discountOrders, 0);
    const utmOrders = perCreator.reduce((s: number, c: { utmOrders: number }) => s + c.utmOrders, 0);
    const bothOrders = perCreator.reduce((s: number, c: { bothOrders: number }) => s + c.bothOrders, 0);

    // ── Revenue timeseries ──────────────────────────────────────
    const { data: orders } = await supabase
      .from("attributed_orders")
      .select("order_total, ordered_at, attribution_type")
      .eq("campaign_id", campaignId)
      .eq("brand_id", brand.id)
      .order("ordered_at", { ascending: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dailyMap = new Map<string, { total: number; discount: number; utm: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const o of (orders ?? []) as any[]) {
      const date = o.ordered_at
        ? new Date(o.ordered_at).toISOString().slice(0, 10)
        : "unknown";
      const existing = dailyMap.get(date) ?? { total: 0, discount: 0, utm: 0 };
      const amount = Number(o.order_total ?? o.total_price ?? 0);
      existing.total += amount;
      if (o.attribution_type === "discount_code" || o.attribution_type === "both") {
        existing.discount += amount;
      }
      if (o.attribution_type === "utm" || o.attribution_type === "both") {
        existing.utm += amount;
      }
      dailyMap.set(date, existing);
    }

    const timeseries = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));

    // ── Top products ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productMap = new Map<string, { title: string; quantity: number; revenue: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const o of (orders ?? []) as any[]) {
      const items = o.line_items ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const li of items as any[]) {
        const key = li.product_id?.toString() ?? li.title;
        const existing = productMap.get(key) ?? {
          title: li.title ?? "Unknown",
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += li.quantity ?? 1;
        existing.revenue += parseFloat(li.price ?? 0) * (li.quantity ?? 1);
        productMap.set(key, existing);
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return NextResponse.json({
      kpis: {
        totalSpend,
        totalRevenue,
        totalOrders,
        totalROI: Math.round(totalROI * 10) / 10,
      },
      attribution: {
        discountOrders,
        utmOrders,
        bothOrders,
      },
      timeseries,
      perCreator,
      topProducts,
    });
  } catch (err) {
    console.error("GET performance error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
