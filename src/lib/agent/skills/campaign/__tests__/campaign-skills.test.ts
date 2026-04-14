import { describe, it, expect, vi } from "vitest";
import { campaignBuilderTool } from "../campaign-builder";
import { discountCodeGeneratorTool } from "../discount-code-generator";
import { utmGeneratorTool } from "../utm-generator";
import { briefGeneratorTool } from "../brief-generator";
import { giftingOrderCreatorTool } from "../gifting-order-creator";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit", "upsert",
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

type SupabaseParam = Parameters<typeof campaignBuilderTool>[1];

function createTableMockSupabase(
  tableData: Record<string, MockRow[]>
): SupabaseParam {
  return {
    from: vi.fn((table: string) => mockQueryBuilder(tableData[table] ?? [])),
  } as unknown as SupabaseParam;
}

// Approval wrapper mock — intercept supabase.from("approval_queue") and .from("notifications")
function createApprovalAwareSupabase(
  tableData: Record<string, MockRow[]>
): SupabaseParam {
  return {
    from: vi.fn((table: string) => {
      // Approval wrapper writes to these tables
      if (table === "approval_queue" || table === "notifications") {
        const builder = mockQueryBuilder([{ id: "approval-1" }]);
        // Make insert chainable
        builder.insert = vi.fn().mockReturnValue(mockQueryBuilder([{ id: "approval-1" }]));
        return builder;
      }
      return mockQueryBuilder(tableData[table] ?? []);
    }),
  } as unknown as SupabaseParam;
}

const execOpts = { toolCallId: "tc", messages: [], abortSignal: undefined as never };

/* ------------------------------------------------------------------ */
/*  Campaign Builder                                                   */
/* ------------------------------------------------------------------ */

describe("campaign-builder", () => {
  const brandId = "brand-1";

  it("validates end_date is after start_date", async () => {
    const supabase = createTableMockSupabase({});
    const t = campaignBuilderTool(brandId, supabase);
    const result = await t.execute(
      {
        name: "Test",
        goal: "Awareness",
        start_date: "2025-06-01",
        end_date: "2025-05-01",
        discount_percent: 15,
      },
      execOpts
    );
    expect(result).toHaveProperty("error", "end_date must be after start_date");
  });

  it("reports missing creators", async () => {
    const supabase = createTableMockSupabase({
      mv_creator_leaderboard: [{ creator_id: "c1", handle: "@c1" }],
    });
    const t = campaignBuilderTool(brandId, supabase);
    const result = (await t.execute(
      {
        name: "Test",
        goal: "Sales",
        creator_ids: ["c1", "c2"],
        discount_percent: 15,
      },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("1 creator(s) not found");
    expect(result.error).toContain("c2");
  });

  it("creates draft campaign row and returns real campaign_id", async () => {
    const insertSpy = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          // For the campaign insert
          const insertBuilder = {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                then: (resolve: (v: unknown) => void) =>
                  resolve({ data: { id: "campaign-real-id" }, error: null }),
              }),
            }),
          };
          insertSpy.mockReturnValue(insertBuilder);
          return { insert: insertSpy };
        }
        if (table === "campaign_creators") {
          return { insert: vi.fn().mockReturnValue({ then: (r: (v: unknown) => void) => r({ error: null }) }) };
        }
        // approval_queue + notifications
        if (table === "approval_queue" || table === "notifications") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockReturnValue(mockQueryBuilder([{ id: "approval-1" }]));
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignBuilderTool(brandId, supabase);
    const result = (await t.execute(
      {
        name: "Summer Sale",
        goal: "Drive conversions",
        budget: 100000,
        start_date: "2025-06-01",
        end_date: "2025-07-01",
        discount_percent: 15,
      },
      execOpts
    )) as { campaign_id: string; campaign_preview: Record<string, unknown>; approval_id: string };

    // Must return a real campaign_id for downstream tools
    expect(result.campaign_id).toBe("campaign-real-id");
    // Must still return the preview
    expect(result.campaign_preview).toBeDefined();
    expect(result.campaign_preview.name).toBe("Summer Sale");
    // Must still create an approval entry
    expect(result.approval_id).toBe("approval-1");
    // The campaign insert should use status: "draft"
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const insertedRow = insertSpy.mock.calls[0][0];
    expect(insertedRow.status).toBe("draft");
    expect(insertedRow.name).toBe("Summer Sale");
  });

  it("adds pre-selected creators to campaign_creators when campaign is created", async () => {
    const ccInsertSpy = vi.fn().mockReturnValue({
      then: (r: (v: unknown) => void) => r({ error: null }),
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@c1" },
            { creator_id: "c2", handle: "@c2" },
          ]);
        }
        if (table === "campaigns") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue({
                  then: (resolve: (v: unknown) => void) =>
                    resolve({ data: { id: "camp-new" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "campaign_creators") {
          return { insert: ccInsertSpy };
        }
        if (table === "approval_queue" || table === "notifications") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockReturnValue(mockQueryBuilder([{ id: "approval-1" }]));
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignBuilderTool(brandId, supabase);
    const result = (await t.execute(
      {
        name: "Creator Campaign",
        goal: "Awareness",
        creator_ids: ["c1", "c2"],
        discount_percent: 15,
      },
      execOpts
    )) as { campaign_id: string };

    expect(result.campaign_id).toBe("camp-new");
    // Should insert campaign_creators rows
    expect(ccInsertSpy).toHaveBeenCalledTimes(1);
    const ccRows = ccInsertSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(ccRows).toHaveLength(2);
    expect(ccRows[0].campaign_id).toBe("camp-new");
    expect(ccRows[0].status).toBe("shortlisted");
  });
});

/* ------------------------------------------------------------------ */
/*  Discount Code Generator                                            */
/* ------------------------------------------------------------------ */

describe("discount-code-generator", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = createTableMockSupabase({ campaigns: [] });
    const t = discountCodeGeneratorTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "missing", discount_percent: 15 },
      execOpts
    );
    expect(result).toHaveProperty("error", "Campaign not found or access denied");
  });

  it("reports when all creators already have codes", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", brand_id: "brand-1", status: "active" },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", creator_id: "c1", status: "confirmed", creators: { handle: "@c1" } },
          ]);
        }
        if (table === "campaign_discount_codes") {
          return mockQueryBuilder([{ creator_id: "c1", code: "C115" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = discountCodeGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", discount_percent: 15 },
      execOpts
    )) as { message: string; existing_codes: unknown[] };
    expect(result.message).toContain("already have discount codes");
    expect(result.existing_codes).toHaveLength(1);
  });

  it("submits approval for new codes", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", brand_id: "brand-1", status: "active" },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            {
              id: "cc1",
              creator_id: "c1",
              status: "confirmed",
              creators: { handle: "@beauty_queen", display_name: "BQ" },
            },
          ]);
        }
        if (table === "campaign_discount_codes") {
          return mockQueryBuilder([]); // no existing codes
        }
        // approval_queue + notifications
        const builder = mockQueryBuilder([{ id: "appr-1" }]);
        builder.insert = vi.fn().mockReturnValue(mockQueryBuilder([{ id: "appr-1" }]));
        return builder;
      }),
    } as unknown as SupabaseParam;

    const t = discountCodeGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", discount_percent: 15 },
      execOpts
    )) as { codes_to_generate: number; preview: { preview_code: string }[] };
    expect(result.codes_to_generate).toBe(1);
    expect(result.preview[0].preview_code).toContain("BEAUTYQUEEN");
  });
});

/* ------------------------------------------------------------------ */
/*  UTM Generator                                                      */
/* ------------------------------------------------------------------ */

describe("utm-generator", () => {
  const brandId = "brand-1";

  it("returns error when brand has no website", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", brand_id: "brand-1", status: "active" },
          ]);
        }
        if (table === "brands") {
          return mockQueryBuilder([{ brand_name: "TestBrand", website: null }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = utmGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as { error: string };
    expect(result.error).toContain("Brand website not set");
  });

  it("generates UTM links for confirmed creators", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Summer Sale", brand_id: "brand-1", status: "active" },
          ]);
        }
        if (table === "brands") {
          return mockQueryBuilder([
            { brand_name: "TestBrand", website: "https://test.com" },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            {
              id: "cc1",
              creator_id: "c1",
              status: "confirmed",
              creators: { handle: "@creator1", display_name: "C1", tier: "mid" },
            },
          ]);
        }
        if (table === "campaign_utm_links") {
          // upsert returns the link
          return mockQueryBuilder([{ id: "link-1" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = utmGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1" },
      execOpts
    )) as { campaign: string; links: { full_url: string; handle: string }[]; count: number };

    expect(result.campaign).toBe("Summer Sale");
    expect(result.count).toBe(1);
    expect(result.links[0].full_url).toContain("utm_source=instagram");
    expect(result.links[0].full_url).toContain("utm_campaign=summer-sale");
    expect(result.links[0].full_url).toContain("utm_content=creator1");
  });
});

/* ------------------------------------------------------------------ */
/*  Brief Generator                                                    */
/* ------------------------------------------------------------------ */

describe("brief-generator", () => {
  const brandId = "brand-1";

  it("returns error when creator not in campaign", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            { id: "camp-1", name: "Test", goal: "Awareness", brand_id: "brand-1" },
          ]);
        }
        if (table === "brands") {
          return mockQueryBuilder([
            { brand_name: "TestBrand", website: "https://test.com" },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@c1", display_name: "C1", followers: 10000 },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([]); // not in campaign
        }
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

  it("generates a complete brief with requirements", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return mockQueryBuilder([
            {
              id: "camp-1",
              name: "Summer Launch",
              goal: "Drive awareness for new product",
              budget: 50000,
              start_date: "2025-06-01",
              end_date: "2025-07-01",
              discount_percent: 15,
              brief_requirements: ["Include product close-up", "Show unboxing"],
              status: "active",
            },
          ]);
        }
        if (table === "brands") {
          return mockQueryBuilder([
            {
              brand_name: "GlowUp",
              brand_description: "Skincare brand",
              website: "https://glowup.in",
              target_audience: "Women 18-30",
              brand_values: "Natural ingredients",
              industry: "Beauty",
            },
          ]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            {
              id: "c1",
              handle: "@skincare_queen",
              display_name: "Skin Queen",
              followers: 50000,
              tier: "mid",
              primary_niche: "skincare",
              avg_engagement_rate: 4.5,
              city: "Mumbai",
            },
          ]);
        }
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", agreed_rate: 5000 },
          ]);
        }
        if (table === "campaign_discount_codes") {
          return mockQueryBuilder([{ code: "SKINQUEEN15" }]);
        }
        if (table === "caption_intelligence") {
          return mockQueryBuilder([
            {
              primary_tone: "educational",
              content_themes: ["skincare", "routines"],
              avg_caption_length: 200,
            },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = briefGeneratorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1" },
      execOpts
    )) as { brief: Record<string, unknown> };

    const brief = result.brief;
    expect(brief.campaign_name).toBe("Summer Launch");
    expect(brief.brand_name).toBe("GlowUp");
    expect(brief.creator_handle).toBe("@skincare_queen");
    expect(brief.discount_code).toBe("SKINQUEEN15");
    expect(brief.creator_tone).toBe("educational");
    // Check requirements include both default and campaign-specific
    const reqs = brief.content_requirements as string[];
    expect(reqs).toContain("Include product close-up");
    expect(reqs).toContain("Show unboxing");
    expect(reqs.some((r) => r.includes("#ad"))).toBe(true);
    expect(reqs.some((r) => r.includes("SKINQUEEN15"))).toBe(true);
    // Suggested direction should mention awareness
    expect(brief.suggested_direction).toBeDefined();
    expect(brief.suggested_direction as string).toContain("introducing");
  });
});

/* ------------------------------------------------------------------ */
/*  Gifting Order Creator                                              */
/* ------------------------------------------------------------------ */

describe("gifting-order-creator", () => {
  const brandId = "brand-1";

  it("warns when creator already has a gifting order", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c1" },
          ]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "camp-1", name: "Test" }]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([
            { id: "gift-1", status: "draft_created", product_title: "Serum" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      {
        campaign_id: "camp-1",
        creator_id: "c1",
        product_title: "Serum",
      },
      execOpts
    )) as { warning: string; existing_orders: unknown[] };
    expect(result.warning).toContain("already has");
    expect(result.existing_orders).toHaveLength(1);
  });

  it("submits approval for new gifting order", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === "campaign_creators") {
          // First call may fail without brand_id filter, then retry
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c1" },
          ]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "camp-1", name: "Test" }]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([]); // no existing
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { id: "c1", handle: "@creator1", display_name: "Creator1", city: "Mumbai" },
          ]);
        }
        // approval_queue + notifications
        const builder = mockQueryBuilder([{ id: "appr-1" }]);
        builder.insert = vi.fn().mockReturnValue(mockQueryBuilder([{ id: "appr-1" }]));
        return builder;
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      {
        campaign_id: "camp-1",
        creator_id: "c1",
        product_title: "Glow Serum",
        retail_value: 1500,
        note: "Thanks for partnering!",
      },
      execOpts
    )) as { gifting_preview: Record<string, unknown> };
    expect(result.gifting_preview).toBeDefined();
    expect(result.gifting_preview.product).toBe("Glow Serum");
    expect(result.gifting_preview.creator).toBe("@creator1");
  });
});
