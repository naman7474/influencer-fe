import { describe, it, expect, vi } from "vitest";
import { campaignStatusManagerTool } from "../campaign-status-manager";

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
  builder.update = vi.fn().mockReturnValue(builder);
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

type SupabaseParam = Parameters<typeof campaignStatusManagerTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ------------------------------------------------------------------ */
/*  Campaign Status Manager                                            */
/* ------------------------------------------------------------------ */

describe("campaign-status-manager", () => {
  const brandId = "brand-1";

  it("returns error when campaign not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([], { message: "Not found" })),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "nonexistent", new_status: "active" },
      execOpts
    );
    expect(result).toHaveProperty("error", "Campaign not found or access denied");
  });

  it("returns error when campaign data is null", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])), // single() returns null
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = await t.execute(
      { campaign_id: "nonexistent", new_status: "active" },
      execOpts
    );
    expect(result).toHaveProperty("error", "Campaign not found or access denied");
  });

  /* ── Valid transitions ─────────────────────────────────────── */

  it("activates a draft campaign (draft -> active)", async () => {
    let updateCalled = false;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          const builder = mockQueryBuilder([
            { id: "camp-1", name: "Summer Sale", status: "draft", brand_id: "brand-1" },
          ]);
          // Override update to track calls and return success
          builder.update = vi.fn().mockImplementation(() => {
            updateCalled = true;
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: (v: unknown) => void) => resolve({ error: null }),
              }),
            };
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "active" },
      execOpts
    )) as {
      success: boolean;
      campaign_id: string;
      campaign_name: string;
      previous_status: string;
      new_status: string;
    };

    expect(result.success).toBe(true);
    expect(result.campaign_id).toBe("camp-1");
    expect(result.campaign_name).toBe("Summer Sale");
    expect(result.previous_status).toBe("draft");
    expect(result.new_status).toBe("active");
    expect(updateCalled).toBe(true);
  });

  it("pauses an active campaign (active -> paused)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          const builder = mockQueryBuilder([
            { id: "camp-1", name: "Running Campaign", status: "active", brand_id: "brand-1" },
          ]);
          builder.update = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve({ error: null }),
            }),
          }));
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "paused" },
      execOpts
    )) as { success: boolean; previous_status: string; new_status: string };

    expect(result.success).toBe(true);
    expect(result.previous_status).toBe("active");
    expect(result.new_status).toBe("paused");
  });

  it("completes an active campaign (active -> completed)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          const builder = mockQueryBuilder([
            { id: "camp-1", name: "Ending Campaign", status: "active", brand_id: "brand-1" },
          ]);
          builder.update = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve({ error: null }),
            }),
          }));
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "completed" },
      execOpts
    )) as { success: boolean; previous_status: string; new_status: string };

    expect(result.success).toBe(true);
    expect(result.previous_status).toBe("active");
    expect(result.new_status).toBe("completed");
  });

  it("resumes a paused campaign (paused -> active)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          const builder = mockQueryBuilder([
            { id: "camp-1", name: "Paused Campaign", status: "paused", brand_id: "brand-1" },
          ]);
          builder.update = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve({ error: null }),
            }),
          }));
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "active" },
      execOpts
    )) as { success: boolean; previous_status: string; new_status: string };

    expect(result.success).toBe(true);
    expect(result.previous_status).toBe("paused");
    expect(result.new_status).toBe("active");
  });

  it("completes a paused campaign (paused -> completed)", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          const builder = mockQueryBuilder([
            { id: "camp-1", name: "Paused Campaign", status: "paused", brand_id: "brand-1" },
          ]);
          builder.update = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve({ error: null }),
            }),
          }));
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "completed" },
      execOpts
    )) as { success: boolean; previous_status: string; new_status: string };

    expect(result.success).toBe(true);
    expect(result.previous_status).toBe("paused");
    expect(result.new_status).toBe("completed");
  });

  /* ── Invalid transitions ───────────────────────────────────── */

  it("rejects transition from completed (terminal state)", async () => {
    const supabase = {
      from: vi.fn(() =>
        mockQueryBuilder([
          { id: "camp-1", name: "Done Campaign", status: "completed", brand_id: "brand-1" },
        ])
      ),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "active" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain('Cannot transition from "completed" to "active"');
    expect(result.error).toContain("none (terminal state)");
  });

  it("rejects transition from draft to paused", async () => {
    const supabase = {
      from: vi.fn(() =>
        mockQueryBuilder([
          { id: "camp-1", name: "Draft Campaign", status: "draft", brand_id: "brand-1" },
        ])
      ),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "paused" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain('Cannot transition from "draft" to "paused"');
    expect(result.error).toContain("active");
  });

  it("rejects transition from draft to completed", async () => {
    const supabase = {
      from: vi.fn(() =>
        mockQueryBuilder([
          { id: "camp-1", name: "Draft Campaign", status: "draft", brand_id: "brand-1" },
        ])
      ),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "completed" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain('Cannot transition from "draft" to "completed"');
  });

  it("handles unknown current status gracefully", async () => {
    const supabase = {
      from: vi.fn(() =>
        mockQueryBuilder([
          { id: "camp-1", name: "Weird Campaign", status: "unknown_status", brand_id: "brand-1" },
        ])
      ),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "active" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain('Cannot transition from "unknown_status" to "active"');
    expect(result.error).toContain("none (terminal state)");
  });

  /* ── Update failure ─────────────────────────────────────────── */

  it("returns error when database update fails", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          const builder = mockQueryBuilder([
            { id: "camp-1", name: "Valid Campaign", status: "draft", brand_id: "brand-1" },
          ]);
          builder.update = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) =>
                resolve({ error: { message: "Database connection lost" } }),
            }),
          }));
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = campaignStatusManagerTool(brandId, supabase);
    const result = (await t.execute(
      { campaign_id: "camp-1", new_status: "active" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain("Failed to update campaign status");
    expect(result.error).toContain("Database connection lost");
  });
});
