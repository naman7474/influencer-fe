import { describe, it, expect, vi } from "vitest";
import { creatorSearchTool } from "../creator-search";

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

type SupabaseParam = Parameters<typeof creatorSearchTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Creator Search                                                     */
/* ------------------------------------------------------------------ */

describe("creator-search", () => {
  const brandId = "brand-1";

  it("returns error message when RPC fails", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Function not found" },
      }),
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute(
      { query: "beauty", limit: 10 },
      execOpts
    )) as { results: unknown[]; count: number; error: string };

    expect(result.results).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.error).toContain("Search failed");
    expect(result.error).toContain("Function not found");
  });

  it("returns no-results message when no creators match", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute(
      { query: "nonexistent_niche", limit: 10 },
      execOpts
    )) as { results: unknown[]; count: number; message: string };

    expect(result.results).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.message).toContain("No creators found");
    expect(result.message).toContain("broadening your filters");
  });

  it("returns null data as empty results", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute(
      { query: "test", limit: 10 },
      execOpts
    )) as { results: unknown[]; count: number; message: string };

    expect(result.results).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("returns creators with brand match scores", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "c1",
            handle: "@beauty_queen",
            display_name: "Beauty Queen",
            followers: 50000,
            tier: "mid",
            cpi: 75,
            avg_engagement_rate: 4.5,
            primary_niche: "beauty",
            primary_spoken_language: "Hindi",
            city: "Mumbai",
            country: "India",
            is_verified: true,
            total_count: 42,
          },
          {
            id: "c2",
            handle: "@glow_guru",
            display_name: "Glow Guru",
            followers: 30000,
            tier: "micro",
            cpi: 68,
            avg_engagement_rate: 3.8,
            primary_niche: "beauty",
            primary_spoken_language: "English",
            city: "Delhi",
            country: "India",
            is_verified: false,
            total_count: 42,
          },
        ],
        error: null,
      }),
      from: vi.fn((table: string) => {
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            {
              creator_id: "c1",
              match_score: 88,
              niche_fit_score: 90,
              audience_geo_score: 85,
              match_reasoning: "Strong niche fit with high engagement",
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute(
      { niche: "beauty", limit: 10 },
      execOpts
    )) as {
      results: {
        id: string;
        handle: string;
        display_name: string;
        followers: number;
        tier: string;
        cpi_score: number;
        engagement_rate: number;
        niche: string;
        language: string;
        city: string;
        country: string;
        is_verified: boolean;
        match_score: number | null;
        match_reasoning: string | null;
      }[];
      count: number;
      total_in_database: number;
    };

    expect(result.count).toBe(2);
    expect(result.total_in_database).toBe(42);

    // c1 has match score, should be first (sorted by match_score desc)
    expect(result.results[0].id).toBe("c1");
    expect(result.results[0].handle).toBe("@beauty_queen");
    expect(result.results[0].display_name).toBe("Beauty Queen");
    expect(result.results[0].followers).toBe(50000);
    expect(result.results[0].tier).toBe("mid");
    expect(result.results[0].cpi_score).toBe(75);
    expect(result.results[0].engagement_rate).toBe(4.5);
    expect(result.results[0].niche).toBe("beauty");
    expect(result.results[0].language).toBe("Hindi");
    expect(result.results[0].city).toBe("Mumbai");
    expect(result.results[0].country).toBe("India");
    expect(result.results[0].is_verified).toBe(true);
    expect(result.results[0].match_score).toBe(88);
    expect(result.results[0].match_reasoning).toBe("Strong niche fit with high engagement");

    // c2 has no match score
    expect(result.results[1].id).toBe("c2");
    expect(result.results[1].match_score).toBeNull();
    expect(result.results[1].match_reasoning).toBeNull();
  });

  it("sorts by match_score first, then cpi_score", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", handle: "@low_match", display_name: "Low", followers: 10000, tier: "micro", cpi: 90, avg_engagement_rate: 5.0, primary_niche: "beauty", primary_spoken_language: "Hindi", city: "Mumbai", country: "India", is_verified: false, total_count: 3 },
          { id: "c2", handle: "@high_match", display_name: "High", followers: 20000, tier: "micro", cpi: 60, avg_engagement_rate: 3.0, primary_niche: "beauty", primary_spoken_language: "English", city: "Delhi", country: "India", is_verified: false, total_count: 3 },
          { id: "c3", handle: "@no_match", display_name: "NoMatch", followers: 15000, tier: "micro", cpi: 80, avg_engagement_rate: 4.0, primary_niche: "beauty", primary_spoken_language: "Tamil", city: "Chennai", country: "India", is_verified: false, total_count: 3 },
        ],
        error: null,
      }),
      from: vi.fn((table: string) => {
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            { creator_id: "c1", match_score: 50, niche_fit_score: 60, audience_geo_score: 55, match_reasoning: "Low match" },
            { creator_id: "c2", match_score: 95, niche_fit_score: 90, audience_geo_score: 88, match_reasoning: "High match" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute({ limit: 10 }, execOpts)) as {
      results: { id: string; match_score: number | null; cpi_score: number }[];
    };

    // c2 has match_score 95 → first
    expect(result.results[0].id).toBe("c2");
    // c3 has no match_score but cpi 80 → second
    expect(result.results[1].id).toBe("c3");
    // c1 has match_score 50 → third
    expect(result.results[2].id).toBe("c1");
  });

  it("passes correct parameters to RPC function", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute(
      {
        query: "fitness",
        niche: "health",
        min_followers: 10000,
        max_followers: 100000,
        tier: "micro" as const,
        city: "Mumbai",
        country: "India",
        language: "Hindi",
        min_cpi: 60,
        limit: 15,
      },
      execOpts
    );

    expect(rpcSpy).toHaveBeenCalledWith("fn_search_creators", {
      p_query: "fitness",
      p_niche: "health",
      p_min_followers: 10000,
      p_max_followers: 100000,
      p_min_cpi: 60,
      p_tier: "micro",
      p_city: "Mumbai",
      p_country: "India",
      p_language: "Hindi",
      p_limit: 15,
      p_offset: 0,
    });
  });

  it("caps limit at 25", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute({ limit: 100 }, execOpts);

    expect(rpcSpy).toHaveBeenCalledWith(
      "fn_search_creators",
      expect.objectContaining({ p_limit: 25 })
    );
  });

  it("defaults limit to 10 when not provided", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute({ limit: 10 }, execOpts);

    expect(rpcSpy).toHaveBeenCalledWith(
      "fn_search_creators",
      expect.objectContaining({ p_limit: 10 })
    );
  });

  it("passes null for optional empty params", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute({ limit: 10 }, execOpts);

    expect(rpcSpy).toHaveBeenCalledWith(
      "fn_search_creators",
      expect.objectContaining({
        p_query: null,
        p_niche: null,
        p_min_followers: null,
        p_max_followers: null,
        p_min_cpi: null,
        p_tier: null,
        p_city: null,
        p_country: null,
        p_language: null,
      })
    );
  });

  it("uses total_count from first creator row when available", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", handle: "@test", display_name: "Test", followers: 10000, tier: "micro", cpi: 70, avg_engagement_rate: 3.0, primary_niche: "beauty", primary_spoken_language: "Hindi", city: "Mumbai", country: "India", is_verified: false, total_count: 157 },
        ],
        error: null,
      }),
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute({ limit: 10 }, execOpts)) as {
      total_in_database: number;
      count: number;
    };

    expect(result.total_in_database).toBe(157);
    expect(result.count).toBe(1);
  });

  it("handles creators without brand matches (all null)", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", handle: "@solo", display_name: "Solo", followers: 5000, tier: "nano", cpi: 50, avg_engagement_rate: 2.0, primary_niche: "food", primary_spoken_language: "Tamil", city: "Chennai", country: "India", is_verified: false, total_count: 1 },
        ],
        error: null,
      }),
      from: vi.fn(() => mockQueryBuilder([])), // no matches
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute({ limit: 10 }, execOpts)) as {
      results: { match_score: null; match_reasoning: null }[];
    };

    expect(result.results[0].match_score).toBeNull();
    expect(result.results[0].match_reasoning).toBeNull();
  });
});
