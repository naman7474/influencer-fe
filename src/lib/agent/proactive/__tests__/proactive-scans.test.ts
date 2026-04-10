import { describe, it, expect, vi } from "vitest";
import { scanNewMatchingCreators, scanReengagementOpportunities } from "../weekly-scan";
import { generateRelationshipHealth } from "../monthly-scan";

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
});
