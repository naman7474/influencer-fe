/* ------------------------------------------------------------------ */
/*  Proactive Alerts API                                               */
/*  GET  — Fetch alerts for authenticated brand                        */
/*  POST — Cron-compatible endpoint to run alerts for all brands       */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { runAllAlerts } from "@/lib/agent/proactive/alerts";

/**
 * GET /api/agent/alerts
 * Returns proactive alerts for the authenticated brand.
 */
export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandData as { id: string } | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const alerts = await runAllAlerts(brand.id, supabase);

    return NextResponse.json({ success: true, alerts, count: alerts.length });
  } catch {
    return NextResponse.json(
      { error: "Failed to check alerts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/alerts
 * Cron-compatible endpoint — runs alerts for all active brands and
 * persists any results as notifications. Vercel Cron calls this.
 *
 * Expected header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Get all brands with active campaigns
    const { data: brandsRaw } = await supabase
      .from("brands")
      .select("id");
    const brands = (brandsRaw || []) as { id: string }[];

    let totalAlerts = 0;

    for (const brand of brands) {
      const alerts = await runAllAlerts(brand.id, supabase);

      // Persist alerts as notifications
      for (const alert of alerts) {
        await supabase.from("notifications").insert({
          brand_id: brand.id,
          type: alert.type,
          title: alert.message,
          body: `Severity: ${alert.severity}${alert.campaignId ? ` | Campaign: ${alert.campaignId}` : ""}${alert.creatorId ? ` | Creator: ${alert.creatorId}` : ""}`,
          metadata: {
            severity: alert.severity,
            campaignId: alert.campaignId,
            creatorId: alert.creatorId,
            ...alert.data,
          },
        } as never);
      }

      totalAlerts += alerts.length;
    }

    return NextResponse.json({
      success: true,
      brands_checked: brands.length,
      alerts_generated: totalAlerts,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to run alerts" },
      { status: 500 }
    );
  }
}
