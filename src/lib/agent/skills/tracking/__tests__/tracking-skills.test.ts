import { describe, it, expect, vi } from "vitest";
import { orderAttributorTool } from "../order-attributor";
import { contentMonitorTool } from "../content-monitor";
import { roiCalculatorTool } from "../roi-calculator";
import { geoLiftAnalyzerTool } from "../geo-lift-analyzer";
import { campaignReporterTool } from "../campaign-reporter";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit", "upsert",
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

type SupabaseParam = Parameters<typeof orderAttributorTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Order Attributor                                                   */
/* ------------------------------------------------------------------ */

describe("order-attributor", () => {
  const brandId = "brand-1";

  it("returns error when no active campaigns", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = orderAttributorTool(brandId, supabase);
    const result = await t.execute({ campaign_id: "missing" }, execOpts);
    expect(result).toHaveProperty("error");
  });

  it("returns attribution status for a campaign", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Summer Sale",
              start_date: "2025-06-01",
              end_date: "2025-07-01",
              status: "active",
            },
          ]);
        }
        if (table === "campaign_discount_codes") {
          return mockQueryBuilder([
            { id: "dc1", code: "SUMMER15", creator_id: "c1", usage_count: 5 },
          ]);
        }
        if (table === "campaign_utm_links") {
          return mockQueryBuilder([
            { id: "utm1", utm_content: "creator1", creator_id: "c1", click_count: 100 },
          ]);
        }
        if (table === "attributed_orders") {
          return mockQueryBuilder([{ id: "o1" }, { id: "o2" }, { id: "o3" }]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { total_orders: 3, total_revenue: 15000, discount_orders: 2, utm_orders: 1, both_orders: 0 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = orderAttributorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as {
      campaigns_checked: number;
      results: {
        tracking_setup: { discount_codes: number; utm_links: number };
        current_attribution: { attributed_orders: number };
      }[];
    };
    expect(result.campaigns_checked).toBe(1);
    expect(result.results[0].tracking_setup.discount_codes).toBe(1);
    expect(result.results[0].tracking_setup.utm_links).toBe(1);
    expect(result.results[0].current_attribution.attributed_orders).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/*  Content Monitor                                                    */
/* ------------------------------------------------------------------ */

describe("content-monitor", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = contentMonitorTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "missing", status_filter: "all" },
      execOpts
    );
    expect(result).toHaveProperty("error");
  });

  it("returns content status summary for a campaign", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", status: "active" },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            {
              id: "cc1",
              creator_id: "c1",
              status: "confirmed",
              content_status: "submitted",
              creators: { handle: "@c1", display_name: "Creator 1" },
            },
            {
              id: "cc2",
              creator_id: "c2",
              status: "confirmed",
              content_status: "not_submitted",
              creators: { handle: "@c2", display_name: "Creator 2" },
            },
          ]);
        }
        if (table === "content_submissions") {
          return mockQueryBuilder([
            {
              id: "sub-1",
              campaign_creator_id: "cc1",
              creator_id: "c1",
              caption_text: "Check out this amazing product! #ad @testbrand",
              content_url: "https://instagram.com/p/123",
              status: "submitted",
              compliance_check: { has_ad_disclosure: true },
              submitted_at: "2025-06-15T10:00:00Z",
              reviewed_at: null,
              feedback: null,
              compliance_scan_status: "pending",
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = contentMonitorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", status_filter: "all" },
      execOpts
    )) as {
      campaign: string;
      summary: Record<string, number>;
      creators: { handle: string; submission_count: number }[];
      total_submissions: number;
    };

    expect(result.campaign).toBe("Test");
    expect(result.summary.total_creators).toBe(2);
    expect(result.summary.submitted).toBe(1);
    expect(result.summary.not_submitted).toBe(1);
    expect(result.total_submissions).toBe(1);
    expect(result.creators[0].submission_count).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  ROI Calculator                                                     */
/* ------------------------------------------------------------------ */

describe("roi-calculator", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "missing", include_timeseries: false },
      execOpts
    );
    expect(result).toHaveProperty("error");
  });

  it("returns message when no performance data", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", budget: 100000, status: "active" },
          ]);
        }
        return mockQueryBuilder([]); // empty performance
      }),
    } as unknown as SupabaseParam;

    const t = roiCalculatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_timeseries: false },
      execOpts
    )) as { message: string; kpis: { total_spend: number } };
    expect(result.message).toContain("No performance data");
    expect(result.kpis.total_spend).toBe(0);
  });

  it("calculates per-creator ROI and aggregates", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", budget: 100000, status: "active" },
          ]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              creator_cost: 10000,
              total_revenue: 50000,
              total_orders: 20,
              discount_orders: 15,
              utm_orders: 5,
              both_orders: 0,
            },
            {
              creator_id: "c2",
              creator_cost: 15000,
              total_revenue: 10000,
              total_orders: 5,
              discount_orders: 3,
              utm_orders: 2,
              both_orders: 0,
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@top", display_name: "Top", tier: "mid", followers: 50000 },
            { id: "c2", handle: "@low", display_name: "Low", tier: "micro", followers: 10000 },
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
      kpis: {
        total_spend: number;
        total_revenue: number;
        total_orders: number;
        roi: number;
        budget_utilization: number;
      };
      per_creator: { handle: string; roi: number }[];
      top_performer: { handle: string; roi: number };
    };

    expect(result.kpis.total_spend).toBe(25000);
    expect(result.kpis.total_revenue).toBe(60000);
    expect(result.kpis.total_orders).toBe(25);
    expect(result.kpis.roi).toBe(2.4); // 60000/25000
    expect(result.kpis.budget_utilization).toBe(25); // 25000/100000*100
    // Sorted by ROI desc: c1 (5x) > c2 (0.67x)
    expect(result.per_creator[0].handle).toBe("@top");
    expect(result.per_creator[0].roi).toBe(5);
    expect(result.top_performer.handle).toBe("@top");
  });
});

/* ------------------------------------------------------------------ */
/*  Geo Lift Analyzer                                                  */
/* ------------------------------------------------------------------ */

describe("geo-lift-analyzer", () => {
  const brandId = "brand-1";

  it("returns message when no snapshots exist", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", start_date: "2025-06-01", end_date: "2025-07-01", status: "active" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = geoLiftAnalyzerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as { message: string };
    expect(result.message).toContain("No geographic snapshots");
  });

  it("calculates lift between pre and post snapshots", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", start_date: "2025-06-01", end_date: "2025-07-01", status: "completed" },
          ]);
        }
        if (table === "campaign_geo_snapshots") {
          return mockQueryBuilder([
            {
              city: "Mumbai",
              state: "Maharashtra",
              snapshot_type: "pre_campaign",
              sessions: 1000,
              orders: 50,
              revenue: 100000,
              conversion_rate: 5.0,
            },
            {
              city: "Mumbai",
              state: "Maharashtra",
              snapshot_type: "post_campaign",
              sessions: 1500,
              orders: 80,
              revenue: 180000,
              conversion_rate: 5.3,
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = geoLiftAnalyzerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as {
      regions: {
        city: string;
        lift: { sessions_percent: number; orders_percent: number; revenue_percent: number };
        status: string;
      }[];
      summary: { total_regions: number; regions_with_lift: number };
    };

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].city).toBe("Mumbai");
    expect(result.regions[0].lift.sessions_percent).toBe(50); // (1500-1000)/1000*100
    expect(result.regions[0].lift.orders_percent).toBe(60); // (80-50)/50*100
    expect(result.regions[0].lift.revenue_percent).toBe(80); // (180000-100000)/100000*100
    expect(result.regions[0].status).toBe("lift");
    expect(result.summary.regions_with_lift).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Campaign Reporter                                                  */
/* ------------------------------------------------------------------ */

describe("campaign-reporter", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = campaignReporterTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "missing", report_type: "interim" },
      execOpts
    );
    expect(result).toHaveProperty("error");
  });

  it("generates report with recommendations", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Summer Campaign",
              goal: "Drive sales",
              budget: 100000,
              start_date: "2025-06-01",
              end_date: "2025-07-01",
              status: "completed",
              discount_percent: 15,
            },
          ]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              creator_cost: 10000,
              total_revenue: 60000,
              total_orders: 25,
            },
            {
              creator_id: "c2",
              creator_cost: 8000,
              total_revenue: 3000,
              total_orders: 2,
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@top", display_name: "Top", tier: "mid", followers: 50000, avg_engagement_rate: 4.0 },
            { id: "c2", handle: "@low", display_name: "Low", tier: "micro", followers: 10000, avg_engagement_rate: 2.0 },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { creator_id: "c1", status: "confirmed", agreed_rate: 10000, content_status: "approved" },
            { creator_id: "c2", status: "confirmed", agreed_rate: 8000, content_status: "submitted" },
          ]);
        }
        if (table === "campaign_geo_snapshots") {
          return mockQueryBuilder([]);
        }
        if (table === "content_submissions") {
          return mockQueryBuilder([]);
        }
        if (table === "campaign_reports") {
          // upsert
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignReporterTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", report_type: "final" },
      execOpts
    )) as {
      report_type: string;
      executive_summary: {
        total_spend: number;
        total_revenue: number;
        overall_roi: number;
      };
      per_creator_breakdown: { handle: string; roi: number }[];
      recommendations: {
        rebook_creators: string[];
        phase_out_creators: string[];
        ambassador_candidates: string[];
      };
    };

    expect(result.report_type).toBe("final");
    expect(result.executive_summary.total_spend).toBe(18000);
    expect(result.executive_summary.total_revenue).toBe(63000);
    expect(result.executive_summary.overall_roi).toBe(3.5); // 63000/18000
    // @top has 6x ROI with 25 orders → rebook + ambassador
    expect(result.recommendations.rebook_creators).toContain("@top");
    expect(result.recommendations.ambassador_candidates).toContain("@top");
    // @low has 0.38 ROI → phase out
    expect(result.recommendations.phase_out_creators).toContain("@low");
  });
});
