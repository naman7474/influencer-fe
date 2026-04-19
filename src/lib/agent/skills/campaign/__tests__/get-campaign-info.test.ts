import { describe, it, expect, vi } from "vitest";
import { getCampaignInfoTool } from "../get-campaign-info";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit", "not",
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

type SupabaseParam = Parameters<typeof getCampaignInfoTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Single campaign fetch                                              */
/* ------------------------------------------------------------------ */

describe("get-campaign-info — single campaign", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "nonexistent", include_creators: true },
      execOpts
    );
    expect(result).toHaveProperty("error", "Campaign not found");
  });

  it("returns campaign with creators and performance summary", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Summer Sale",
              goal: "Drive sales",
              status: "active",
              total_budget: 200000,
              budget_per_creator: 50000,
              start_date: "2025-06-01",
              end_date: "2025-07-01",
              target_regions: ["Mumbai", "Delhi"],
              target_niches: ["beauty"],
              content_format: "reels",
              brand_id: "brand-1",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            {
              id: "cc1",
              creator_id: "c1",
              status: "confirmed",
              agreed_rate: 45000,
              match_score_at_assignment: 85,
              content_status: "delivered",
              creators: {
                handle: "@beauty_queen",
                display_name: "Beauty Queen",
                followers: 50000,
                tier: "mid",
              },
            },
            {
              id: "cc2",
              creator_id: "c2",
              status: "shortlisted",
              agreed_rate: null,
              match_score_at_assignment: 72,
              content_status: null,
              creators: {
                handle: "@glow_guru",
                display_name: "Glow Guru",
                followers: 30000,
                tier: "micro",
              },
            },
          ]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              total_revenue: 150000,
              total_orders: 45,
              creator_cost: 45000,
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_creators: true },
      execOpts
    )) as {
      campaign: Record<string, unknown>;
      creators: { creator_id: string; handle: string; status: string; agreed_rate: number | null; content_status: string | null }[];
      performance_summary: {
        total_revenue: number;
        total_orders: number;
        total_spend: number;
        roi: number;
        per_creator: unknown[];
      };
    };

    // Campaign fields
    expect(result.campaign.id).toBe("camp-1");
    expect(result.campaign.name).toBe("Summer Sale");
    expect(result.campaign.goal).toBe("Drive sales");
    expect(result.campaign.status).toBe("active");
    expect(result.campaign.total_budget).toBe(200000);
    expect(result.campaign.budget_per_creator).toBe(50000);
    expect(result.campaign.start_date).toBe("2025-06-01");
    expect(result.campaign.end_date).toBe("2025-07-01");
    expect(result.campaign.target_regions).toEqual(["Mumbai", "Delhi"]);
    expect(result.campaign.target_niches).toEqual(["beauty"]);
    expect(result.campaign.content_format).toBe("reels");

    // Creators
    expect(result.creators).toHaveLength(2);
    expect(result.creators[0].creator_id).toBe("c1");
    expect(result.creators[0].handle).toBe("@beauty_queen");
    expect(result.creators[0].status).toBe("confirmed");
    expect(result.creators[0].agreed_rate).toBe(45000);
    expect(result.creators[0].content_status).toBe("delivered");

    expect(result.creators[1].creator_id).toBe("c2");
    expect(result.creators[1].handle).toBe("@glow_guru");
    expect(result.creators[1].status).toBe("shortlisted");
    expect(result.creators[1].agreed_rate).toBeNull();

    // Performance summary
    expect(result.performance_summary.total_revenue).toBe(150000);
    expect(result.performance_summary.total_orders).toBe(45);
    expect(result.performance_summary.total_spend).toBe(45000);
    expect(result.performance_summary.roi).toBe(3.3); // 150000 / 45000 = 3.333...
    expect(result.performance_summary.per_creator).toHaveLength(1);
  });

  it("excludes creators when include_creators is false", async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === "campaigns") {
        return mockQueryBuilder([
          {
            id: "camp-1",
            name: "Test",
            goal: "Awareness",
            status: "draft",
            total_budget: 100000,
            budget_per_creator: null,
            start_date: "2025-06-01",
            end_date: "2025-07-01",
            target_regions: null,
            target_niches: null,
            content_format: null,
          },
        ]);
      }
      if (table === "campaign_performance_summary") {
        return mockQueryBuilder([]);
      }
      // Should NOT be called for campaign_creators
      return mockQueryBuilder([]);
    });

    const supabase = { from: fromSpy } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_creators: false },
      execOpts
    )) as {
      campaign: Record<string, unknown>;
      creators: unknown[];
      performance_summary: Record<string, unknown>;
    };

    expect(result.campaign.id).toBe("camp-1");
    expect(result.creators).toHaveLength(0);

    // Verify campaign_creators was NOT queried
    const calledTables = fromSpy.mock.calls.map((c) => c[0]);
    expect(calledTables).not.toContain("campaign_creators");
  });

  it("computes ROI=0 when total_spend is 0", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "No Spend",
              goal: "Awareness",
              status: "draft",
              total_budget: 100000,
              budget_per_creator: null,
              start_date: null,
              end_date: null,
              target_regions: null,
              target_niches: null,
              content_format: null,
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([]); // no performance data
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_creators: true },
      execOpts
    )) as {
      performance_summary: {
        total_revenue: number;
        total_orders: number;
        total_spend: number;
        roi: number;
      };
    };

    expect(result.performance_summary.total_revenue).toBe(0);
    expect(result.performance_summary.total_orders).toBe(0);
    expect(result.performance_summary.total_spend).toBe(0);
    expect(result.performance_summary.roi).toBe(0);
  });

  it("handles multiple performance rows (aggregation)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Multi Creator",
              goal: "Sales",
              status: "active",
              total_budget: 500000,
              budget_per_creator: 100000,
              start_date: "2025-06-01",
              end_date: "2025-08-01",
              target_regions: null,
              target_niches: null,
              content_format: null,
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { creator_id: "c1", total_revenue: 100000, total_orders: 20, creator_cost: 50000 },
            { creator_id: "c2", total_revenue: 200000, total_orders: 40, creator_cost: 75000 },
            { creator_id: "c3", total_revenue: 50000, total_orders: 10, creator_cost: 25000 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_creators: false },
      execOpts
    )) as {
      performance_summary: {
        total_revenue: number;
        total_orders: number;
        total_spend: number;
        roi: number;
        per_creator: unknown[];
      };
    };

    expect(result.performance_summary.total_revenue).toBe(350000);
    expect(result.performance_summary.total_orders).toBe(70);
    expect(result.performance_summary.total_spend).toBe(150000);
    expect(result.performance_summary.roi).toBe(2.3); // 350000 / 150000 = 2.333...
    expect(result.performance_summary.per_creator).toHaveLength(3);
  });

  it("handles performance rows with null values gracefully", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Partial Data",
              goal: "Awareness",
              status: "active",
              total_budget: 100000,
              budget_per_creator: null,
              start_date: null,
              end_date: null,
              target_regions: null,
              target_niches: null,
              content_format: null,
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { creator_id: "c1", total_revenue: null, total_orders: null, creator_cost: null },
            { creator_id: "c2", total_revenue: 50000, total_orders: 10, creator_cost: 20000 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", include_creators: false },
      execOpts
    )) as {
      performance_summary: {
        total_revenue: number;
        total_orders: number;
        total_spend: number;
        roi: number;
      };
    };

    // Null values should be treated as 0
    expect(result.performance_summary.total_revenue).toBe(50000);
    expect(result.performance_summary.total_orders).toBe(10);
    expect(result.performance_summary.total_spend).toBe(20000);
    expect(result.performance_summary.roi).toBe(2.5);
  });
});

/* ------------------------------------------------------------------ */
/*  List campaigns                                                     */
/* ------------------------------------------------------------------ */

describe("get-campaign-info — list campaigns", () => {
  const brandId = "brand-1";

  it("returns list of campaigns when no campaign_id provided", async () => {
    const supabase = {
      from: vi.fn(() =>
        mockQueryBuilder([
          {
            id: "camp-1",
            name: "Summer Sale",
            goal: "Sales",
            status: "active",
            total_budget: 200000,
            start_date: "2025-06-01",
            end_date: "2025-07-01",
            created_at: "2025-05-15T00:00:00Z",
          },
          {
            id: "camp-2",
            name: "Winter Push",
            goal: "Awareness",
            status: "draft",
            total_budget: 100000,
            start_date: "2025-12-01",
            end_date: "2026-01-01",
            created_at: "2025-04-01T00:00:00Z",
          },
        ])
      ),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { include_creators: true },
      execOpts
    )) as { campaigns: MockRow[]; count: number };

    expect(result.campaigns).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(result.campaigns[0].name).toBe("Summer Sale");
    expect(result.campaigns[1].name).toBe("Winter Push");
  });

  it("returns empty list when no campaigns exist", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { include_creators: true },
      execOpts
    )) as { campaigns: MockRow[]; count: number };

    expect(result.campaigns).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("handles null data from supabase gracefully", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder(null)),
    } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { include_creators: true },
      execOpts
    )) as { campaigns: MockRow[]; count: number };

    expect(result.campaigns).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("filters by status when provided", async () => {
    const fromSpy = vi.fn(() =>
      mockQueryBuilder([
        {
          id: "camp-1",
          name: "Active Campaign",
          goal: "Sales",
          status: "active",
          total_budget: 200000,
          start_date: "2025-06-01",
          end_date: "2025-07-01",
          created_at: "2025-05-15T00:00:00Z",
        },
      ])
    );
    const supabase = { from: fromSpy } as unknown as SupabaseParam;

    const t = getCampaignInfoTool(brandId, supabase);
    const result = (await t.execute(
      { status: "active", include_creators: true },
      execOpts
    )) as { campaigns: MockRow[]; count: number };

    expect(result.campaigns).toHaveLength(1);
    expect(result.count).toBe(1);
    // Verify the query was filtered by status (eq was called with "status", "active")
  });
});
