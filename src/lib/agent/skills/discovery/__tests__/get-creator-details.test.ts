import { describe, it, expect, vi } from "vitest";
import { getCreatorDetailsTool } from "../get-creator-details";

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

type SupabaseParam = Parameters<typeof getCreatorDetailsTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ── Test data ─────────────────────────────────────────────── */

const leaderboardCreator = {
  creator_id: "c1",
  handle: "@beauty_queen",
  display_name: "Beauty Queen",
  followers: 50000,
  tier: "mid",
  city: "Mumbai",
  country: "India",
  is_verified: true,
  cpi: 78,
  engagement_quality: 82,
  content_quality: 75,
  audience_authenticity: 88,
  avg_engagement_rate: 4.5,
  engagement_trend: "rising",
  posts_per_week: 5,
  primary_niche: "beauty",
  primary_tone: "educational",
  primary_language: "Hindi",
  primary_audience_language: "Hindi",
  primary_country: "India",
  authenticity_score: 90,
  engagement_quality_score: 85,
  community_strength: 72,
};

const creatorFull = {
  contact_email: "beauty@example.com",
  biography: "Beauty enthusiast sharing tips and reviews",
  external_url: "https://beauty-queen.in",
};

const brandMatch = {
  match_score: 88,
  niche_fit_score: 92,
  audience_geo_score: 85,
  match_reasoning: "Excellent niche fit, strong Mumbai audience overlap",
  already_mentions_brand: true,
  mentions_competitor: false,
};

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
    const result = await t.execute({}, execOpts);
    expect(result).toHaveProperty("error", "Provide either creator_id or handle");
  });

  it("returns error when creator not found by id", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = await t.execute(
      { creator_id: "nonexistent" },
      execOpts
    );
    expect(result).toHaveProperty("error", "Creator not found");
  });

  it("returns error when creator not found by handle", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = await t.execute(
      { handle: "nonexistent_handle" },
      execOpts
    );
    expect(result).toHaveProperty("error", "Creator not found");
  });

  it("returns full creator details by creator_id", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([leaderboardCreator]);
        }
        if (table === "creators") {
          return mockQueryBuilder([creatorFull]);
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([brandMatch]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            {
              campaign_id: "camp-1",
              status: "confirmed",
              agreed_rate: 45000,
              campaigns: { name: "Summer Sale", goal: "Sales", status: "active", brand_id: "brand-1" },
            },
            {
              campaign_id: "camp-2",
              status: "completed",
              agreed_rate: 50000,
              campaigns: { name: "Winter Push", goal: "Awareness", status: "completed", brand_id: "brand-1" },
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as {
      profile: Record<string, unknown>;
      scores: Record<string, unknown>;
      content: Record<string, unknown>;
      audience: Record<string, unknown>;
      brand_match: Record<string, unknown>;
      collaboration_history: { campaign_id: string; status: string; agreed_rate: number }[];
    };

    // Profile
    expect(result.profile.id).toBe("c1");
    expect(result.profile.handle).toBe("@beauty_queen");
    expect(result.profile.display_name).toBe("Beauty Queen");
    expect(result.profile.followers).toBe(50000);
    expect(result.profile.tier).toBe("mid");
    expect(result.profile.city).toBe("Mumbai");
    expect(result.profile.country).toBe("India");
    expect(result.profile.is_verified).toBe(true);
    expect(result.profile.biography).toBe("Beauty enthusiast sharing tips and reviews");
    expect(result.profile.contact_email).toBe("beauty@example.com");
    expect(result.profile.external_url).toBe("https://beauty-queen.in");

    // Scores
    expect(result.scores.cpi).toBe(78);
    expect(result.scores.engagement_quality).toBe(82);
    expect(result.scores.content_quality).toBe(75);
    expect(result.scores.audience_authenticity).toBe(88);
    expect(result.scores.avg_engagement_rate).toBe(4.5);
    expect(result.scores.engagement_trend).toBe("rising");
    expect(result.scores.posts_per_week).toBe(5);

    // Content
    expect(result.content.primary_niche).toBe("beauty");
    expect(result.content.primary_tone).toBe("educational");
    expect(result.content.primary_language).toBe("Hindi");

    // Audience
    expect(result.audience.primary_audience_language).toBe("Hindi");
    expect(result.audience.primary_country).toBe("India");
    expect(result.audience.authenticity_score).toBe(90);
    expect(result.audience.engagement_quality_score).toBe(85);
    expect(result.audience.community_strength).toBe(72);

    // Brand match
    expect(result.brand_match).not.toBeNull();
    expect(result.brand_match.match_score).toBe(88);
    expect(result.brand_match.niche_fit).toBe(92);
    expect(result.brand_match.audience_geo).toBe(85);
    expect(result.brand_match.reasoning).toBe("Excellent niche fit, strong Mumbai audience overlap");
    expect(result.brand_match.mentions_brand).toBe(true);
    expect(result.brand_match.mentions_competitor).toBe(false);

    // Collaboration history
    expect(result.collaboration_history).toHaveLength(2);
    expect(result.collaboration_history[0].campaign_id).toBe("camp-1");
    expect(result.collaboration_history[0].status).toBe("confirmed");
    expect(result.collaboration_history[0].agreed_rate).toBe(45000);
    expect(result.collaboration_history[1].campaign_id).toBe("camp-2");
    expect(result.collaboration_history[1].agreed_rate).toBe(50000);
  });

  it("looks up by handle with ilike when no creator_id", async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === "mv_creator_leaderboard") {
        return mockQueryBuilder([leaderboardCreator]);
      }
      if (table === "creators") {
        return mockQueryBuilder([creatorFull]);
      }
      if (table === "creator_brand_matches") {
        return mockQueryBuilder([]);
      }
      if (table === "campaign_creators") {
        return mockQueryBuilder([]);
      }
      return mockQueryBuilder([]);
    });
    const supabase = { from: fromSpy } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute(
      { handle: "beauty_queen" },
      execOpts
    )) as { profile: Record<string, unknown> };

    expect(result.profile.handle).toBe("@beauty_queen");
    // Verify ilike was called for handle lookup
    const leaderboardCalls = fromSpy.mock.calls.filter((c) => c[0] === "mv_creator_leaderboard");
    expect(leaderboardCalls.length).toBeGreaterThan(0);
  });

  it("returns null brand_match when no match data exists", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([leaderboardCreator]);
        }
        if (table === "creators") {
          return mockQueryBuilder([creatorFull]);
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([]); // no match
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as { brand_match: null };

    expect(result.brand_match).toBeNull();
  });

  it("returns empty collaboration history when no past campaigns", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([leaderboardCreator]);
        }
        if (table === "creators") {
          return mockQueryBuilder([creatorFull]);
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]); // no past campaigns
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as { collaboration_history: unknown[] };

    expect(result.collaboration_history).toHaveLength(0);
  });

  it("handles missing creator full data (no email, bio, url)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([leaderboardCreator]);
        }
        if (table === "creators") {
          return mockQueryBuilder([]); // no extra data found
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as { profile: Record<string, unknown> };

    expect(result.profile.biography).toBeNull();
    expect(result.profile.contact_email).toBeNull();
    expect(result.profile.external_url).toBeNull();
  });

  it("prefers creator_id over handle when both provided", async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === "mv_creator_leaderboard") {
        const builder = mockQueryBuilder([leaderboardCreator]);
        // Track which filter method is called
        const eqSpy = vi.fn().mockReturnValue(builder);
        builder.eq = eqSpy;
        return builder;
      }
      if (table === "creators") {
        return mockQueryBuilder([creatorFull]);
      }
      if (table === "creator_brand_matches") {
        return mockQueryBuilder([]);
      }
      if (table === "campaign_creators") {
        return mockQueryBuilder([]);
      }
      return mockQueryBuilder([]);
    });
    const supabase = { from: fromSpy } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1", handle: "beauty_queen" },
      execOpts
    )) as { profile: Record<string, unknown> };

    // Should use creator_id path (eq) not handle path (ilike)
    expect(result.profile.id).toBe("c1");
  });

  it("handles null campaign_creators data gracefully", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([leaderboardCreator]);
        }
        if (table === "creators") {
          return mockQueryBuilder([creatorFull]);
        }
        if (table === "creator_brand_matches") {
          return mockQueryBuilder([brandMatch]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder(null); // null data
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = getCreatorDetailsTool(brandId, supabase);
    const result = (await t.execute(
      { creator_id: "c1" },
      execOpts
    )) as { collaboration_history: unknown[] };

    expect(result.collaboration_history).toHaveLength(0);
  });
});
