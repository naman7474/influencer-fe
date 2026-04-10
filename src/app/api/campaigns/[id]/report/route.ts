import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Get the latest report for this campaign
    const { data: report } = await supabase
      .from("campaign_reports")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!report) {
      return NextResponse.json(
        { error: "No report found for this campaign. Generate one first." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("[campaign/report GET] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Verify campaign belongs to brand
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, name, status")
      .eq("id", campaignId)
      .eq("brand_id", brand.id)
      .single();

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const reportType =
      (campaign as Record<string, unknown>).status === "completed"
        ? "final"
        : "interim";

    // Use the campaign reporter skill logic inline
    // (The skill writes to campaign_reports table)
    // For the API, we trigger via a lightweight version
    const { data: perfRaw } = await supabase
      .from("campaign_performance_summary")
      .select("*")
      .eq("campaign_id", campaignId);
    const perf = (perfRaw || []) as Record<string, unknown>[];

    let totalSpend = 0;
    let totalRevenue = 0;
    let totalOrders = 0;

    for (const p of perf) {
      totalSpend += ((p.creator_cost as number) || 0);
      totalRevenue += ((p.total_revenue as number) || 0);
      totalOrders += ((p.total_orders as number) || 0);
    }

    const executiveSummary = {
      campaign_name: (campaign as Record<string, unknown>).name,
      total_spend: totalSpend,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      overall_roi:
        totalSpend > 0
          ? Math.round((totalRevenue / totalSpend) * 100) / 100
          : 0,
    };

    const reportData = {
      campaign_id: campaignId,
      brand_id: brand.id,
      report_type: reportType,
      executive_summary: executiveSummary,
      per_creator_breakdown: perf,
    };

    const { data: report } = await supabase
      .from("campaign_reports")
      .upsert(reportData as never, {
        onConflict: "campaign_id,report_type",
      })
      .select()
      .single();

    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("[campaign/report POST] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
