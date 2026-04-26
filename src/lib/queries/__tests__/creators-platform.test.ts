import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  DEFAULT_FILTERS,
  searchCreators,
  type DiscoveryFilters,
} from "../creators";

/* ------------------------------------------------------------------ */
/*  Supabase query-builder mock                                        */
/* ------------------------------------------------------------------ */

function makeSupabase() {
  const calls: { table: string; filters: Record<string, unknown> } = {
    table: "",
    filters: {},
  };

  const chain: Record<string, unknown> = {};
  const record = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls.filters[name] = args;
      return chain;
    });

  chain.select = record("select");
  chain.eq = record("eq");
  chain.or = record("or");
  chain.in = record("in");
  chain.gte = record("gte");
  chain.lte = record("lte");
  chain.order = record("order");
  chain.range = record("range");
  // Return final shape from the promise
  const promised = Promise.resolve({ data: [], count: 0, error: null });
  chain.range = vi.fn(() => promised);

  const supabase = {
    from: vi.fn((tableName: string) => {
      calls.table = tableName;
      return chain;
    }),
  };

  return { supabase, calls, chain };
}

describe("searchCreators — platform routing", () => {
  let env: ReturnType<typeof makeSupabase>;

  beforeEach(() => {
    env = makeSupabase();
  });

  it("routes 'all' to the blended leaderboard view", async () => {
    const filters: DiscoveryFilters = { ...DEFAULT_FILTERS, platform: "all" };
    // @ts-expect-error — mock Supabase client is a stub for the typed one
    await searchCreators(env.supabase, filters, "cpi", 0, 10);
    expect(env.calls.table).toBe("mv_creator_leaderboard_blended");
    expect(env.chain.eq).not.toHaveBeenCalledWith("platform", expect.anything());
  });

  it("routes 'instagram' to per-platform view with eq filter", async () => {
    const filters: DiscoveryFilters = {
      ...DEFAULT_FILTERS,
      platform: "instagram",
    };
    // @ts-expect-error — mock Supabase client is a stub for the typed one
    await searchCreators(env.supabase, filters, "cpi", 0, 10);
    expect(env.calls.table).toBe("mv_creator_leaderboard");
    expect(env.chain.eq).toHaveBeenCalledWith("platform", "instagram");
  });

  it("routes 'youtube' to per-platform view with eq filter", async () => {
    const filters: DiscoveryFilters = {
      ...DEFAULT_FILTERS,
      platform: "youtube",
    };
    // @ts-expect-error — mock Supabase client is a stub for the typed one
    await searchCreators(env.supabase, filters, "cpi", 0, 10);
    expect(env.calls.table).toBe("mv_creator_leaderboard");
    expect(env.chain.eq).toHaveBeenCalledWith("platform", "youtube");
  });

  it("DEFAULT_FILTERS defaults platform to 'all'", () => {
    expect(DEFAULT_FILTERS.platform).toBe("all");
  });
});
