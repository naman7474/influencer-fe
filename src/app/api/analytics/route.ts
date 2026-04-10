import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics
 * Cross-campaign analytics: aggregate KPIs, campaign comparison, top creators, attribution mix.
 */
export async function GET(_request: NextRequest) {
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
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;
    if (!brand) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    // ── Campaign-level aggregates ───────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: summaries } = await (supabase as any)
      .from("campaign_performance_summary")
      .select(
        `
        campaign_id,
        total_orders,
        total_revenue,
        creator_cost,
        roi_ratio,
        discount_orders,
        utm_orders,
        both_orders
      `
      )
      .eq("brand_id", brand.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSummaries = (summaries ?? []) as any[];

    // Aggregate by campaign
    const campaignMap = new Map<
      string,
      {
        spend: number;
        revenue: number;
        orders: number;
        discountOrders: number;
        utmOrders: number;
        bothOrders: number;
      }
    >();

    for (const s of allSummaries) {
      const existing = campaignMap.get(s.campaign_id) ?? {
        spend: 0,
        revenue: 0,
        orders: 0,
        discountOrders: 0,
        utmOrders: 0,
        bothOrders: 0,
      };
      existing.spend += Number(s.creator_cost ?? 0);
      existing.revenue += Number(s.total_revenue ?? 0);
      existing.orders += Number(s.total_orders ?? 0);
      existing.discountOrders += Number(s.discount_orders ?? 0);
      existing.utmOrders += Number(s.utm_orders ?? 0);
      existing.bothOrders += Number(s.both_orders ?? 0);
      campaignMap.set(s.campaign_id, existing);
    }

    // Get campaign names
    const campaignIds = Array.from(campaignMap.keys());
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, name, status")
      .in("id", campaignIds.length > 0 ? campaignIds : ["none"]);

    const campaignComparison = ((campaigns ?? []) as { id: string; name: string; status: string }[]).map((c) => {
      const agg = campaignMap.get(c.id) ?? {
        spend: 0,
        revenue: 0,
        orders: 0,
        discountOrders: 0,
        utmOrders: 0,
        bothOrders: 0,
      };
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        spend: agg.spend,
        revenue: agg.revenue,
        orders: agg.orders,
        roi: agg.spend > 0 ? Math.round((agg.revenue / agg.spend) * 10) / 10 : 0,
      };
    });

    // Global totals
    const totalSpend = Array.from(campaignMap.values()).reduce(
      (s, c) => s + c.spend,
      0
    );
    const totalRevenue = Array.from(campaignMap.values()).reduce(
      (s, c) => s + c.revenue,
      0
    );
    const totalOrders = Array.from(campaignMap.values()).reduce(
      (s, c) => s + c.orders,
      0
    );
    const totalROI =
      totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 10) / 10 : 0;

    // Attribution mix
    const totalDiscount = allSummaries.reduce(
      (s, c) => s + Number(c.discount_orders ?? 0),
      0
    );
    const totalUTM = allSummaries.reduce(
      (s, c) => s + Number(c.utm_orders ?? 0),
      0
    );
    const totalBoth = allSummaries.reduce(
      (s, c) => s + Number(c.both_orders ?? 0),
      0
    );

    // ── Top creators ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creatorPerf } = await (supabase as any)
      .from("campaign_performance_summary")
      .select(
        `
        creator_cost,
        total_orders,
        total_revenue,
        roi_ratio,
        campaign_creator:campaign_creators (
          creator:creators ( id, handle, display_name )
        )
      `
      )
      .eq("brand_id", brand.id)
      .order("total_revenue", { ascending: false })
      .limit(10);

    // Aggregate by creator (they may appear in multiple campaigns)
    const creatorMap = new Map<
      string,
      {
        handle: string;
        displayName: string | null;
        campaigns: number;
        revenue: number;
        orders: number;
        spend: number;
      }
    >();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const cp of (creatorPerf ?? []) as any[]) {
      const handle =
        cp.campaign_creator?.creator?.handle ?? "unknown";
      const existing = creatorMap.get(handle) ?? {
        handle,
        displayName: cp.campaign_creator?.creator?.display_name,
        campaigns: 0,
        revenue: 0,
        orders: 0,
        spend: 0,
      };
      existing.campaigns += 1;
      existing.revenue += Number(cp.total_revenue ?? 0);
      existing.orders += Number(cp.total_orders ?? 0);
      existing.spend += Number(cp.creator_cost ?? 0);
      creatorMap.set(handle, existing);
    }

    const topCreators = Array.from(creatorMap.values())
      .map((c) => ({
        ...c,
        roi: c.spend > 0 ? Math.round((c.revenue / c.spend) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return NextResponse.json({
      kpis: { totalSpend, totalRevenue, totalOrders, totalROI },
      campaignComparison,
      topCreators,
      attributionMix: {
        discountOrders: totalDiscount,
        utmOrders: totalUTM,
        bothOrders: totalBoth,
      },
    });
  } catch (err) {
    console.error("GET analytics error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
