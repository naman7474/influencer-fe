import { describe, it, expect, vi } from "vitest";
import { briefGeneratorTool } from "../brief-generator";

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

type SupabaseParam = Parameters<typeof briefGeneratorTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

const brandRow = {
  brand_name: "FitBar",
  brand_description: "Healthy snack bars",
  website: "https://fitbar.com",
  target_audience: "Fitness enthusiasts",
  brand_values: ["health", "transparency"],
  industry: "food",
};

const campaignRow = {
  id: "camp-1",
  name: "Summer Launch",
  goal: "awareness",
  total_budget: 500000,
  start_date: "2026-06-01",
  end_date: "2026-07-01",
  default_discount_percentage: 15,
  brief_requirements: ["Must use product in morning routine"],
  status: "active",
};

const creatorRow = {
  creator_id: "c1",
  handle: "@beauty_queen",
  display_name: "Beauty Queen",
  followers: 80000,
  tier: "mid",
  primary_niche: "beauty",
  avg_engagement_rate: 4.5,
  city: "Mumbai",
};

const ccRow = { id: "cc-1", status: "active", agreed_rate: 25000 };

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("brief-generator", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-x", creator_id: "c1" },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("Campaign not found");
  });

  it("returns error when brand not found", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([campaignRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("Brand not found");
  });

  it("returns error when creator not found", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([campaignRow]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("Creator not found");
  });

  it("returns error when creator not in campaign", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([campaignRow]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        if (table === "mv_creator_leaderboard") return mockQueryBuilder([creatorRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("not part of this campaign");
  });

  it("generates a full brief with discount code and caption intel", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([campaignRow]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        if (table === "mv_creator_leaderboard") return mockQueryBuilder([creatorRow]);
        if (table === "campaign_creators") return mockQueryBuilder([ccRow]);
        if (table === "campaign_discount_codes") return mockQueryBuilder([{ code: "BEAUTY15" }]);
        if (table === "caption_intelligence") return mockQueryBuilder([{ primary_tone: "playful", content_themes: ["skincare", "morning routine"], avg_caption_length: 200 }]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { brief: Record<string, unknown> };

    expect(result.brief.campaign_name).toBe("Summer Launch");
    expect(result.brief.brand_name).toBe("FitBar");
    expect(result.brief.creator_handle).toBe("@beauty_queen");
    expect(result.brief.discount_code).toBe("BEAUTY15");
    expect(result.brief.creator_tone).toBe("playful");

    const reqs = result.brief.content_requirements as string[];
    expect(reqs).toContain("Must use product in morning routine");
    expect(reqs.some((r) => r.includes("BEAUTY15"))).toBe(true);
    expect(reqs.some((r) => r.includes("#ad"))).toBe(true);

    // Awareness goal → direction mentions introducing
    const direction = result.brief.suggested_direction as string;
    expect(direction).toContain("playful");
    expect(direction).toContain("beauty");
    expect(direction).toContain("introducing");
  });

  it("generates direction for conversion goal", async () => {
    const conversionCampaign = { ...campaignRow, goal: "conversion" };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([conversionCampaign]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        if (table === "mv_creator_leaderboard") return mockQueryBuilder([creatorRow]);
        if (table === "campaign_creators") return mockQueryBuilder([ccRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { brief: { suggested_direction: string } };

    expect(result.brief.suggested_direction).toContain("driving purchases");
  });

  it("generates direction for sales goal", async () => {
    const salesCampaign = { ...campaignRow, goal: "drive sales" };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([salesCampaign]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        if (table === "mv_creator_leaderboard") return mockQueryBuilder([creatorRow]);
        if (table === "campaign_creators") return mockQueryBuilder([ccRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { brief: { suggested_direction: string } };

    expect(result.brief.suggested_direction).toContain("driving purchases");
  });

  it("generates direction for launch goal", async () => {
    const launchCampaign = { ...campaignRow, goal: "product launch" };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([launchCampaign]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        if (table === "mv_creator_leaderboard") return mockQueryBuilder([creatorRow]);
        if (table === "campaign_creators") return mockQueryBuilder([ccRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { brief: { suggested_direction: string } };

    expect(result.brief.suggested_direction).toContain("excitement");
  });

  it("handles no discount code", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([{ ...campaignRow, brief_requirements: null }]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        if (table === "mv_creator_leaderboard") return mockQueryBuilder([creatorRow]);
        if (table === "campaign_creators") return mockQueryBuilder([ccRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { brief: Record<string, unknown> };

    expect(result.brief.discount_code).toBeFalsy();
    const reqs = result.brief.content_requirements as string[];
    expect(reqs.some((r) => r.includes("discount code"))).toBe(false);
  });

  it("handles no caption intelligence", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") return mockQueryBuilder([campaignRow]);
        if (table === "brands") return mockQueryBuilder([brandRow]);
        if (table === "mv_creator_leaderboard") return mockQueryBuilder([creatorRow]);
        if (table === "campaign_creators") return mockQueryBuilder([ccRow]);
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { brief: Record<string, unknown> };

    expect(result.brief.creator_tone).toBeNull();
    expect(result.brief.content_themes).toBeNull();
    // Direction falls back to "engaging"
    expect(result.brief.suggested_direction).toContain("engaging");
  });
});
