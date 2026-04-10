import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { scanNewMatchingCreators, scanReengagementOpportunities, scanAmbassadorCandidates } from "@/lib/agent/proactive/weekly-scan";
import { generateRelationshipHealth, generatePerformanceTrends } from "@/lib/agent/proactive/monthly-scan";

/**
 * Proactive agent cron endpoint.
 * Authenticated via CRON_SECRET header.
 *
 * Query params:
 *  - job: "weekly" | "monthly" | "maintenance"
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Service-role client for cross-brand operations
    const supabase = createServiceRoleClient();

    const { searchParams } = new URL(request.url);
    const job = searchParams.get("job") || "weekly";

    let results: Record<string, unknown> = {};

    if (job === "weekly") {
      const [newMatches, reengagement, ambassadors] = await Promise.all([
        scanNewMatchingCreators(supabase),
        scanReengagementOpportunities(supabase),
        scanAmbassadorCandidates(supabase),
      ]);
      results = { newMatches, reengagement, ambassadors };
    } else if (job === "monthly") {
      const [health, trends] = await Promise.all([
        generateRelationshipHealth(supabase),
        generatePerformanceTrends(supabase),
      ]);
      results = { health, trends };
    } else if (job === "maintenance") {
      // Knowledge confidence decay
      const { error: decayError } = await supabase.rpc(
        "fn_decay_agent_knowledge"
      );

      // Remind about stale pending approvals (>24h)
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);

      const { data: staleRaw } = await supabase
        .from("approval_queue")
        .select("id, brand_id, title")
        .eq("status", "pending")
        .lte("created_at", dayAgo.toISOString());
      const stale = (staleRaw || []) as Record<string, unknown>[];

      // Group by brand and send reminders
      const byBrand = new Map<string, Record<string, unknown>[]>();
      for (const item of stale) {
        const bid = item.brand_id as string;
        if (!byBrand.has(bid)) byBrand.set(bid, []);
        byBrand.get(bid)!.push(item);
      }

      for (const [brandId, items] of byBrand) {
        await supabase.from("notifications").insert({
          brand_id: brandId,
          type: "approval_reminder",
          title: `${items.length} pending approval(s) need your attention`,
          body: `You have ${items.length} approval(s) waiting for more than 24 hours.`,
          link: "/approvals",
        } as never);
      }

      results = {
        decayError: decayError?.message || null,
        staleApprovals: stale.length,
        brandsNotified: byBrand.size,
      };
    } else {
      return NextResponse.json(
        { error: `Unknown job type: ${job}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err) {
    console.error("[cron/agent-proactive] Error:", err);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
