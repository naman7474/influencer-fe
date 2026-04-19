import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateRelationshipHealth,
  generatePerformanceTrends,
} from "../monthly-scan";

/* ------------------------------------------------------------------ */
/*  Supabase mock helpers                                              */
/* ------------------------------------------------------------------ */

type MockFromReturn = Record<string, any>;

function createSupabaseMock(config: {
  brands?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  campaigns?: Record<string, unknown>[];
  performance?: Record<string, unknown>[];
  insertFn?: ReturnType<typeof vi.fn>;
}) {
  const {
    brands = [],
    relationships = [],
    campaigns = [],
    performance = [],
  } = config;
  const insertFn = config.insertFn ?? vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn().mockImplementation((table: string): MockFromReturn => {
      if (table === "brands") {
        return {
          select: vi.fn().mockResolvedValue({ data: brands, error: null }),
        };
      }
      if (table === "mv_creator_relationship_summary") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: relationships,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "campaigns") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: campaigns,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "campaign_performance_summary") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: performance,
              error: null,
            }),
          }),
        };
      }
      if (table === "notifications") {
        return {
          insert: insertFn,
        };
      }
      return {};
    }),
    _insertFn: insertFn,
  };
}

/* ------------------------------------------------------------------ */
/*  generateRelationshipHealth tests                                   */
/* ------------------------------------------------------------------ */

describe("generateRelationshipHealth", () => {
  it("returns empty array when there are no brands", async () => {
    const mock = createSupabaseMock({ brands: [] });
    const results = await generateRelationshipHealth(mock as any);
    expect(results).toEqual([]);
  });

  it("skips brands with no creator relationships", async () => {
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1", brand_name: "TestBrand" }],
      relationships: [],
    });
    const results = await generateRelationshipHealth(mock as any);
    expect(results).toEqual([]);
  });

  it("identifies at-risk creators with old last_campaign_completed", async () => {
    // Date 200 days ago (beyond 120-day cutoff)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200);

    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1", brand_name: "TestBrand" }],
      relationships: [
        {
          creator_id: "c1",
          total_campaigns: 3,
          lifetime_roi: 2.5,
          last_campaign_completed: oldDate.toISOString(),
          reply_count: 5,
        },
        {
          creator_id: "c2",
          total_campaigns: 1,
          lifetime_roi: 3.0,
          last_campaign_completed: new Date().toISOString(),
          reply_count: 2,
        },
      ],
      insertFn,
    });

    const results = await generateRelationshipHealth(mock as any);
    expect(results).toHaveLength(1);
    expect(results[0].brandId).toBe("brand-1");
    expect(results[0].totalCreators).toBe(2);
    expect(results[0].atRisk).toBe(1);
    // Should create a notification for at-risk relationships
    expect(insertFn).toHaveBeenCalled();
  });

  it("identifies at-risk creators with low ROI", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1", brand_name: "TestBrand" }],
      relationships: [
        {
          creator_id: "c1",
          total_campaigns: 2,
          lifetime_roi: 0.5, // below 1
          last_campaign_completed: new Date().toISOString(),
          reply_count: 3,
        },
      ],
      insertFn,
    });

    const results = await generateRelationshipHealth(mock as any);
    expect(results).toHaveLength(1);
    expect(results[0].atRisk).toBe(1);
    expect(insertFn).toHaveBeenCalled();
  });

  it("does not create notification when no at-risk creators", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1", brand_name: "TestBrand" }],
      relationships: [
        {
          creator_id: "c1",
          total_campaigns: 2,
          lifetime_roi: 5.0,
          last_campaign_completed: new Date().toISOString(),
          reply_count: 10,
        },
      ],
      insertFn,
    });

    const results = await generateRelationshipHealth(mock as any);
    expect(results).toHaveLength(1);
    expect(results[0].atRisk).toBe(0);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("handles null last_campaign_completed gracefully", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1", brand_name: "TestBrand" }],
      relationships: [
        {
          creator_id: "c1",
          total_campaigns: 1,
          lifetime_roi: 2.0,
          last_campaign_completed: null,
          reply_count: 1,
        },
      ],
      insertFn,
    });

    const results = await generateRelationshipHealth(mock as any);
    // null last_campaign_completed: condition `last && last < cutoff` is false
    // roi = 2.0 >= 1 so not at risk
    expect(results).toHaveLength(1);
    expect(results[0].atRisk).toBe(0);
  });

  it("handles null lifetime_roi as 0 (at-risk)", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1", brand_name: "TestBrand" }],
      relationships: [
        {
          creator_id: "c1",
          total_campaigns: 1,
          lifetime_roi: null, // treated as 0 < 1 -> at risk
          last_campaign_completed: new Date().toISOString(),
          reply_count: 1,
        },
      ],
      insertFn,
    });

    const results = await generateRelationshipHealth(mock as any);
    expect(results[0].atRisk).toBe(1);
    expect(insertFn).toHaveBeenCalled();
  });

  it("processes multiple brands", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [
        { id: "brand-1", brand_name: "Brand1" },
        { id: "brand-2", brand_name: "Brand2" },
      ],
      relationships: [
        {
          creator_id: "c1",
          total_campaigns: 2,
          lifetime_roi: 3.0,
          last_campaign_completed: new Date().toISOString(),
          reply_count: 5,
        },
      ],
      insertFn,
    });

    const results = await generateRelationshipHealth(mock as any);
    // Both brands get the same mock relationships
    expect(results).toHaveLength(2);
  });

  it("handles brands query returning null data", async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    const results = await generateRelationshipHealth(mock as any);
    expect(results).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  generatePerformanceTrends tests                                    */
/* ------------------------------------------------------------------ */

describe("generatePerformanceTrends", () => {
  it("returns empty array when there are no brands", async () => {
    const mock = createSupabaseMock({ brands: [] });
    const results = await generatePerformanceTrends(mock as any);
    expect(results).toEqual([]);
  });

  it("skips brands with no active campaigns", async () => {
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1" }],
      campaigns: [],
    });
    const results = await generatePerformanceTrends(mock as any);
    expect(results).toEqual([]);
  });

  it("creates notification for campaigns with orders", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1" }],
      campaigns: [{ id: "camp-1", name: "Summer Sale" }],
      performance: [
        { total_revenue: 50000, total_orders: 25, creator_cost: 10000 },
        { total_revenue: 30000, total_orders: 15, creator_cost: 8000 },
      ],
      insertFn,
    });

    const results = await generatePerformanceTrends(mock as any);
    expect(results).toHaveLength(1);
    expect(results[0].activeCampaigns).toBe(1);
    expect(insertFn).toHaveBeenCalled();
  });

  it("does not create notification when total orders is 0", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1" }],
      campaigns: [{ id: "camp-1", name: "No Orders Campaign" }],
      performance: [
        { total_revenue: 0, total_orders: 0, creator_cost: 5000 },
      ],
      insertFn,
    });

    const results = await generatePerformanceTrends(mock as any);
    expect(results).toHaveLength(1);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("handles null performance values gracefully", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1" }],
      campaigns: [{ id: "camp-1", name: "Test" }],
      performance: [
        { total_revenue: null, total_orders: null, creator_cost: null },
      ],
      insertFn,
    });

    const results = await generatePerformanceTrends(mock as any);
    expect(results).toHaveLength(1);
    // totalOrders will be 0 (null || 0), so no notification
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("handles empty performance data", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const mock = createSupabaseMock({
      brands: [{ id: "brand-1" }],
      campaigns: [{ id: "camp-1", name: "Test" }],
      performance: [],
      insertFn,
    });

    const results = await generatePerformanceTrends(mock as any);
    expect(results).toHaveLength(1);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("handles brands query returning null", async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    const results = await generatePerformanceTrends(mock as any);
    expect(results).toEqual([]);
  });
});
