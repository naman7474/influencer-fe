import { describe, it, expect, vi } from "vitest";

import { creatorSearchTool } from "../creator-search";

/**
 * The tool object that ai.tool() produces isn't something we invoke directly
 * from tests — we need to call its `execute`. ai.tool's runtime shape: calling
 * the tool definition returns an object with a private `execute` method that
 * isn't part of the TS surface. Instead of reaching into that, we exercise
 * the tool by capturing the RPC call made against the mocked supabase client.
 */

function makeSupabase() {
  const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const rpc = vi.fn((fn: string, params: Record<string, unknown>) => {
    rpcCalls.push({ fn, params });
    return Promise.resolve({
      data: [
        {
          id: "c1",
          handle: "mkbhd",
          display_name: "MKBHD",
          followers: 20_000_000,
          tier: "mega",
          cpi: 95,
          avg_engagement_rate: 0.05,
          primary_niche: "Tech",
          primary_spoken_language: "English",
          city: null,
          country: "US",
          is_verified: true,
          platform: "youtube",
        },
      ],
      error: null,
    });
  });

  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() =>
          Promise.resolve({
            data: [],
            error: null,
          })
        ),
      })),
    })),
  }));

  return { supabase: { rpc, from }, rpcCalls };
}

describe("creatorSearchTool", () => {
  it("passes platform=youtube through to the RPC", async () => {
    const { supabase, rpcCalls } = makeSupabase();
    // @ts-expect-error — mock Supabase client
    const tool = creatorSearchTool("brand-1", supabase);
    const execute = (tool as unknown as {
      execute: (params: Record<string, unknown>) => Promise<unknown>;
    }).execute;
    await execute({ platform: "youtube", query: "tech" });

    const call = rpcCalls.find((c) => c.fn === "fn_search_creators");
    expect(call).toBeDefined();
    expect(call!.params.p_platform).toBe("youtube");
    expect(call!.params.p_query).toBe("tech");
  });

  it("passes platform=instagram through to the RPC", async () => {
    const { supabase, rpcCalls } = makeSupabase();
    // @ts-expect-error — mock Supabase client
    const tool = creatorSearchTool("brand-1", supabase);
    const execute = (tool as unknown as {
      execute: (params: Record<string, unknown>) => Promise<unknown>;
    }).execute;
    await execute({ platform: "instagram" });

    const call = rpcCalls.find((c) => c.fn === "fn_search_creators");
    expect(call!.params.p_platform).toBe("instagram");
  });

  it("sends null when platform is omitted (search all platforms)", async () => {
    const { supabase, rpcCalls } = makeSupabase();
    // @ts-expect-error — mock Supabase client
    const tool = creatorSearchTool("brand-1", supabase);
    const execute = (tool as unknown as {
      execute: (params: Record<string, unknown>) => Promise<unknown>;
    }).execute;
    await execute({});

    const call = rpcCalls.find((c) => c.fn === "fn_search_creators");
    expect(call!.params.p_platform).toBeNull();
  });

  it("includes platform in each result", async () => {
    const { supabase } = makeSupabase();
    // @ts-expect-error — mock Supabase client
    const tool = creatorSearchTool("brand-1", supabase);
    const execute = (tool as unknown as {
      execute: (params: Record<string, unknown>) => Promise<unknown>;
    }).execute;
    const out = (await execute({ platform: "youtube" })) as {
      results: Array<{ platform: string }>;
    };
    expect(out.results[0].platform).toBe("youtube");
  });
});
