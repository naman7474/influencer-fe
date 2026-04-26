import { describe, it, expect, vi } from "vitest";

import { getCreatorByHandle } from "../creator-detail";

/**
 * Chainable Supabase mock supporting the subset of methods our reader
 * uses: select, eq, order, limit, maybeSingle, thenable.
 */
function makeTableResolver(
  resolvers: Record<string, { single?: unknown; list?: unknown[] }>,
) {
  const queries: Array<{ table: string; filters: unknown[] }> = [];

  return {
    from(table: string) {
      const filters: unknown[] = [];
      const chain: Record<string, unknown> = {};
      const recorder =
        (op: string) =>
        (...args: unknown[]) => {
          filters.push({ op, args });
          return chain;
        };
      chain.select = recorder("select");
      chain.eq = recorder("eq");
      chain.order = recorder("order");
      chain.limit = recorder("limit");
      chain.maybeSingle = () => {
        queries.push({ table, filters });
        return Promise.resolve({
          data: resolvers[table]?.single ?? null,
          error: null,
        });
      };
      chain.single = () => {
        queries.push({ table, filters });
        return Promise.resolve({
          data: resolvers[table]?.single ?? null,
          error: null,
        });
      };
      chain.then = (resolve: (v: unknown) => unknown) => {
        queries.push({ table, filters });
        return resolve({
          data: resolvers[table]?.list ?? [],
          error: null,
        });
      };
      return chain;
    },
    queries,
  };
}

describe("getCreatorByHandle", () => {
  it("returns null when handle matches nothing", async () => {
    const { from } = makeTableResolver({});
    // @ts-expect-error — mock shape
    const out = await getCreatorByHandle({ from }, "does-not-exist");
    expect(out).toBeNull();
  });

  it("resolves a direct creators.handle hit", async () => {
    const creator = {
      id: "c-1",
      handle: "mkbhd",
      display_name: "MKBHD",
      followers: 20_000_000,
      posts_count: 1600,
      is_verified: true,
      is_business: false,
      avatar_url: null,
      biography: null,
      category: null,
      country: "US",
      city: null,
      tier: "mega",
      last_scraped_at: null,
    };
    const { from } = makeTableResolver({
      creators: { single: creator },
      creator_social_profiles: {
        list: [
          {
            creator_id: "c-1",
            platform: "instagram",
            handle: "mkbhd",
            followers_or_subs: 20_000_000,
          },
          {
            creator_id: "c-1",
            platform: "youtube",
            handle: "mkbhd",
            followers_or_subs: 19_000_000,
          },
        ],
      },
      creator_scores: { list: [] },
      caption_intelligence: { list: [] },
      transcript_intelligence: { list: [] },
      audience_intelligence: { list: [] },
      posts: { list: [] },
      youtube_videos: { list: [] },
    });

    // @ts-expect-error — mock shape
    const out = await getCreatorByHandle({ from }, "mkbhd");
    expect(out).not.toBeNull();
    expect(out!.creator.id).toBe("c-1");
    expect(out!.profiles).toHaveLength(2);
    // Primary = highest followers_or_subs
    expect(out!.primary_platform).toBe("instagram");
  });

  it("falls back to junction table lookup when creators.handle misses", async () => {
    const creator = { id: "c-yt", handle: "mkbhd_yt" };

    let creatorsCallCount = 0;
    const customFrom = (table: string) => {
      const filters: unknown[] = [];
      const chain: Record<string, unknown> = {};
      const recorder =
        (op: string) =>
        (...args: unknown[]) => {
          filters.push({ op, args });
          return chain;
        };
      chain.select = recorder("select");
      chain.eq = recorder("eq");
      chain.order = recorder("order");
      chain.limit = recorder("limit");
      chain.maybeSingle = () => {
        if (table === "creators") {
          creatorsCallCount++;
          // First call: eq("handle", "mkbhd") → miss
          // Second call: eq("id", "c-yt") → hit
          if (creatorsCallCount === 1) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: creator, error: null });
        }
        if (table === "creator_social_profiles") {
          return Promise.resolve({
            data: { creator_id: "c-yt" },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      };
      chain.then = (resolve: (v: unknown) => unknown) => {
        // Default empty for parallel fetches
        return resolve({ data: [], error: null });
      };
      return chain;
    };

    // @ts-expect-error — mock shape
    const out = await getCreatorByHandle({ from: customFrom }, "mkbhd");
    expect(out).not.toBeNull();
    expect(out!.creator.id).toBe("c-yt");
  });

  it("synthesizes IG profile from shadow columns when junction is empty", async () => {
    const creator = {
      id: "c-1",
      handle: "legacy",
      display_name: "Legacy",
      followers: 100,
      posts_count: 5,
      is_verified: false,
      is_business: false,
      avatar_url: null,
      biography: "bio",
      category: null,
      country: "IN",
      city: null,
      tier: "nano",
      last_scraped_at: null,
      instagram_id: "12345",
    };
    const { from } = makeTableResolver({
      creators: { single: creator },
      creator_social_profiles: { list: [] },
      creator_scores: { list: [] },
      caption_intelligence: { list: [] },
      transcript_intelligence: { list: [] },
      audience_intelligence: { list: [] },
      posts: { list: [] },
      youtube_videos: { list: [] },
    });

    // @ts-expect-error — mock shape
    const out = await getCreatorByHandle({ from }, "legacy");
    expect(out!.profiles).toHaveLength(1);
    expect(out!.profiles[0].platform).toBe("instagram");
    expect(out!.profiles[0].handle).toBe("legacy");
    expect(out!.primary_platform).toBe("instagram");
  });

  it("picks latest per platform when multiple rows exist", async () => {
    const creator = { id: "c-1", handle: "x" };
    const { from } = makeTableResolver({
      creators: { single: creator },
      creator_social_profiles: {
        list: [{ creator_id: "c-1", platform: "instagram", handle: "x", followers_or_subs: 1000 }],
      },
      creator_scores: {
        list: [
          // Ordered desc by computed_at by the query
          { creator_id: "c-1", platform: "instagram", cpi: 80, computed_at: "2026-02-01" },
          { creator_id: "c-1", platform: "instagram", cpi: 70, computed_at: "2026-01-01" },
        ],
      },
      caption_intelligence: { list: [] },
      transcript_intelligence: { list: [] },
      audience_intelligence: { list: [] },
      posts: { list: [] },
      youtube_videos: { list: [] },
    });
    // @ts-expect-error — mock shape
    const out = await getCreatorByHandle({ from }, "x");
    // Latest (first in desc-ordered list) wins
    expect(out!.scores_by_platform.instagram?.cpi).toBe(80);
  });

  it("routes IG posts and YT videos to the correct platform bucket", async () => {
    const creator = { id: "c-1", handle: "x" };
    const { from } = makeTableResolver({
      creators: { single: creator },
      creator_social_profiles: {
        list: [
          { creator_id: "c-1", platform: "instagram", handle: "x", followers_or_subs: 100 },
          { creator_id: "c-1", platform: "youtube", handle: "x", followers_or_subs: 200 },
        ],
      },
      creator_scores: { list: [] },
      caption_intelligence: { list: [] },
      transcript_intelligence: { list: [] },
      audience_intelligence: { list: [] },
      posts: {
        list: [
          { id: "p1", creator_id: "c-1", platform: "instagram", url: "u1" },
        ],
      },
      youtube_videos: {
        list: [
          { id: "v1", creator_id: "c-1", video_id: "v1", url: "u2", is_short: false, is_livestream: false },
        ],
      },
    });
    // @ts-expect-error — mock shape
    const out = await getCreatorByHandle({ from }, "x");
    expect(out!.content_by_platform.instagram).toHaveLength(1);
    expect(out!.content_by_platform.instagram![0].kind).toBe("ig_post");
    expect(out!.content_by_platform.youtube).toHaveLength(1);
    expect(out!.content_by_platform.youtube![0].kind).toBe("yt_video");
    // Primary = YT (higher subs)
    expect(out!.primary_platform).toBe("youtube");
  });
});
