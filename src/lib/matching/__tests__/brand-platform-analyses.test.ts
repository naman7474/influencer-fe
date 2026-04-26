import { describe, it, expect, vi } from "vitest";

import { computeMatchesForBrand } from "../engine";

/**
 * This test validates the one behavior we introduced in the multi-platform
 * migration: `computeMatchesForBrand` now reads from `brand_platform_analyses`
 * in addition to the legacy `brands.ig_*` shadow columns, preferring the new
 * table when present. We intentionally keep the mock narrow — we want to
 * verify the query shape, not the full scoring algorithm (which the rest of
 * engine.test.ts already covers).
 */

function makeSupabase(options: {
  brand: Record<string, unknown>;
  platformAnalysis: Record<string, unknown> | null;
  leaderboard?: Record<string, unknown>[];
}) {
  const queries: Array<{ table: string; filters: unknown[] }> = [];

  const tableResults: Record<string, unknown> = {
    brands: { data: options.brand, error: null },
    brand_platform_analyses: {
      data: options.platformAnalysis,
      error: null,
    },
    brand_shopify_geo: { data: [], error: null },
    mv_creator_leaderboard: {
      data: options.leaderboard ?? [],
      error: null,
    },
    creator_scores: { data: [], error: null },
    caption_intelligence: { data: [], error: null },
    transcript_intelligence: { data: [], error: null },
    audience_intelligence: { data: [], error: null },
    creators: { data: [], error: null },
    creator_brand_matches: { data: [], error: null },
  };

  function buildChain(table: string) {
    const filters: unknown[] = [];
    const chain: Record<string, unknown> = {};
    const recorder =
      (name: string) =>
      (...args: unknown[]) => {
        filters.push({ op: name, args });
        return chain;
      };
    chain.select = recorder("select");
    chain.eq = recorder("eq");
    chain.in = recorder("in");
    chain.order = recorder("order");
    chain.limit = recorder("limit");
    chain.maybeSingle = () => {
      queries.push({ table, filters });
      return Promise.resolve(tableResults[table] ?? { data: null });
    };
    chain.single = () => {
      queries.push({ table, filters });
      return Promise.resolve(tableResults[table] ?? { data: null });
    };
    // Thenable so `await chain` resolves like a query result.
    chain.then = (resolve: (v: unknown) => unknown) => {
      queries.push({ table, filters });
      return resolve(tableResults[table] ?? { data: [] });
    };
    chain.upsert = vi.fn(() => Promise.resolve({ error: null }));
    chain.delete = vi.fn(() => chain);
    return chain;
  }

  return {
    supabase: {
      from: (t: string) => buildChain(t),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    },
    queries,
  };
}

describe("computeMatchesForBrand — brand_platform_analyses fallback", () => {
  it("queries brand_platform_analyses for the IG row", async () => {
    const { supabase, queries } = makeSupabase({
      brand: {
        id: "b1",
        brand_name: "Brand",
        content_embedding: null,
        ig_collaborators: [],
        ig_content_dna: null,
        content_format_pref: "any",
        past_collaborations: [],
        competitor_brands: [],
      },
      platformAnalysis: null,
      leaderboard: [],
    });
    // @ts-expect-error — mock shape
    await computeMatchesForBrand(supabase, "b1", 10);
    const bpaQueries = queries.filter(
      (q) => q.table === "brand_platform_analyses"
    );
    // Phase 2: engine now fetches ALL platforms from brand_platform_analyses
    // (no platform=instagram eq filter) and iterates the set in a loop.
    expect(bpaQueries.length).toBeGreaterThanOrEqual(1);
    const firstBpa = bpaQueries[0];
    const eqFilters = (firstBpa.filters as Array<{ op: string; args: unknown[] }>)
      .filter((f) => f.op === "eq");
    const brandFilter = eqFilters.find((f) => f.args[0] === "brand_id");
    expect(brandFilter?.args[1]).toBe("b1");
    // The old test asserted eq('platform','instagram'); the refactor
    // removed that filter so the engine can see every analyzed platform.
    const platformFilter = eqFilters.find((f) => f.args[0] === "platform");
    expect(platformFilter).toBeUndefined();
  });

  it("falls back to brand.ig_collaborators when platformAnalysis is null", async () => {
    const { supabase } = makeSupabase({
      brand: {
        id: "b1",
        brand_name: "Brand",
        content_embedding: [0.1, 0.2],
        ig_collaborators: ["@friend"],
        ig_content_dna: { recurring_topics: ["tech"] },
        content_format_pref: "any",
        past_collaborations: [],
        competitor_brands: [],
      },
      platformAnalysis: null,
      leaderboard: [],
    });
    // Should not throw — fallback path is exercised
    // @ts-expect-error — mock shape
    const result = await computeMatchesForBrand(supabase, "b1", 10);
    expect(typeof result).toBe("number");
  });
});
