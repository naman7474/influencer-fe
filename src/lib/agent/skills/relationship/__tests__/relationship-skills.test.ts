import { describe, it, expect, vi } from "vitest";
import { relationshipScorerTool } from "../relationship-scorer";
import { reengagementRecommenderTool } from "../reengagement-recommender";
import { ambassadorIdentifierTool } from "../ambassador-identifier";
import { churnPredictorTool } from "../churn-predictor";

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

type SupabaseParam = Parameters<typeof relationshipScorerTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Relationship Scorer                                                */
/* ------------------------------------------------------------------ */

describe("relationship-scorer", () => {
  const brandId = "brand-1";

  it("returns no_history when no relationship data", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@c1", display_name: "C1", tier: "mid", followers: 50000, cpi: 70 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = relationshipScorerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as { status: string; relationship_score: number };
    expect(result.status).toBe("no_history");
    expect(result.relationship_score).toBe(0);
  });

  it("scores a strong relationship correctly", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 15); // 15 days ago

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              brand_id: "brand-1",
              total_campaigns: 4,
              total_spend: 200000,
              total_revenue: 800000,
              total_orders: 100,
              reply_count: 4,
              lifetime_roi: 4.0,
              last_campaign_completed: recentDate.toISOString(),
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@top_creator", display_name: "Top", tier: "mid", followers: 50000, cpi: 85 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = relationshipScorerTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      relationship_score: number;
      status: string;
      breakdown: Record<string, number>;
    };

    expect(result.relationship_score).toBeGreaterThan(60);
    expect(["excellent", "strong"]).toContain(result.status);
    expect(result.breakdown.roi_performance).toBe(30); // ROI 4x → max
    expect(result.breakdown.recency).toBe(25); // 15 days → max
  });
});

/* ------------------------------------------------------------------ */
/*  Reengagement Recommender                                           */
/* ------------------------------------------------------------------ */

describe("reengagement-recommender", () => {
  const brandId = "brand-1";

  it("returns empty when no high performers found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = reengagementRecommenderTool(brandId, supabase);
    const result = (await t.execute(
      { min_roi: 1.5, inactive_days: 90, limit: 10 },
      execOpts
    )) as { count: number; message: string };
    expect(result.count).toBe(0);
    expect(result.message).toContain("No past creators found");
  });

  it("finds inactive high performers", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 120); // 120 days ago

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              brand_id: "brand-1",
              total_campaigns: 3,
              total_spend: 100000,
              total_revenue: 400000,
              lifetime_roi: 4.0,
              last_campaign_completed: oldDate.toISOString(),
              reply_count: 3,
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1",
              handle: "@past_star",
              display_name: "Past Star",
              followers: 60000,
              tier: "mid",
              cpi: 78,
              avg_engagement_rate: 4.0,
              primary_niche: "beauty",
            },
          ]);
        }
        if (table === "outreach_messages") {
          return mockQueryBuilder([]); // no recent outreach
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = reengagementRecommenderTool(brandId, supabase);
    const result = (await t.execute(
      { min_roi: 1.5, inactive_days: 90, limit: 10 },
      execOpts
    )) as {
      results: { handle: string; days_inactive: number; re_engagement_priority: string }[];
      count: number;
    };

    expect(result.count).toBe(1);
    expect(result.results[0].handle).toBe("@past_star");
    expect(result.results[0].days_inactive).toBeGreaterThan(90);
    expect(result.results[0].re_engagement_priority).toBe("high"); // ROI 4x
  });
});

/* ------------------------------------------------------------------ */
/*  Ambassador Identifier                                              */
/* ------------------------------------------------------------------ */

describe("ambassador-identifier", () => {
  const brandId = "brand-1";

  it("returns empty when no ambassadors found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = ambassadorIdentifierTool(brandId, supabase);
    const result = (await t.execute(
      { min_campaigns: 3, min_roi: 2, limit: 10 },
      execOpts
    )) as { count: number; message: string };
    expect(result.count).toBe(0);
  });

  it("identifies and tiers ambassador candidates", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              total_campaigns: 6,
              total_spend: 300000,
              total_revenue: 2000000,
              total_orders: 500,
              lifetime_roi: 6.7,
              last_campaign_completed: new Date().toISOString(),
            },
            {
              creator_id: "c2",
              total_campaigns: 3,
              total_spend: 100000,
              total_revenue: 300000,
              total_orders: 80,
              lifetime_roi: 3.0,
              last_campaign_completed: new Date().toISOString(),
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@platinum", display_name: "Platinum", followers: 100000, tier: "macro", cpi: 90, primary_niche: "beauty", city: "Mumbai" },
            { id: "c2", handle: "@gold", display_name: "Gold", followers: 50000, tier: "mid", cpi: 75, primary_niche: "fashion", city: "Delhi" },
          ]);
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            { creator_id: "c1", match_score: 92, already_mentions_brand: true },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = ambassadorIdentifierTool(brandId, supabase);
    const result = (await t.execute(
      { min_campaigns: 3, min_roi: 2, limit: 10 },
      execOpts
    )) as {
      results: { handle: string; ambassador_tier: string }[];
      count: number;
      summary: { platinum: number; gold: number; silver: number };
    };

    expect(result.count).toBe(2);
    // c1: 6 campaigns, 6.7x ROI → platinum (>= 5 campaigns AND >= 5x ROI)
    const c1 = result.results.find((r) => r.handle === "@platinum");
    expect(c1?.ambassador_tier).toBe("platinum");
    // c2: 3 campaigns, 3x ROI → gold (>= 3x ROI)
    const c2 = result.results.find((r) => r.handle === "@gold");
    expect(c2?.ambassador_tier).toBe("gold");
    expect(result.summary.platinum).toBe(1);
    expect(result.summary.gold).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Churn Predictor                                                    */
/* ------------------------------------------------------------------ */

describe("churn-predictor", () => {
  const brandId = "brand-1";

  it("returns no risk when all relationships are healthy", async () => {
    const recentDate = new Date().toISOString();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              total_campaigns: 3,
              lifetime_roi: 4.0,
              last_campaign_completed: recentDate,
              reply_count: 3,
              total_spend: 100000,
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = churnPredictorTool(brandId, supabase);
    const result = (await t.execute({ limit: 10 }, execOpts)) as {
      count: number;
      message: string;
    };
    expect(result.count).toBe(0);
    expect(result.message).toContain("healthy");
  });

  it("identifies at-risk creators", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200); // 200 days ago

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_relationship_summary") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              total_campaigns: 2,
              lifetime_roi: 0.5,
              last_campaign_completed: oldDate.toISOString(),
              reply_count: 0,
              total_spend: 50000,
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@fading", display_name: "Fading", tier: "micro", followers: 10000, cpi: 40 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = churnPredictorTool(brandId, supabase);
    const result = (await t.execute({ limit: 10 }, execOpts)) as {
      results: {
        handle: string;
        churn_risk: { score: number; level: string; signals: string[] };
        recommendation: string;
      }[];
      count: number;
    };

    expect(result.count).toBe(1);
    expect(result.results[0].handle).toBe("@fading");
    expect(result.results[0].churn_risk.score).toBeGreaterThan(50);
    expect(result.results[0].churn_risk.level).toBe("high");
    expect(result.results[0].churn_risk.signals.length).toBeGreaterThan(0);
    expect(result.results[0].recommendation).toContain("Urgent");
  });
});
