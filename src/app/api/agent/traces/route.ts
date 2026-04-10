import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/agent/traces?view=recent|stats|costs
 *
 * recent: Latest traces (paginated)
 * stats:  Aggregated tool call counts and success rates
 * costs:  Token usage and estimated costs over time
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const brandId = (brand as { id: string }).id;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "recent";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const sessionId = searchParams.get("session_id");

    if (view === "recent") {
      let query = supabase
        .from("agent_traces")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (sessionId) {
        query = query.eq("session_id", sessionId);
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ traces: data || [] });
    }

    if (view === "stats") {
      // Aggregate tool call stats for the last 30 days
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: toolCalls } = await supabase
        .from("agent_traces")
        .select("tool_name, trace_type")
        .eq("brand_id", brandId)
        .in("trace_type", ["tool_call", "tool_error"])
        .gte("created_at", thirtyDaysAgo);

      const stats: Record<
        string,
        { calls: number; errors: number; success_rate: number }
      > = {};

      for (const row of (toolCalls || []) as { tool_name: string; trace_type: string }[]) {
        if (!row.tool_name) continue;
        if (!stats[row.tool_name]) {
          stats[row.tool_name] = { calls: 0, errors: 0, success_rate: 1 };
        }
        stats[row.tool_name].calls++;
        if (row.trace_type === "tool_error") {
          stats[row.tool_name].errors++;
        }
      }

      // Compute success rates
      for (const tool of Object.values(stats)) {
        tool.success_rate =
          tool.calls > 0 ? (tool.calls - tool.errors) / tool.calls : 1;
      }

      return NextResponse.json({ stats });
    }

    if (view === "costs") {
      // Token usage and costs for the last 30 days
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: llmTraces } = await supabase
        .from("agent_traces")
        .select("tokens_used, cost_cents, created_at")
        .eq("brand_id", brandId)
        .eq("trace_type", "llm_call")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });

      const rows = (llmTraces || []) as {
        tokens_used: number | null;
        cost_cents: number | null;
        created_at: string;
      }[];

      const totalTokens = rows.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
      const totalCostCents = rows.reduce((sum, r) => sum + (r.cost_cents || 0), 0);

      // Group by day for chart data
      const dailyCosts: Record<string, { tokens: number; cost_cents: number }> = {};
      for (const row of rows) {
        const day = row.created_at.split("T")[0];
        if (!dailyCosts[day]) dailyCosts[day] = { tokens: 0, cost_cents: 0 };
        dailyCosts[day].tokens += row.tokens_used || 0;
        dailyCosts[day].cost_cents += row.cost_cents || 0;
      }

      return NextResponse.json({
        costs: {
          total_tokens: totalTokens,
          total_cost_cents: Math.round(totalCostCents * 100) / 100,
          total_calls: rows.length,
          daily: dailyCosts,
        },
      });
    }

    return NextResponse.json({ error: "Invalid view parameter" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Failed to load traces" },
      { status: 500 }
    );
  }
}
