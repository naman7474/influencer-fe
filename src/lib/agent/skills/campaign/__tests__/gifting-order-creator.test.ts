import { describe, it, expect, vi } from "vitest";
import { giftingOrderCreatorTool } from "../gifting-order-creator";

/* ------------------------------------------------------------------ */
/*  Mock approval-wrapper                                              */
/* ------------------------------------------------------------------ */

vi.mock("../../_shared/approval-wrapper", () => ({
  createApprovalRequest: vi
    .fn()
    .mockResolvedValue({
      approval_id: "appr-1",
      status: "pending",
      message: "Submitted",
    }),
}));

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

type SupabaseParam = Parameters<typeof giftingOrderCreatorTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

const brandId = "brand-1";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("gifting-order-creator", () => {
  /* ---- Happy path: CC found on first try ---- */
  it("proceeds to approval when creator-campaign relationship found on first query", async () => {
    const fromCalls: string[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        fromCalls.push(table);
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c1" },
          ]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([]); // no existing orders
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@glow_creator", display_name: "Glow", city: "Delhi" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", product_title: "Face Serum" },
      execOpts,
    )) as { gifting_preview: Record<string, unknown>; approval_id: string };

    expect(result.approval_id).toBe("appr-1");
    expect(result.gifting_preview).toBeDefined();
    expect(result.gifting_preview.product).toBe("Face Serum");
    expect(result.gifting_preview.creator).toBe("@glow_creator");
    // Should never hit "campaigns" table because first CC query succeeded
    expect(fromCalls).not.toContain("campaigns");
  });

  /* ---- Retry path: first CC fails, campaign not found ---- */
  it("returns 'Campaign not found' when first CC query fails and campaign lookup fails", async () => {
    let ccCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          ccCallCount++;
          // First CC query returns null (with .single(), empty array → null)
          return mockQueryBuilder([]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([]); // campaign not found
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-missing", creator_id: "c1", product_title: "Serum" },
      execOpts,
    )) as { error: string };

    expect(result.error).toBe("Campaign not found or access denied");
    // CC should only be called once (the initial attempt)
    expect(ccCallCount).toBe(1);
  });

  /* ---- Retry path: first CC fails, campaign found, second CC fails ---- */
  it("returns 'not part of campaign' when retry CC query also fails", async () => {
    let ccCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          ccCallCount++;
          // Both CC queries return null
          return mockQueryBuilder([]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "camp-1", name: "Summer Campaign" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", product_title: "Serum" },
      execOpts,
    )) as { error: string };

    expect(result.error).toBe("Creator is not part of this campaign. Add them first.");
    expect(ccCallCount).toBe(2);
  });

  /* ---- Retry path: first CC fails, campaign found, second CC succeeds ---- */
  it("proceeds to approval when retry CC query succeeds", async () => {
    let ccCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          ccCallCount++;
          if (ccCallCount === 1) {
            // First call (with brand_id) returns null
            return mockQueryBuilder([]);
          }
          // Second call (without brand_id) succeeds
          return mockQueryBuilder([{ id: "cc1", status: "confirmed" }]);
        }
        if (table === "campaigns") {
          return mockQueryBuilder([{ id: "camp-1", name: "Summer Campaign" }]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([]); // no existing orders
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@retry_creator", display_name: "Retry", city: "Mumbai" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", product_title: "Moisturizer" },
      execOpts,
    )) as { gifting_preview: Record<string, unknown>; approval_id: string };

    expect(result.approval_id).toBe("appr-1");
    expect(result.gifting_preview.product).toBe("Moisturizer");
    expect(result.gifting_preview.creator).toBe("@retry_creator");
    expect(ccCallCount).toBe(2);
  });

  /* ---- Existing gifting orders detected ---- */
  it("returns warning when creator already has gifting orders for the campaign", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c1" },
          ]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([
            { id: "gift-1", status: "draft_created", product_title: "Old Serum" },
            { id: "gift-2", status: "shipped", product_title: "Moisturizer" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", product_title: "New Product" },
      execOpts,
    )) as { warning: string; existing_orders: Array<Record<string, unknown>>; message: string };

    expect(result.warning).toContain("already has 2 gifting order(s)");
    expect(result.existing_orders).toHaveLength(2);
    expect(result.existing_orders[0]).toEqual({
      id: "gift-1",
      status: "draft_created",
      product: "Old Serum",
    });
    expect(result.existing_orders[1]).toEqual({
      id: "gift-2",
      status: "shipped",
      product: "Moisturizer",
    });
    expect(result.message).toContain("confirm");
  });

  /* ---- Creator not in leaderboard → falls back to creator_id ---- */
  it("uses creator_id as fallback when creator not found in leaderboard", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c-unknown" },
          ]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([]); // not found → .single() returns null
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c-unknown", product_title: "Lip Balm" },
      execOpts,
    )) as { gifting_preview: Record<string, unknown>; approval_id: string };

    expect(result.approval_id).toBe("appr-1");
    expect(result.gifting_preview.product).toBe("Lip Balm");
    // Falls back to creator_id when handle not available
    expect(result.gifting_preview.creator).toBe("c-unknown");
  });

  /* ---- Approval request succeeds → returns gifting_preview ---- */
  it("returns gifting_preview with correct next_steps on successful approval", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c1" },
          ]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@beauty", display_name: "Beauty", city: "Pune" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", product_title: "Night Cream" },
      execOpts,
    )) as {
      approval_id: string;
      status: string;
      message: string;
      gifting_preview: {
        product: string;
        creator: string;
        retail_value: number | undefined;
        next_steps: string[];
      };
    };

    expect(result.approval_id).toBe("appr-1");
    expect(result.status).toBe("pending");
    expect(result.gifting_preview.product).toBe("Night Cream");
    expect(result.gifting_preview.creator).toBe("@beauty");
    expect(result.gifting_preview.retail_value).toBeUndefined();
    expect(result.gifting_preview.next_steps).toEqual([
      "Approval needed from brand manager",
      "Creator's shipping address will be collected",
      "Shopify draft order will be created",
    ]);
  });

  /* ---- All optional params included in description ---- */
  it("includes variant_id, retail_value, and note in approval description", async () => {
    const { createApprovalRequest } = await import(
      "../../_shared/approval-wrapper"
    );
    const mockApproval = vi.mocked(createApprovalRequest);
    mockApproval.mockClear();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c1" },
          ]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@luxe", display_name: "Luxe Creator", city: "Jaipur" },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    await t.execute(
      {
        campaign_id: "camp-1",
        creator_id: "c1",
        product_title: "Premium Serum",
        variant_id: "variant-abc",
        retail_value: 2500,
        note: "Thank you for the amazing content!",
      },
      execOpts,
    );

    expect(mockApproval).toHaveBeenCalledTimes(1);
    const callArgs = mockApproval.mock.calls[0];
    const request = callArgs[1];

    // Title should include product and handle
    expect(request.title).toContain("Premium Serum");
    expect(request.title).toContain("@luxe");

    // Description should include retail value formatted in INR
    expect(request.description).toContain("2,500");
    // Description should include display_name
    expect(request.description).toContain("Luxe Creator");
    // Description should include city
    expect(request.description).toContain("Jaipur");
    // Description should include note
    expect(request.description).toContain("Thank you for the amazing content!");

    // Payload should include all optional params
    expect(request.payload.variant_id).toBe("variant-abc");
    expect(request.payload.retail_value).toBe(2500);
    expect(request.payload.note).toBe("Thank you for the amazing content!");
    expect(request.payload.creator_handle).toBe("@luxe");
  });

  /* ---- Optional params null when not provided ---- */
  it("sets optional payload fields to null when not provided", async () => {
    const { createApprovalRequest } = await import(
      "../../_shared/approval-wrapper"
    );
    const mockApproval = vi.mocked(createApprovalRequest);
    mockApproval.mockClear();

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaign_creators") {
          return mockQueryBuilder([
            { id: "cc1", status: "confirmed", creator_id: "c1" },
          ]);
        }
        if (table === "gifting_orders") {
          return mockQueryBuilder([]);
        }
        if (table === "mv_creator_leaderboard") {
          return mockQueryBuilder([
            { creator_id: "c1", handle: "@basic", display_name: "Basic", city: null },
          ]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = giftingOrderCreatorTool(brandId, supabase);
    await t.execute(
      { campaign_id: "camp-1", creator_id: "c1", product_title: "Simple Product" },
      execOpts,
    );

    expect(mockApproval).toHaveBeenCalledTimes(1);
    const request = mockApproval.mock.calls[0][1];

    // Optional params should be null
    expect(request.payload.variant_id).toBeNull();
    expect(request.payload.retail_value).toBeNull();
    expect(request.payload.note).toBeNull();

    // Description should NOT contain INR formatting or note section
    expect(request.description).not.toContain("Note:");
  });
});
