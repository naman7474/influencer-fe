import { describe, it, expect, vi } from "vitest";
import { roiCalculatorTool } from "../roi-calculator";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => {
    isSingle = true;
    return builder;
  });
  builder.then = (resolve: (v: unknown) => void) => {
    if (isSingle) {
      const singleData =
        Array.isArray(data) && data.length > 0 ? data[0] : null;
      resolve({ data: singleData, error });
    } else {
      resolve({ data, error });
    }
  };
  return builder;
}

type SupabaseParam = Parameters<typeof roiCalculatorTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("roi-calculator", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-x", include_timeseries: false },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("not found");
  });

  it("returns zero KPIs when no performance data", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Summer", total_budget: 100000, start_date: "2026-01-01", end_date: "2026-02-01", status: "active" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_timeseries: false },
      execOpts
    )) as { campaign: string; kpis: { total_spend: number; roi: number } };
    expect(result.campaign).toBe("Summer");
    expect(result.kpis.total_spend).toBe(0);
    expect(result.kpis.roi).toBe(0);
  });

  it("calculates ROI with per-creator breakdown", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Winter", total_budget: 200000, status: "active" },
          ]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { creator_id: "c1", creator_cost: 50000, total_revenue: 200000, total_orders: 40, discount_orders: 30, utm_orders: 5, both_orders: 5 },
            { creator_id: "c2", creator_cost: 30000, total_revenue: 60000, total_orders: 10, discount_orders: 8, utm_orders: 2, both_orders: 0 },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@star", display_name: "Star", tier: "mid", followers: 50000 },
            { creator_id: "c2", handle: "@mid", display_name: "Mid", tier: "micro", followers: 20000 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_timeseries: false },
      execOpts
    )) as {
      campaign: string;
      kpis: { total_spend: number; total_revenue: number; total_orders: number; roi: number; cost_per_order: number; budget_utilization: number };
      per_creator: { handle: string; roi: number }[];
      top_performer: { handle: string; roi: number };
      attribution_breakdown: { discount_orders: number; utm_orders: number; both_orders: number };
    };

    expect(result.kpis.total_spend).toBe(80000);
    expect(result.kpis.total_revenue).toBe(260000);
    expect(result.kpis.total_orders).toBe(50);
    expect(result.kpis.roi).toBe(3.25);
    expect(result.kpis.cost_per_order).toBe(1600);
    expect(result.kpis.budget_utilization).toBe(40); // 80000/200000 * 100

    // Sorted by ROI descending
    expect(result.per_creator[0].handle).toBe("@star"); // 4.0 ROI
    expect(result.per_creator[1].handle).toBe("@mid");  // 2.0 ROI
    expect(result.top_performer.handle).toBe("@star");

    expect(result.attribution_breakdown.discount_orders).toBe(38);
    expect(result.attribution_breakdown.utm_orders).toBe(7);
    expect(result.attribution_breakdown.both_orders).toBe(5);
  });

  it("handles zero spend (no division by zero)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Free", total_budget: null, status: "active" },
          ]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { creator_id: "c1", creator_cost: 0, total_revenue: 5000, total_orders: 2, discount_orders: 1, utm_orders: 1, both_orders: 0 },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@free", display_name: "Free", tier: "nano" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_timeseries: false },
      execOpts
    )) as { kpis: { roi: number; budget_utilization: number | null } };

    expect(result.kpis.roi).toBe(0); // 0 spend → 0 ROI
    expect(result.kpis.budget_utilization).toBeNull(); // null budget
  });

  it("includes timeseries data when requested", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Tracked", total_budget: 100000, status: "active" },
          ]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { creator_id: "c1", creator_cost: 10000, total_revenue: 30000, total_orders: 5, discount_orders: 3, utm_orders: 2, both_orders: 0 },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@ts", display_name: "TS", tier: "micro" },
          ]);
        }
        if (table === "attributed_orders") {
          return mockQueryBuilder([
            { order_total: 5000, ordered_at: "2026-01-15T10:00:00Z", attribution_type: "discount" },
            { order_total: 3000, ordered_at: "2026-01-15T14:00:00Z", attribution_type: "utm" },
            { order_total: 8000, ordered_at: "2026-01-16T12:00:00Z", attribution_type: "discount" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_timeseries: true },
      execOpts
    )) as { timeseries: { date: string; revenue: number; orders: number }[] };

    expect(result.timeseries).toHaveLength(2);
    const day1 = result.timeseries.find((t) => t.date === "2026-01-15");
    expect(day1!.revenue).toBe(8000);
    expect(day1!.orders).toBe(2);
    const day2 = result.timeseries.find((t) => t.date === "2026-01-16");
    expect(day2!.revenue).toBe(8000);
    expect(day2!.orders).toBe(1);
  });

  it("handles creator not in leaderboard (falls back to creator_id)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", total_budget: 50000, status: "active" },
          ]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { creator_id: "c1", creator_cost: 5000, total_revenue: 10000, total_orders: 3, discount_orders: 3, utm_orders: 0, both_orders: 0 },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([]); // no creators found
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_timeseries: false },
      execOpts
    )) as { per_creator: { handle: string }[] };

    expect(result.per_creator[0].handle).toBe("c1"); // falls back to creator_id
  });
});
