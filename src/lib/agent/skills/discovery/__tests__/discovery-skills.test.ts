import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookalikeFinder } from "../lookalike-finder";
import { competitorMapperTool } from "../competitor-mapper";
import { audienceOverlapCheckTool } from "../audience-overlap-check";
import { geoOpportunityFinderTool } from "../geo-opportunity-finder";
import { warmLeadDetectorTool } from "../warm-lead-detector";

/* ------------------------------------------------------------------ */
/*  Supabase Mock Helpers                                              */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

/**
 * Creates a chainable Supabase query builder mock.
 * Tracks `.single()` to unwrap array → first element (matching real Supabase).
 */
function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or", "order", "limit",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => {
    isSingle = true;
    return builder;
  });
  // Thenable — when awaited, resolve with { data, error }
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

function createMockSupabase(fromMap: Record<string, MockRow[] | null>) {
  return {
    from: vi.fn((table: string) => {
      const tableData = table in fromMap ? fromMap[table] : [];
      return mockQueryBuilder(tableData);
    }),
  } as unknown as Parameters<typeof lookalikeFinder>[1];
}

/* ------------------------------------------------------------------ */
/*  Lookalike Finder                                                   */
/* ------------------------------------------------------------------ */

describe("lookalike-finder", () => {
  const brandId = "brand-1";

  it("returns error when reference creator not found", async () => {
    const supabase = createMockSupabase({
      mv_creator_leaderboard: null,
    });
    const t = lookalikeFinder(brandId, supabase);
    const result = await t.execute(
      { creator_id: "missing-id", limit: 10 },
      { toolCallId: "tc1", messages: [], abortSignal: undefined as never }
    );
    expect(result).toHaveProperty("error", "Reference creator not found");
  });

  it("returns empty results when no candidates in same niche", async () => {
    // First call returns reference, second call returns empty candidates
    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return mockQueryBuilder([
            {
              id: "c1",
              handle: "@ref",
              followers: 50000,
              tier: "mid",
              cpi: 72,
              avg_engagement_rate: 3.5,
              primary_niche: "rare_niche",
              city: "Mumbai",
              country: "India",
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof lookalikeFinder>[1];

    const t = lookalikeFinder(brandId, supabase);
    const result = await t.execute(
      { creator_id: "c1", limit: 10 },
      { toolCallId: "tc2", messages: [], abortSignal: undefined as never }
    );
    expect(result).toHaveProperty("count", 0);
    expect(result).toHaveProperty("results");
    expect((result as { results: unknown[] }).results).toHaveLength(0);
  });

  it("scores and ranks candidates by similarity", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          // Reference creator (single)
          return mockQueryBuilder([
            {
              id: "ref",
              handle: "@ref",
              followers: 50000,
              tier: "mid",
              cpi: 70,
              avg_engagement_rate: 3.0,
              primary_niche: "fashion",
              city: "Mumbai",
              country: "India",
            },
          ]);
        }
        if (callCount === 2) {
          // Candidates
          return mockQueryBuilder([
            {
              id: "c1",
              handle: "@similar",
              display_name: "Similar",
              followers: 48000,
              tier: "mid",
              cpi: 68,
              avg_engagement_rate: 3.2,
              primary_niche: "fashion",
              city: "Mumbai",
              country: "India",
              is_verified: false,
            },
            {
              id: "c2",
              handle: "@different",
              display_name: "Different",
              followers: 500000,
              tier: "macro",
              cpi: 30,
              avg_engagement_rate: 1.0,
              primary_niche: "fashion",
              city: "Delhi",
              country: "India",
              is_verified: false,
            },
          ]);
        }
        // Brand matches
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof lookalikeFinder>[1];

    const t = lookalikeFinder(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "ref", limit: 10 },
      { toolCallId: "tc3", messages: [], abortSignal: undefined as never }
    )) as {
      results: { id: string; similarity_score: number }[];
      count: number;
      reference: Record<string, unknown>;
    };

    expect(result.count).toBe(2);
    expect(result.reference.handle).toBe("@ref");
    // Similar creator should rank higher
    expect(result.results[0].id).toBe("c1");
    expect(result.results[0].similarity_score).toBeGreaterThan(
      result.results[1].similarity_score
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Competitor Mapper                                                  */
/* ------------------------------------------------------------------ */

describe("competitor-mapper", () => {
  const brandId = "brand-1";

  it("returns error when brand not found", async () => {
    // Pass empty array so .single() unwraps to null
    const supabase = createMockSupabase({ brands: [] });
    const t = competitorMapperTool(brandId, supabase);
    const result = await t.execute(
      { limit: 15 },
      { toolCallId: "tc1", messages: [], abortSignal: undefined as never }
    );
    expect(result).toHaveProperty("error", "Brand not found");
  });

  it("returns error when no competitors configured", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return mockQueryBuilder([
            { brand_name: "TestBrand", competitor_brands: [] },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof competitorMapperTool>[1];

    const t = competitorMapperTool(brandId, supabase);
    const result = await t.execute(
      { limit: 15 },
      { toolCallId: "tc2", messages: [], abortSignal: undefined as never }
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("No competitor brands");
  });

  it("finds creators mentioning competitor brands", async () => {
    const tableData: Record<string, MockRow[]> = {
      brands: [
        {
          brand_name: "MyBrand",
          competitor_brands: ["RivalCo", "CompetitorX"],
        },
      ],
      caption_intelligence: [
        {
          creator_id: "c1",
          organic_brand_mentions: ["RivalCo skincare"],
          paid_brand_mentions: [],
        },
        {
          creator_id: "c2",
          organic_brand_mentions: [],
          paid_brand_mentions: ["CompetitorX serum"],
        },
        {
          creator_id: "c3",
          organic_brand_mentions: ["UnrelatedBrand"],
          paid_brand_mentions: [],
        },
      ],
      mv_creator_leaderboard: [
        {
          id: "c1",
          handle: "@creator1",
          display_name: "Creator1",
          followers: 50000,
          tier: "mid",
          cpi: 70,
          avg_engagement_rate: 3.0,
          primary_niche: "beauty",
          city: "Mumbai",
        },
        {
          id: "c2",
          handle: "@creator2",
          display_name: "Creator2",
          followers: 80000,
          tier: "mid",
          cpi: 65,
          avg_engagement_rate: 2.5,
          primary_niche: "skincare",
          city: "Delhi",
        },
      ],
      creator_brand_matches: [],
    };
    const supabase = {
      from: vi.fn((table: string) => mockQueryBuilder(tableData[table] ?? [])),
    } as unknown as Parameters<typeof competitorMapperTool>[1];

    const t = competitorMapperTool(brandId, supabase);
    const result = (await t.execute(
      { limit: 15 },
      { toolCallId: "tc3", messages: [], abortSignal: undefined as never }
    )) as {
      competitors: string[];
      results: {
        id: string;
        competitor_mentions: { organic: string[]; paid: string[] };
      }[];
      count: number;
    };

    expect(result.competitors).toEqual(["RivalCo", "CompetitorX"]);
    expect(result.count).toBe(2);
    // c3 should be filtered out (no competitor mention)
    const ids = result.results.map((r) => r.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
    expect(ids).not.toContain("c3");
  });

  it("accepts specific competitor_name parameter", async () => {
    const tableData: Record<string, MockRow[]> = {
      brands: [
        {
          brand_name: "MyBrand",
          competitor_brands: ["RivalCo", "CompetitorX"],
        },
      ],
      caption_intelligence: [
        {
          creator_id: "c1",
          organic_brand_mentions: ["RivalCo skincare"],
          paid_brand_mentions: [],
        },
      ],
      mv_creator_leaderboard: [
        {
          id: "c1",
          handle: "@c1",
          display_name: "C1",
          followers: 10000,
          tier: "micro",
          cpi: 80,
          avg_engagement_rate: 5.0,
          primary_niche: "beauty",
          city: "Pune",
        },
      ],
      creator_brand_matches: [],
    };
    const supabase = {
      from: vi.fn((table: string) => mockQueryBuilder(tableData[table] ?? [])),
    } as unknown as Parameters<typeof competitorMapperTool>[1];

    const t = competitorMapperTool(brandId, supabase);
    const result = (await t.execute(
      { competitor_name: "RivalCo", limit: 15 },
      { toolCallId: "tc4", messages: [], abortSignal: undefined as never }
    )) as { competitors: string[] };

    // Should only search for specified competitor, not the full list
    expect(result.competitors).toEqual(["RivalCo"]);
  });
});

/* ------------------------------------------------------------------ */
/*  Audience Overlap Check                                             */
/* ------------------------------------------------------------------ */

describe("audience-overlap-check", () => {
  const brandId = "brand-1";

  it("returns error when fewer than 2 creators found", async () => {
    const supabase = createMockSupabase({
      mv_creator_leaderboard: [
        { id: "c1", handle: "@c1", followers: 10000, tier: "micro", primary_niche: "beauty" },
      ],
    });
    const t = audienceOverlapCheckTool(brandId, supabase);
    const result = await t.execute(
      { creator_ids: ["c1", "c2"] },
      { toolCallId: "tc1", messages: [], abortSignal: undefined as never }
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Only found 1");
  });

  it("returns overlap data for creator pairs", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@c1", followers: 50000, tier: "mid", primary_niche: "beauty" },
            { id: "c2", handle: "@c2", followers: 60000, tier: "mid", primary_niche: "fashion" },
          ]);
        }
        if (table === "audience_overlaps") {
          return mockQueryBuilder([
            {
              creator_a_id: "c1",
              creator_b_id: "c2",
              shared_commenters: 1200,
              jaccard_similarity: 0.18,
              overlap_coefficient: 0.25,
              overlap_level: "moderate",
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof audienceOverlapCheckTool>[1];

    const t = audienceOverlapCheckTool(brandId, supabase);
    const result = (await t.execute(
      { creator_ids: ["c1", "c2"] },
      { toolCallId: "tc2", messages: [], abortSignal: undefined as never }
    )) as {
      creators: { id: string }[];
      overlaps: { jaccard_similarity: number; overlap_level: string }[];
      pairs_analyzed: number;
      high_overlap_pairs: number;
    };

    expect(result.creators).toHaveLength(2);
    expect(result.pairs_analyzed).toBe(1);
    expect(result.overlaps[0].jaccard_similarity).toBe(0.18);
    expect(result.high_overlap_pairs).toBe(1); // 0.18 > 0.15
  });

  it("reports unknown for pairs without overlap data", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@c1", followers: 50000, tier: "mid", primary_niche: "beauty" },
            { id: "c2", handle: "@c2", followers: 60000, tier: "mid", primary_niche: "beauty" },
          ]);
        }
        // No overlap data
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof audienceOverlapCheckTool>[1];

    const t = audienceOverlapCheckTool(brandId, supabase);
    const result = (await t.execute(
      { creator_ids: ["c1", "c2"] },
      { toolCallId: "tc3", messages: [], abortSignal: undefined as never }
    )) as {
      overlaps: { overlap_level: string; note?: string }[];
    };

    expect(result.overlaps).toHaveLength(1);
    expect(result.overlaps[0].overlap_level).toBe("unknown");
    expect(result.overlaps[0].note).toContain("No overlap data");
  });
});

/* ------------------------------------------------------------------ */
/*  Geo Opportunity Finder                                             */
/* ------------------------------------------------------------------ */

describe("geo-opportunity-finder", () => {
  const brandId = "brand-1";

  it("returns empty when no geographic gaps found", async () => {
    const supabase = createMockSupabase({ brand_shopify_geo: [] });
    const t = geoOpportunityFinderTool(brandId, supabase);
    const result = await t.execute(
      { min_gap_score: 0.3, min_cpi: 50, limit: 10 },
      { toolCallId: "tc1", messages: [], abortSignal: undefined as never }
    );
    expect(result).toHaveProperty("count", 0);
    expect((result as { message: string }).message).toContain("No significant geographic gaps");
  });

  it("matches gap regions with available creators", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "brand_shopify_geo") {
          return mockQueryBuilder([
            {
              city: "Bangalore",
              state: "Karnataka",
              country: "India",
              sessions: 5000,
              orders: 20,
              revenue: 50000,
              conversion_rate: 0.4,
              gap_score: 0.8,
              problem_type: "low_conversion",
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1",
              handle: "@bangalore_creator",
              display_name: "BLR Creator",
              followers: 40000,
              tier: "mid",
              cpi: 75,
              avg_engagement_rate: 4.0,
              primary_niche: "lifestyle",
              city: "Bangalore",
              country: "India",
            },
          ]);
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            { creator_id: "c1", match_score: 82 },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof geoOpportunityFinderTool>[1];

    const t = geoOpportunityFinderTool(brandId, supabase);
    const result = (await t.execute(
      { min_gap_score: 0.3, min_cpi: 50, limit: 10 },
      { toolCallId: "tc2", messages: [], abortSignal: undefined as never }
    )) as {
      results: {
        region: { city: string };
        gap_analysis: { gap_score: number; problem_type: string };
        available_creators: { id: string; match_score: number | null }[];
        creator_count: number;
      }[];
      regions_analyzed: number;
      regions_with_creators: number;
    };

    expect(result.regions_analyzed).toBe(1);
    expect(result.regions_with_creators).toBe(1);
    expect(result.results[0].region.city).toBe("Bangalore");
    expect(result.results[0].gap_analysis.problem_type).toBe("low_conversion");
    expect(result.results[0].available_creators).toHaveLength(1);
    expect(result.results[0].available_creators[0].match_score).toBe(82);
  });

  it("handles regions with no matching creators", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brand_shopify_geo") {
          return mockQueryBuilder([
            {
              city: "RemoteCity",
              state: "RemoteState",
              country: "India",
              sessions: 100,
              orders: 0,
              revenue: 0,
              conversion_rate: 0,
              gap_score: 0.95,
              problem_type: "no_presence",
            },
          ]);
        }
        // No creators in this region
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof geoOpportunityFinderTool>[1];

    const t = geoOpportunityFinderTool(brandId, supabase);
    const result = (await t.execute(
      { min_gap_score: 0.3, min_cpi: 50, limit: 10 },
      { toolCallId: "tc3", messages: [], abortSignal: undefined as never }
    )) as {
      results: { creator_count: number }[];
      regions_with_creators: number;
    };

    expect(result.results[0].creator_count).toBe(0);
    expect(result.regions_with_creators).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Warm Lead Detector                                                 */
/* ------------------------------------------------------------------ */

describe("warm-lead-detector", () => {
  const brandId = "brand-1";

  it("returns empty when no brand mentioners found", async () => {
    const supabase = createMockSupabase({ creator_brand_matches: [] });
    const t = warmLeadDetectorTool(brandId, supabase);
    const result = await t.execute(
      { min_match_score: 50, limit: 15 },
      { toolCallId: "tc1", messages: [], abortSignal: undefined as never }
    );
    expect(result).toHaveProperty("count", 0);
    expect((result as { message: string }).message).toContain("No warm leads found");
  });

  it("filters out already-contacted creators", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              match_score: 85,
              niche_fit_score: 80,
              audience_geo_score: 70,
              match_reasoning: "Organic mention",
              already_mentions_brand: true,
              mentions_competitor: false,
            },
            {
              creator_id: "c2",
              match_score: 75,
              niche_fit_score: 70,
              audience_geo_score: 60,
              match_reasoning: "Organic mention",
              already_mentions_brand: true,
              mentions_competitor: false,
            },
          ]);
        }
        if (table === "outreach_messages") {
          // c1 has been contacted already
          return mockQueryBuilder([{ creator_id: "c1" }]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c2",
              handle: "@warm_lead",
              display_name: "Warm Lead",
              followers: 30000,
              tier: "micro",
              cpi: 80,
              avg_engagement_rate: 5.0,
              primary_niche: "beauty",
              city: "Pune",
              country: "India",
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof warmLeadDetectorTool>[1];

    const t = warmLeadDetectorTool(brandId, supabase);
    const result = (await t.execute(
      { min_match_score: 50, limit: 15 },
      { toolCallId: "tc2", messages: [], abortSignal: undefined as never }
    )) as {
      results: { id: string; is_warm_lead: boolean }[];
      count: number;
      total_mentioners: number;
      already_contacted: number;
      un_contacted: number;
    };

    expect(result.total_mentioners).toBe(2);
    expect(result.already_contacted).toBe(1);
    expect(result.un_contacted).toBe(1);
    expect(result.count).toBe(1);
    expect(result.results[0].id).toBe("c2");
    expect(result.results[0].is_warm_lead).toBe(true);
  });

  it("returns message when all mentioners already contacted", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              match_score: 85,
              already_mentions_brand: true,
            },
          ]);
        }
        if (table === "outreach_messages") {
          return mockQueryBuilder([{ creator_id: "c1" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as Parameters<typeof warmLeadDetectorTool>[1];

    const t = warmLeadDetectorTool(brandId, supabase);
    const result = (await t.execute(
      { min_match_score: 50, limit: 15 },
      { toolCallId: "tc3", messages: [], abortSignal: undefined as never }
    )) as {
      count: number;
      total_mentioners: number;
      already_contacted: number;
      message: string;
    };

    expect(result.count).toBe(0);
    expect(result.total_mentioners).toBe(1);
    expect(result.already_contacted).toBe(1);
    expect(result.message).toContain("all 1 have already been contacted");
  });
});
