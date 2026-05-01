import { describe, it, expect, vi } from "vitest";
import { getCreatorDetailsTool } from "../get-creator-details";

/* ------------------------------------------------------------------ */
/*  Mock helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

/**
 * Minimal supabase-py-style query-builder stub. The builder is thenable —
 * awaiting it resolves with `{ data, error }`. All chain methods are no-ops
 * that return the same builder.
 */
function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: (v: unknown) => void) => {
    resolve({ data, error });
  };
  return builder;
}

type SupabaseParam = Parameters<typeof getCreatorDetailsTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ── Test fixtures ────────────────────────────────────────────── */

const creatorRow = {
  id: "c1",
  handle: "beauty_queen",
  display_name: "Beauty Queen",
  followers: 50000,
  tier: "mid",
  city: "Mumbai",
  country: "India",
  is_verified: true,
  biography: "Beauty enthusiast",
  contact_email: "beauty@example.com",
  contact_phone: null,
  external_url: "https://beauty-queen.in",
  avatar_url: "https://cdn/avatar.jpg",
  first_scraped_at: "2026-01-01",
  last_scraped_at: "2026-04-15",
};

const igProfile = {
  platform: "instagram",
  handle: "beauty_queen",
  profile_url: "https://instagram.com/beauty_queen",
  display_name: "Beauty Queen",
  followers_or_subs: 50000,
  posts_or_videos_count: 320,
  avatar_url: "https://cdn/avatar.jpg",
  bio: "Beauty enthusiast",
  is_verified: true,
  country: "India",
  category: "Beauty",
  external_links: [],
  last_synced_at: "2026-04-15",
};

const igScores = {
  platform: "instagram",
  cpi: 78,
  avg_engagement_rate: 0.045,
  engagement_quality: 82,
  computed_at: "2026-04-10",
};

const igCaption = {
  platform: "instagram",
  primary_niche: "beauty",
  primary_tone: "educational",
  organic_brand_mentions: ["Lakme"],
  raw_llm_response: { huge: "payload that should be stripped" },
  analyzed_at: "2026-04-10",
};

const igAudience = {
  platform: "instagram",
  primary_audience_language: "Hindi",
  primary_country: "India",
  authenticity_score: 0.9,
  raw_llm_response: { another: "huge payload" },
  analyzed_at: "2026-04-10",
};

const brandMatch = {
  match_score: 0.88,
  niche_fit_score: 0.92,
  audience_geo_score: 0.85,
  match_reasoning: "Strong fit",
  already_mentions_brand: true,
  mentions_competitor: false,
};

interface DetailResult {
  error?: string;
  profile?: Record<string, unknown>;
  social_profiles?: Array<Record<string, unknown>>;
  intelligence_by_platform?: Record<
    string,
    {
      scores: Record<string, unknown> | null;
      caption: Record<string, unknown> | null;
      transcript: Record<string, unknown> | null;
      audience: Record<string, unknown> | null;
    }
  >;
  brand_match?: Record<string, unknown> | null;
  collaboration_history?: Array<Record<string, unknown>>;
}

/**
 * Builds a `from(table)` mock that returns table-specific data so we don't
 * have to construct a full builder per test.
 */
function buildFromMock(rowsByTable: Record<string, MockRow[]>) {
  return vi.fn((table: string) => mockQueryBuilder(rowsByTable[table] ?? []));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("get-creator-details", () => {
  const brandId = "brand-1";

  it("returns error when neither creator_id nor handle is provided", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!({}, execOpts)) as DetailResult;

    expect(result.error).toBe("Provide either creator_id or handle");
  });

  it("returns error when creator not found", async () => {
    const supabase = {
      from: buildFromMock({}),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "missing" },
      execOpts,
    )) as DetailResult;

    expect(result.error).toBe("Creator not found");
  });

  it("resolves by creator_id and returns the profile", async () => {
    const supabase = {
      from: buildFromMock({
        creators: [creatorRow],
        creator_social_profiles: [igProfile],
        creator_scores: [igScores],
        caption_intelligence: [igCaption],
        transcript_intelligence: [],
        audience_intelligence: [igAudience],
        creator_brand_matches: [brandMatch],
        campaign_creators: [],
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "c1" },
      execOpts,
    )) as DetailResult;

    expect(result.profile?.id).toBe("c1");
    expect(result.profile?.handle).toBe("beauty_queen");
    expect(result.profile?.display_name).toBe("Beauty Queen");
    expect(result.profile?.contact_email).toBe("beauty@example.com");
    expect(result.profile?.avatar_url).toBe("https://cdn/avatar.jpg");
  });

  it("returns social_profiles array", async () => {
    const supabase = {
      from: buildFromMock({
        creators: [creatorRow],
        creator_social_profiles: [igProfile],
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "c1" },
      execOpts,
    )) as DetailResult;

    expect(result.social_profiles).toHaveLength(1);
    expect(result.social_profiles?.[0].platform).toBe("instagram");
    expect(result.social_profiles?.[0].handle).toBe("beauty_queen");
  });

  it("returns intelligence_by_platform with the full bundle per platform", async () => {
    const supabase = {
      from: buildFromMock({
        creators: [creatorRow],
        creator_social_profiles: [igProfile],
        creator_scores: [igScores],
        caption_intelligence: [igCaption],
        transcript_intelligence: [],
        audience_intelligence: [igAudience],
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "c1" },
      execOpts,
    )) as DetailResult;

    const ig = result.intelligence_by_platform?.instagram;
    expect(ig?.scores).toMatchObject({ cpi: 78, avg_engagement_rate: 0.045 });
    expect(ig?.caption?.primary_niche).toBe("beauty");
    expect(ig?.caption?.organic_brand_mentions).toEqual(["Lakme"]);
    expect(ig?.audience?.primary_country).toBe("India");
    expect(ig?.transcript).toBeNull();
  });

  it("strips raw_llm_response from intelligence rows to keep payload compact", async () => {
    const supabase = {
      from: buildFromMock({
        creators: [creatorRow],
        caption_intelligence: [igCaption],
        audience_intelligence: [igAudience],
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "c1" },
      execOpts,
    )) as DetailResult;

    expect(
      result.intelligence_by_platform?.instagram.caption?.raw_llm_response,
    ).toBeUndefined();
    expect(
      result.intelligence_by_platform?.instagram.audience?.raw_llm_response,
    ).toBeUndefined();
  });

  it("falls back to creator_social_profiles when handle isn't in creators table", async () => {
    // Direct creators.handle lookup returns nothing; csp join routes us back.
    let creatorsCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "creators") {
          creatorsCallCount += 1;
          // First call: handle lookup → empty.
          // Second call: id lookup → return the row.
          return mockQueryBuilder(creatorsCallCount === 1 ? [] : [creatorRow]);
        }
        if (table === "creator_social_profiles") {
          // First call (during resolution): return creator_id mapping.
          // Subsequent (the parallel fetch): the actual profile row.
          return mockQueryBuilder([{ creator_id: "c1" }, igProfile]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { handle: "beauty_queen" },
      execOpts,
    )) as DetailResult;

    expect(result.error).toBeUndefined();
    expect(result.profile?.id).toBe("c1");
  });

  it("returns brand_match when there's a match row", async () => {
    const supabase = {
      from: buildFromMock({
        creators: [creatorRow],
        creator_brand_matches: [brandMatch],
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "c1" },
      execOpts,
    )) as DetailResult;

    expect(result.brand_match).not.toBeNull();
    expect(result.brand_match?.match_score).toBe(0.88);
    expect(result.brand_match?.reasoning).toBe("Strong fit");
    expect(result.brand_match?.mentions_brand).toBe(true);
  });

  it("returns null brand_match when there's no match row", async () => {
    const supabase = {
      from: buildFromMock({
        creators: [creatorRow],
        creator_brand_matches: [], // no match
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "c1" },
      execOpts,
    )) as DetailResult;

    expect(result.brand_match).toBeNull();
  });

  it("returns collaboration_history flattened to id/status/rate", async () => {
    const campaigns = [
      {
        campaign_id: "camp-1",
        status: "active",
        agreed_rate: 12000,
        campaigns: { name: "Summer", goal: "awareness", status: "active", brand_id: brandId },
      },
    ];
    const supabase = {
      from: buildFromMock({
        creators: [creatorRow],
        campaign_creators: campaigns,
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute!(
      { creator_id: "c1" },
      execOpts,
    )) as DetailResult;

    expect(result.collaboration_history).toHaveLength(1);
    expect(result.collaboration_history?.[0]).toEqual({
      campaign_id: "camp-1",
      status: "active",
      agreed_rate: 12000,
    });
  });
});
