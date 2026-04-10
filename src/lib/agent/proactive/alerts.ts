/* ------------------------------------------------------------------ */
/*  Proactive Agent Alerts                                             */
/*  Scans for conditions that warrant proactive notifications:        */
/*  - Approaching deadlines with missing content                      */
/*  - Budget pacing issues                                            */
/*  - Performance highlights worth acting on                          */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Alert {
  type: "deadline_warning" | "budget_warning" | "performance_highlight" | "reengagement";
  severity: "info" | "warning" | "critical";
  message: string;
  campaignId?: string;
  creatorId?: string;
  data?: Record<string, unknown>;
}

const DEADLINE_WARNING_DAYS = 7;
const BUDGET_WARNING_THRESHOLD = 0.8; // 80%

/* ── Deadline Alerts ──────────────────────────────────────────────── */

/**
 * Check for campaigns approaching deadlines with missing content.
 */
export async function checkDeadlineAlerts(
  brandId: string,
  supabase: SupabaseClient
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const warningDate = new Date(
    Date.now() + DEADLINE_WARNING_DAYS * 86400000
  ).toISOString();

  // Find active campaigns ending within warning period
  const { data: campaigns } = (await supabase
    .from("campaigns")
    .select("id, name, end_date, status")
    .eq("brand_id", brandId)
    .eq("status", "active")
    .lte("end_date", warningDate)) as { data: Record<string, unknown>[] | null };

  for (const campaign of campaigns || []) {
    // Find creators who haven't posted
    const { data: creators } = (await supabase
      .from("campaign_creators")
      .select("creator_id, status, content_status")
      .eq("campaign_id", campaign.id)
      .in("status", ["confirmed", "content_submitted"])) as {
      data: Record<string, unknown>[] | null;
    };

    const notPosted = (creators || []).filter(
      (c) => c.content_status !== "posted" && c.content_status !== "live"
    );

    if (notPosted.length > 0) {
      const daysLeft = Math.ceil(
        (new Date(campaign.end_date as string).getTime() - Date.now()) / 86400000
      );

      alerts.push({
        type: "deadline_warning",
        severity: daysLeft <= 3 ? "critical" : "warning",
        message: `${campaign.name}: ${notPosted.length} creator(s) haven't posted yet — ${daysLeft} days until deadline`,
        campaignId: campaign.id as string,
        data: { notPostedCount: notPosted.length, daysLeft },
      });
    }
  }

  return alerts;
}

/* ── Budget Alerts ────────────────────────────────────────────────── */

/**
 * Check for campaigns with budget pacing issues.
 */
export async function checkBudgetAlerts(
  brandId: string,
  supabase: SupabaseClient
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const { data: campaigns } = (await supabase
    .from("campaigns")
    .select("id, name, total_budget, budget_spent, start_date, end_date, status")
    .eq("brand_id", brandId)
    .eq("status", "active")) as { data: Record<string, unknown>[] | null };

  for (const campaign of campaigns || []) {
    const totalBudget = campaign.total_budget as number;
    const budgetSpent = campaign.budget_spent as number;

    if (!totalBudget || totalBudget <= 0) continue;

    const usagePercent = budgetSpent / totalBudget;

    // Calculate timeline progress
    const startDate = new Date(campaign.start_date as string).getTime();
    const endDate = new Date(campaign.end_date as string).getTime();
    const now = Date.now();
    const timelineProgress =
      endDate > startDate ? (now - startDate) / (endDate - startDate) : 1;

    // Alert if budget usage significantly outpaces timeline
    if (usagePercent >= BUDGET_WARNING_THRESHOLD && timelineProgress < 0.9) {
      const remaining = totalBudget - budgetSpent;
      alerts.push({
        type: "budget_warning",
        severity: usagePercent >= 0.95 ? "critical" : "warning",
        message: `${campaign.name}: ${Math.round(usagePercent * 100)}% of budget used with ${Math.round((1 - timelineProgress) * 100)}% of timeline remaining (₹${remaining.toLocaleString("en-IN")} left)`,
        campaignId: campaign.id as string,
        data: { usagePercent, timelineProgress, remaining },
      });
    }
  }

  return alerts;
}

/* ── Performance Alerts ───────────────────────────────────────────── */

/**
 * Check for standout creator performance worth highlighting.
 */
export async function checkPerformanceAlerts(
  brandId: string,
  supabase: SupabaseClient
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Find top performers (>20 orders or >₹100K revenue)
  const { data: performers } = (await supabase
    .from("campaign_performance_summary")
    .select("campaign_id, creator_id, campaign_orders, campaign_revenue")
    .eq("brand_id", brandId)
    .gte("campaign_orders", 20)
    .order("campaign_revenue", { ascending: false })
    .limit(5)) as { data: Record<string, unknown>[] | null };

  for (const perf of performers || []) {
    const revenue = perf.campaign_revenue as number;
    const orders = perf.campaign_orders as number;

    alerts.push({
      type: "performance_highlight",
      severity: "info",
      message: `Creator generated ${orders} orders (₹${revenue.toLocaleString("en-IN")} revenue) — consider extending collaboration or increasing budget`,
      campaignId: perf.campaign_id as string,
      creatorId: perf.creator_id as string,
      data: { orders, revenue },
    });
  }

  return alerts;
}

/**
 * Run all proactive alert checks and return combined results.
 */
export async function runAllAlerts(
  brandId: string,
  supabase: SupabaseClient
): Promise<Alert[]> {
  const [deadlines, budgets, performance] = await Promise.all([
    checkDeadlineAlerts(brandId, supabase),
    checkBudgetAlerts(brandId, supabase),
    checkPerformanceAlerts(brandId, supabase),
  ]);

  return [...deadlines, ...budgets, ...performance];
}
