import { describe, it, expect, vi } from "vitest";
import { scanNewMatchingCreators, scanReengagementOpportunities, scanAmbassadorCandidates } from "../weekly-scan";
import { generateRelationshipHealth, generatePerformanceTrends } from "../monthly-scan";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = []) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit", "insert",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockReturnValue(builder);
  builder.then = (resolve: (v: unknown) => void) =>
    resolve({ data, error: null });
  return builder;
}

type SupabaseParam = Parameters<typeof scanNewMatchingCreators>[0];

/* ------------------------------------------------------------------ */
/*  Weekly Scan Tests                                                  */
/* ------------------------------------------------------------------ */

describe("weekly-scan", () => {
  it("creates notifications for brands with new matches", async () => {
    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1", brand_name: "Test" }]);
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            { creator_id: "c1", match_score: 85 },
            { creator_id: "c2", match_score: 72 },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await scanNewMatchingCreators(supabase);
    expect(results).toHaveLength(1);
    expect(results[0].brandId).toBe("brand-1");
    expect(results[0].newMatches).toBe(2);
    expect(insertMock).toHaveBeenCalled();
  });

  it("skips brands with no new matches", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1", brand_name: "Test" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await scanNewMatchingCreators(supabase);
    expect(results).toHaveLength(0);
  });

  it("finds re-engagement opportunities", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 120);

    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1" }]);
        }
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              lifetime_roi: 3.5,
              last_campaign_completed: oldDate.toISOString(),
            },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await scanReengagementOpportunities(supabase);
    expect(results).toHaveLength(1);
    expect(results[0].opportunities).toBe(1);
  });
});

describe("weekly-scan: scanAmbassadorCandidates", () => {
  it("identifies ambassador candidates with high ROI and campaigns", async () => {
    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1" }]);
        }
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            { creator_id: "c1" },
            { creator_id: "c2" },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await scanAmbassadorCandidates(supabase);
    expect(results).toHaveLength(1);
    expect(results[0].candidates).toBe(2);
    expect(insertMock).toHaveBeenCalled();
  });

  it("skips brands with no ambassador candidates", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await scanAmbassadorCandidates(supabase);
    expect(results).toHaveLength(0);
  });

  it("handles null brands", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder(null)),
    } as unknown as SupabaseParam;

    const results = await scanAmbassadorCandidates(supabase);
    expect(results).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Monthly Scan Tests                                                 */
/* ------------------------------------------------------------------ */

describe("monthly-scan", () => {
  it("generates relationship health reports", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 150);

    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1", brand_name: "Test" }]);
        }
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              total_campaigns: 3,
              lifetime_roi: 4.0,
              last_campaign_completed: new Date().toISOString(),
              reply_count: 3,
            },
            {
              creator_id: "c2",
              total_campaigns: 1,
              lifetime_roi: 0.5,
              last_campaign_completed: oldDate.toISOString(),
              reply_count: 0,
            },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await generateRelationshipHealth(supabase);
    expect(results).toHaveLength(1);
    expect(results[0].totalCreators).toBe(2);
    expect(results[0].atRisk).toBe(1); // c2 has low ROI and old date
  });

  it("skips brands with no relationships", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1", brand_name: "Test" }]);
        }
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await generateRelationshipHealth(supabase);
    expect(results).toHaveLength(0);
  });

  it("skips notifications when no at-risk relationships", async () => {
    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1" }]);
        }
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              total_campaigns: 3,
              lifetime_roi: 5.0,
              last_campaign_completed: new Date().toISOString(),
              reply_count: 5,
            },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await generateRelationshipHealth(supabase);
    expect(results).toHaveLength(1);
    expect(results[0].atRisk).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("handles null brands data", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder(null)),
    } as unknown as SupabaseParam;

    const results = await generateRelationshipHealth(supabase);
    expect(results).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Monthly Performance Trends Tests                                   */
/* ------------------------------------------------------------------ */

describe("monthly-scan: generatePerformanceTrends", () => {
  it("creates notifications for active campaigns with orders", async () => {
    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1" }]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "camp-1", name: "Summer Drop" }]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { total_revenue: 50000, total_orders: 25, creator_cost: 10000 },
            { total_revenue: 30000, total_orders: 10, creator_cost: 5000 },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await generatePerformanceTrends(supabase);
    expect(results).toHaveLength(1);
    expect(results[0].activeCampaigns).toBe(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent_insight",
        title: expect.stringContaining("Summer Drop"),
      })
    );
  });

  it("skips brands with no active campaigns", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1" }]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await generatePerformanceTrends(supabase);
    expect(results).toHaveLength(0);
  });

  it("skips notification when campaign has zero orders", async () => {
    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "brand-1" }]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "camp-1", name: "Empty Campaign" }]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { total_revenue: 0, total_orders: 0, creator_cost: 0 },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await generatePerformanceTrends(supabase);
    expect(results).toHaveLength(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("handles null brands data", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder(null)),
    } as unknown as SupabaseParam;

    const results = await generatePerformanceTrends(supabase);
    expect(results).toHaveLength(0);
  });

  it("handles multiple brands and campaigns", async () => {
    const insertMock = vi.fn().mockReturnValue(mockQueryBuilder([]));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") {
          return mockQueryBuilder([{ id: "b1" }, { id: "b2" }]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "c1", name: "Camp1" }, { id: "c2", name: "Camp2" }]);
        }
        if (table === "campaign_performance_summary") {
          return mockQueryBuilder([
            { total_revenue: 10000, total_orders: 5, creator_cost: 2000 },
          ]);
        }
        if (table === "notifications") {
          const b = mockQueryBuilder([]);
          b.insert = insertMock;
          return b;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const results = await generatePerformanceTrends(supabase);
    expect(results).toHaveLength(2);
    // Each brand has 2 campaigns with orders, so 4 notifications total
    expect(insertMock).toHaveBeenCalledTimes(4);
  });
});
