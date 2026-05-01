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

/**
 * Brief shape returned by `creatorSearchTool` since migration 050.
 * Replaces the old flat `{cpi_score, engagement_rate, match_score, …}`.
 */
interface BriefResult {
  results: Array<{
    id: string;
    handle: string | null;
    display_name: string | null;
    platform: string | null;
    avatar_url: string | null;
    followers: number | null;
    tier: string | null;
    summary?: string;
    why?: string;
    scores?: {
      cpi: number | null;
      er: number | null;
      hook_quality: number | null;
      audience_authenticity: number | null;
      brand_match: number | null;
    };
  }>;
  count: number;
  filters?: Record<string, unknown>;
  total_in_database?: number;
  message?: string;
  error?: string;
}

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
    const result = (await t.execute!(
      { query: "beauty", limit: 10 },
      execOpts,
    )) as BriefResult;

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
    const result = (await t.execute!(
      { query: "nonexistent", limit: 10 },
      execOpts,
    )) as BriefResult;

    expect(result.results).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.message).toMatch(/No creators found/);
  });

  it("returns creators as briefs with scores object and brand match", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "c1",
            handle: "@beauty_queen",
            display_name: "Beauty Queen",
            avatar_url: "https://cdn/beauty.jpg",
            followers: 50000,
            tier: "mid",
            cpi: 75,
            avg_engagement_rate: 0.045,
            primary_niche: "beauty",
            primary_spoken_language: "Hindi",
            city: "Mumbai",
            country: "India",
            is_verified: true,
            platform: "instagram",
            spoken_region: "North India",
            avg_hook_quality: 0.82,
            organic_brand_mentions: ["Lakme", "Maybelline"],
            is_conversion_oriented: true,
            dominant_cta_style: "link_in_bio",
            upload_cadence_days: null,
            audience_authenticity_score: 0.91,
            audience_sentiment: "positive",
            total_count: 42,
          },
          {
            id: "c2",
            handle: "@glow_guru",
            display_name: "Glow Guru",
            avatar_url: null,
            followers: 30000,
            tier: "micro",
            cpi: 68,
            avg_engagement_rate: 0.038,
            primary_niche: "beauty",
            primary_spoken_language: "English",
            city: "Delhi",
            country: "India",
            is_verified: false,
            platform: "instagram",
            spoken_region: null,
            avg_hook_quality: null,
            organic_brand_mentions: null,
            is_conversion_oriented: false,
            dominant_cta_style: null,
            upload_cadence_days: null,
            audience_authenticity_score: null,
            audience_sentiment: null,
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
              match_score: 0.88,
              niche_fit_score: 0.9,
              audience_geo_score: 0.85,
              match_reasoning: "Strong niche fit with high engagement",
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute!(
      { niche: "beauty", limit: 10 },
      execOpts,
    )) as BriefResult;

    expect(result.count).toBe(2);
    expect(result.total_in_database).toBe(42);

    // c1 has the brand match → ranked first.
    expect(result.results[0].id).toBe("c1");
    expect(result.results[0].handle).toBe("@beauty_queen");
    expect(result.results[0].display_name).toBe("Beauty Queen");
    expect(result.results[0].avatar_url).toBe("https://cdn/beauty.jpg");
    expect(result.results[0].followers).toBe(50000);
    expect(result.results[0].tier).toBe("mid");
    expect(result.results[0].platform).toBe("instagram");
    expect(result.results[0].scores?.cpi).toBe(75);
    expect(result.results[0].scores?.er).toBe(0.045);
    expect(result.results[0].scores?.hook_quality).toBe(0.82);
    expect(result.results[0].scores?.brand_match).toBe(0.88);
    // Templated summary should mention niche, language and brand mentions.
    expect(result.results[0].summary).toMatch(/Beauty/);
    expect(result.results[0].summary).toMatch(/Lakme/);

    // c2 has no brand match.
    expect(result.results[1].id).toBe("c2");
    expect(result.results[1].scores?.brand_match).toBeNull();
  });

  it("sorts by brand_match first, then cpi, then followers", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", handle: "@low_match", display_name: "Low", followers: 10000, tier: "micro", cpi: 90, avg_engagement_rate: 0.05, primary_niche: "beauty", primary_spoken_language: "Hindi", city: "Mumbai", country: "India", is_verified: false, platform: "instagram", spoken_region: null, avg_hook_quality: null, organic_brand_mentions: null, is_conversion_oriented: false, dominant_cta_style: null, upload_cadence_days: null, audience_authenticity_score: null, audience_sentiment: null, total_count: 3 },
          { id: "c2", handle: "@high_match", display_name: "High", followers: 20000, tier: "micro", cpi: 60, avg_engagement_rate: 0.03, primary_niche: "beauty", primary_spoken_language: "English", city: "Delhi", country: "India", is_verified: false, platform: "instagram", spoken_region: null, avg_hook_quality: null, organic_brand_mentions: null, is_conversion_oriented: false, dominant_cta_style: null, upload_cadence_days: null, audience_authenticity_score: null, audience_sentiment: null, total_count: 3 },
          { id: "c3", handle: "@no_match", display_name: "NoMatch", followers: 15000, tier: "micro", cpi: 80, avg_engagement_rate: 0.04, primary_niche: "beauty", primary_spoken_language: "Tamil", city: "Chennai", country: "India", is_verified: false, platform: "instagram", spoken_region: null, avg_hook_quality: null, organic_brand_mentions: null, is_conversion_oriented: false, dominant_cta_style: null, upload_cadence_days: null, audience_authenticity_score: null, audience_sentiment: null, total_count: 3 },
        ],
        error: null,
      }),
      from: vi.fn((table: string) => {
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([
            { creator_id: "c1", match_score: 0.5, niche_fit_score: 0.6, audience_geo_score: 0.55, match_reasoning: "Low" },
            { creator_id: "c2", match_score: 0.95, niche_fit_score: 0.9, audience_geo_score: 0.88, match_reasoning: "High" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute!({ limit: 10 }, execOpts)) as BriefResult;

    // c2 (match 0.95) → first, c3 (no match, cpi 80) → second, c1 (match 0.5) → third
    expect(result.results[0].id).toBe("c2");
    expect(result.results[1].id).toBe("c3");
    expect(result.results[2].id).toBe("c1");
  });

  it("forwards all 12 legacy + 11 new RPC params", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute!(
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
        platform: "youtube" as const,
        estimated_region: "North India",
        audience_country: "India",
        audience_language: "Hindi",
        mentions_brand: "NCERT",
        min_hook_quality: 0.7,
        max_engagement_bait: 0.3,
        min_authenticity_score: 0.8,
        dominant_cta_style: "link_in_bio",
        is_conversion_oriented: true,
        min_upload_cadence_days: 1,
        max_upload_cadence_days: 7,
        min_avg_engagement_rate: 0.03,
        limit: 15,
      },
      execOpts,
    );

    expect(rpcSpy).toHaveBeenCalledWith(
      "fn_search_creators",
      expect.objectContaining({
        p_query: "fitness",
        p_niche: "health",
        p_min_followers: 10000,
        p_max_followers: 100000,
        p_min_cpi: 60,
        p_tier: "micro",
        p_city: "Mumbai",
        p_country: "India",
        p_language: "Hindi",
        p_platform: "youtube",
        p_limit: 15,
        p_offset: 0,
        p_estimated_region: "North India",
        p_audience_country: "India",
        p_audience_language: "Hindi",
        p_mentions_brand: "NCERT",
        p_min_hook_quality: 0.7,
        p_max_engagement_bait: 0.3,
        p_min_authenticity_score: 0.8,
        p_dominant_cta_style: "link_in_bio",
        p_is_conversion_oriented: true,
        p_min_upload_cadence_days: 1,
        p_max_upload_cadence_days: 7,
        p_min_avg_engagement_rate: 0.03,
      }),
    );
  });

  it("caps limit at 25", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute!({ limit: 100 }, execOpts);

    expect(rpcSpy).toHaveBeenCalledWith(
      "fn_search_creators",
      expect.objectContaining({ p_limit: 25 }),
    );
  });

  it("defaults limit to 10 when not provided", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute!({ limit: 10 }, execOpts);

    expect(rpcSpy).toHaveBeenCalledWith(
      "fn_search_creators",
      expect.objectContaining({ p_limit: 10 }),
    );
  });

  it("passes null for optional empty params", async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      rpc: rpcSpy,
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    await t.execute!({ limit: 10 }, execOpts);

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
        p_estimated_region: null,
        p_mentions_brand: null,
        p_is_conversion_oriented: null,
      }),
    );
  });

  it("uses total_count from first creator row when available", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", handle: "@test", display_name: "Test", followers: 10000, tier: "micro", cpi: 70, avg_engagement_rate: 0.03, primary_niche: "beauty", primary_spoken_language: "Hindi", city: "Mumbai", country: "India", is_verified: false, platform: "instagram", spoken_region: null, avg_hook_quality: null, organic_brand_mentions: null, is_conversion_oriented: false, dominant_cta_style: null, upload_cadence_days: null, audience_authenticity_score: null, audience_sentiment: null, total_count: 157 },
        ],
        error: null,
      }),
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute!({ limit: 10 }, execOpts)) as BriefResult;

    expect(result.total_in_database).toBe(157);
    expect(result.count).toBe(1);
  });

  it("brand_match is null when there's no creator_brand_matches row", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", handle: "@solo", display_name: "Solo", followers: 5000, tier: "nano", cpi: 50, avg_engagement_rate: 0.02, primary_niche: "food", primary_spoken_language: "Tamil", city: "Chennai", country: "India", is_verified: false, platform: "instagram", spoken_region: null, avg_hook_quality: null, organic_brand_mentions: null, is_conversion_oriented: false, dominant_cta_style: null, upload_cadence_days: null, audience_authenticity_score: null, audience_sentiment: null, total_count: 1 },
        ],
        error: null,
      }),
      from: vi.fn(() => mockQueryBuilder([])), // no matches
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute!({ limit: 10 }, execOpts)) as BriefResult;

    expect(result.results[0].scores?.brand_match).toBeNull();
  });

  it("includes filter recap when filters are set", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "c1", handle: "@x", display_name: "X", followers: 1000, tier: "nano", cpi: 50, avg_engagement_rate: 0.02, primary_niche: "x", primary_spoken_language: "Hindi", city: null, country: null, is_verified: false, platform: "instagram", spoken_region: "North India", avg_hook_quality: 0.8, organic_brand_mentions: null, is_conversion_oriented: false, dominant_cta_style: null, upload_cadence_days: null, audience_authenticity_score: null, audience_sentiment: null, total_count: 1 },
        ],
        error: null,
      }),
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute!(
      {
        estimated_region: "North India",
        min_hook_quality: 0.7,
        limit: 10,
      },
      execOpts,
    )) as BriefResult;

    expect(result.filters).toMatchObject({
      region: "North India",
      min_hook_quality: 0.7,
    });
  });

  it("computes 'why' from active filters that the creator satisfied", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "c1",
            handle: "@m",
            display_name: "M",
            followers: 100000,
            tier: "mid",
            cpi: 70,
            avg_engagement_rate: 0.04,
            primary_niche: "education",
            primary_spoken_language: "Hindi",
            city: null,
            country: "India",
            is_verified: false,
            platform: "youtube",
            spoken_region: "North India",
            avg_hook_quality: 0.86,
            organic_brand_mentions: ["NCERT", "CBSE"],
            is_conversion_oriented: false,
            dominant_cta_style: null,
            upload_cadence_days: 0.6,
            audience_authenticity_score: null,
            audience_sentiment: null,
            total_count: 1,
          },
        ],
        error: null,
      }),
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = creatorSearchTool(brandId, supabase);
    const result = (await t.execute!(
      {
        mentions_brand: "NCERT",
        estimated_region: "North India",
        min_hook_quality: 0.7,
        limit: 10,
      },
      execOpts,
    )) as BriefResult;

    const why = result.results[0].why ?? "";
    expect(why).toMatch(/NCERT/);
    expect(why).toMatch(/North India/);
    expect(why).toMatch(/hook/);
  });
});
