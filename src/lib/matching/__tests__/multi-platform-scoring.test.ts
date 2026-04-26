/**
 * Phase 2 multi-platform scoring regression tests.
 *
 * Exercise the scenarios the refactor enables that were impossible
 * before: multi-platform creators get multiple match rows, brand can
 * opt into a subset of platforms, YT-only creator never appears in
 * the IG pass, etc.
 */
import { describe, it, expect, vi } from "vitest";

import { computeMatchesForBrand } from "../engine";

function chainBuilder(data: unknown[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "in",
    "gte",
    "lte",
    "ilike",
    "or",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];
  for (const m of methods) {
    if (m === "single" || m === "maybeSingle") {
      builder[m] = vi.fn().mockImplementation(() => {
        isSingle = true;
        return builder;
      });
    } else {
      builder[m] = vi.fn().mockReturnValue(builder);
    }
  }
  builder.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.then = (resolve: (v: unknown) => void) => {
    if (isSingle) {
      const d = Array.isArray(data) && data.length > 0 ? data[0] : null;
      resolve({ data: d, error });
    } else {
      resolve({ data, error });
    }
  };
  return builder;
}

const baseBrand = {
  id: "brand-1",
  brand_name: "Brand",
  product_categories: ["tech"],
  content_format_pref: "any",
  budget_per_creator_min: 1000,
  budget_per_creator_max: 50000,
  shipping_zones: ["All India"],
  default_campaign_goal: "awareness",
  competitor_brands: [],
  brand_voice_preference: null,
  min_audience_age: null,
  content_embedding: null,
  ig_collaborators: null,
  ig_content_dna: null,
  past_collaborations: [],
};

const igCreator = {
  creator_id: "c1",
  platform: "instagram",
  handle: "@mkbhd",
  display_name: "MKBHD",
  followers: 20_000_000,
  tier: "mega" as const,
  cpi: 95,
  primary_niche: "tech",
  city: "New Jersey",
  country: "US",
  engagement_quality: 0.05,
};

const ytCreator = {
  creator_id: "c1",  // same creator, different platform
  platform: "youtube",
  handle: "@mkbhd",
  display_name: "MKBHD",
  followers: 19_000_000,  // subscribers
  tier: "mega" as const,
  cpi: 92,
  primary_niche: "tech",
  city: "New Jersey",
  country: "US",
  engagement_quality: 0.04,
};

describe("computeMatchesForBrand — per-platform scoring", () => {
  it("emits one match row per (creator, platform) pair", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([baseBrand]);
        if (table === "brand_platform_analyses")
          return chainBuilder([
            {
              platform: "instagram",
              content_embedding: [0.1, 0.2, 0.3],
              collaborators: [],
              content_dna: null,
              analysis_status: "completed",
            },
            {
              platform: "youtube",
              content_embedding: [0.5, 0.6, 0.7],
              collaborators: [],
              content_dna: null,
              analysis_status: "completed",
            },
          ]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard")
          return chainBuilder([igCreator, ytCreator]);
        if (table === "brand_guidelines")
          return chainBuilder([{ forbidden_topics: [] }]);
        if (table === "creator_content_embeddings")
          return chainBuilder([
            { creator_id: "c1", platform: "instagram", embedding: [0.11, 0.21, 0.31] },
            { creator_id: "c1", platform: "youtube", embedding: [0.51, 0.61, 0.71] },
          ]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    } as never;

    const count = await computeMatchesForBrand(supabase, "brand-1", 10);
    expect(count).toBe(2);
    const batch = upsertMock.mock.calls[0][0];
    const platforms = new Set(batch.map((r: { platform: string }) => r.platform));
    expect(platforms).toEqual(new Set(["instagram", "youtube"]));

    const ig = batch.find((r: { platform: string }) => r.platform === "instagram");
    const yt = batch.find((r: { platform: string }) => r.platform === "youtube");
    expect(ig.used_platform_signals).toEqual({ instagram: true });
    expect(yt.used_platform_signals).toEqual({ youtube: true });
    // Shadow bool: only IG rows get used_ig_signals=true
    expect(ig.used_ig_signals).toBe(true);
    expect(yt.used_ig_signals).toBe(false);
  });

  it("respects opts.platforms to limit scoring to a subset", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    // Capture the `.in("platform", ...)` args so we can assert the
    // engine narrowed the query — the chainBuilder doesn't filter
    // by itself, so checking the emitted .in() call is the real assert.
    const platformInCalls: string[][] = [];
    const recordingBuilder = (tableData: unknown[]) => {
      const b = chainBuilder(tableData);
      const originalIn = b.in as (...args: unknown[]) => unknown;
      b.in = vi.fn((col: string, vals: string[]) => {
        if (col === "platform") platformInCalls.push(vals);
        return originalIn(col, vals);
      });
      return b;
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([baseBrand]);
        if (table === "brand_platform_analyses")
          return chainBuilder([
            {
              platform: "youtube",
              content_embedding: [0.2],
              collaborators: [],
              content_dna: null,
              analysis_status: "completed",
            },
          ]);
        // Return only YT creator — mirrors the .in('platform',['youtube']) filter.
        if (table === "mv_creator_leaderboard")
          return recordingBuilder([ytCreator]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    } as never;

    await computeMatchesForBrand(supabase, "brand-1", 10, {
      platforms: ["youtube"],
    });
    const batch = upsertMock.mock.calls[0][0];
    expect(
      batch.every((r: { platform: string }) => r.platform === "youtube")
    ).toBe(true);
    expect(platformInCalls).toContainEqual(["youtube"]);
  });

  it("falls back to IG single-pass when brand has no analyzed platforms", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([baseBrand]);
        // Empty brand_platform_analyses, no legacy shadow columns set
        if (table === "brand_platform_analyses") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([igCreator]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    } as never;

    await computeMatchesForBrand(supabase, "brand-1", 10);
    const batch = upsertMock.mock.calls[0][0];
    expect(batch[0].platform).toBe("instagram");
    expect(batch[0].used_platform_signals).toEqual({ instagram: false });
    expect(batch[0].match_score_breakdown.weights).toBe("legacy");
  });

  it("synthesizes IG analysis from legacy brand.ig_content_dna shadow", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const brandWithShadow = {
      ...baseBrand,
      content_embedding: [0.1, 0.2, 0.3],
      ig_collaborators: ["@past_collab"],
      ig_content_dna: { recurring_topics: ["tech"] },
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([brandWithShadow]);
        if (table === "brand_platform_analyses") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([igCreator]);
        if (table === "creator_content_embeddings")
          return chainBuilder([
            { creator_id: "c1", platform: "instagram", embedding: [0.11, 0.21, 0.31] },
          ]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    } as never;

    await computeMatchesForBrand(supabase, "brand-1", 10);
    const batch = upsertMock.mock.calls[0][0];
    expect(batch[0].used_ig_signals).toBe(true);
    expect(batch[0].match_score_breakdown.weights).toBe("with_platform_signals");
  });

  it("upserts with platform in the conflict key", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([baseBrand]);
        if (table === "brand_platform_analyses")
          return chainBuilder([
            {
              platform: "instagram",
              content_embedding: [0.1],
              collaborators: [],
              content_dna: null,
              analysis_status: "completed",
            },
          ]);
        if (table === "mv_creator_leaderboard") return chainBuilder([igCreator]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    } as never;

    await computeMatchesForBrand(supabase, "brand-1", 10);
    const opts = upsertMock.mock.calls[0][1];
    expect(opts.onConflict).toBe("creator_id,brand_id,platform");
  });
});
