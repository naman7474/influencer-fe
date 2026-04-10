import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/campaigns/[id]/geographic-lift
 * Returns geographic lift data comparing pre/post campaign snapshots.
 *
 * POST /api/campaigns/[id]/geographic-lift
 * Triggers a pre-campaign or post-campaign snapshot.
 * Body: { type: "pre_campaign" | "post_campaign" }
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

    // Get pre-campaign snapshots
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: preSnapshots } = await (supabase as any)
      .from("campaign_geo_snapshots")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("snapshot_type", "pre_campaign");

    // Get post-campaign snapshots
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: postSnapshots } = await (supabase as any)
      .from("campaign_geo_snapshots")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("snapshot_type", "post_campaign");

    // If we have post snapshots with lift data, return them
    if (postSnapshots?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const regions = (postSnapshots as any[])
        .map((post) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pre = (preSnapshots as any[])?.find(
            (p: { city: string; state: string }) =>
              p.city === post.city && p.state === post.state
          );
          return {
            city: post.city,
            state: post.state,
            preSessions: pre?.sessions ?? 0,
            preOrders: pre?.orders ?? 0,
            preRevenue: pre?.revenue ?? 0,
            postSessions: post.sessions,
            postOrders: post.orders,
            postRevenue: post.revenue,
            sessionLift: post.session_lift_percent,
            orderLift: post.order_lift_percent,
            revenueLift: post.revenue_lift_percent,
            status:
              (post.session_lift_percent ?? 0) > 50
                ? "lift"
                : (post.session_lift_percent ?? 0) > 15
                  ? "mild"
                  : "flat",
          };
        })
        .sort(
          (a: { sessionLift: number | null }, b: { sessionLift: number | null }) =>
            (b.sessionLift ?? 0) - (a.sessionLift ?? 0)
        );

      return NextResponse.json({
        hasPreSnapshot: (preSnapshots?.length ?? 0) > 0,
        hasPostSnapshot: true,
        regions,
      });
    }

    // If we only have pre snapshots, return that state
    return NextResponse.json({
      hasPreSnapshot: (preSnapshots?.length ?? 0) > 0,
      hasPostSnapshot: false,
      regions: [],
    });
  } catch (err) {
    console.error("GET geographic-lift error:", err);
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
    const snapshotType = body.type as "pre_campaign" | "post_campaign";

    if (!["pre_campaign", "post_campaign"].includes(snapshotType)) {
      return NextResponse.json(
        { error: "Invalid snapshot type." },
        { status: 400 }
      );
    }

    // Get current brand geo data
    const { data: currentGeo } = await supabase
      .from("brand_shopify_geo")
      .select("*")
      .eq("brand_id", brand.id);

    if (!currentGeo?.length) {
      return NextResponse.json(
        { error: "No geographic data available. Sync Shopify data first." },
        { status: 404 }
      );
    }

    // Get pre-campaign snapshots for lift calculation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let preSnapshots: any[] = [];
    if (snapshotType === "post_campaign") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("campaign_geo_snapshots")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("snapshot_type", "pre_campaign");
      preSnapshots = (data ?? []);
    }

    // Insert snapshots
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const geo of currentGeo as any[]) {
      let sessionLift = null;
      let orderLift = null;
      let revenueLift = null;

      if (snapshotType === "post_campaign") {
        const pre = preSnapshots.find(
          (p: { city: string; state: string }) =>
            p.city === geo.city && p.state === geo.state
        );
        if (pre) {
          sessionLift =
            pre.sessions > 0
              ? ((geo.sessions - pre.sessions) / pre.sessions) * 100
              : geo.sessions > 0
                ? 999
                : 0;
          orderLift =
            pre.orders > 0
              ? ((geo.orders - pre.orders) / pre.orders) * 100
              : geo.orders > 0
                ? 999
                : 0;
          revenueLift =
            pre.revenue > 0
              ? ((geo.revenue - pre.revenue) / pre.revenue) * 100
              : geo.revenue > 0
                ? 999
                : 0;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("campaign_geo_snapshots").insert({
        campaign_id: campaignId,
        brand_id: brand.id,
        city: geo.city,
        state: geo.state,
        snapshot_type: snapshotType,
        sessions: geo.sessions,
        orders: geo.orders,
        revenue: geo.revenue,
        conversion_rate: geo.conversion_rate,
        session_lift_percent: sessionLift,
        order_lift_percent: orderLift,
        revenue_lift_percent: revenueLift,
      });
    }

    return NextResponse.json({
      success: true,
      snapshotType,
      regionsSnapshotted: currentGeo.length,
    });
  } catch (err) {
    console.error("POST geographic-lift error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
