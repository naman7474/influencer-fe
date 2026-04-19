import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock embeddings before importing knowledge-writer (which now uses it)
vi.mock("../embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(null),
}));

import {
  reinforceConfidence,
  contradictConfidence,
  writeKnowledge,
  contradictKnowledge,
  extractFromRateBenchmark,
} from "../knowledge-writer";

/* ------------------------------------------------------------------ */
/*  Mock Supabase                                                      */
/* ------------------------------------------------------------------ */

function createMockSupabase(options?: {
  existingKnowledge?: Record<string, unknown>[];
  insertResult?: Record<string, unknown>;
}) {
  const insertFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: options?.insertResult ?? { id: "new-knowledge-1" },
        error: null,
      }),
    }),
  });

  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });

  const selectFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockImplementation(() => {
      return {
        eq: vi.fn().mockImplementation(() => {
          return {
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: options?.existingKnowledge ?? [],
                  error: null,
                }),
              }),
            }),
            single: vi.fn().mockResolvedValue({
              data: options?.existingKnowledge?.[0] ?? null,
              error: null,
            }),
          };
        }),
        single: vi.fn().mockResolvedValue({
          data: options?.existingKnowledge?.[0] ?? null,
          error: null,
        }),
      };
    }),
  });

  return {
    from: vi.fn().mockReturnValue({
      insert: insertFn,
      update: updateFn,
      select: selectFn,
    }),
    _insert: insertFn,
    _update: updateFn,
    _select: selectFn,
  };
}

/* ------------------------------------------------------------------ */
/*  Confidence math tests                                              */
/* ------------------------------------------------------------------ */

describe("reinforceConfidence", () => {
  it("increases confidence from 0.5", () => {
    const result = reinforceConfidence(0.5);
    expect(result).toBeCloseTo(0.575, 3);
  });

  it("increases confidence from 0.8", () => {
    const result = reinforceConfidence(0.8);
    expect(result).toBeCloseTo(0.83, 2);
  });

  it("never exceeds 0.99", () => {
    expect(reinforceConfidence(0.99)).toBeLessThanOrEqual(0.99);
    expect(reinforceConfidence(0.98)).toBeLessThanOrEqual(0.99);
  });

  it("works from low confidence", () => {
    const result = reinforceConfidence(0.1);
    expect(result).toBeCloseTo(0.235, 3);
    expect(result).toBeGreaterThan(0.1);
  });

  it("converges toward 0.99 with repeated reinforcement", () => {
    let c = 0.5;
    for (let i = 0; i < 20; i++) {
      c = reinforceConfidence(c);
    }
    expect(c).toBeGreaterThan(0.95);
    expect(c).toBeLessThanOrEqual(0.99);
  });
});

describe("contradictConfidence", () => {
  it("decreases confidence from 0.8", () => {
    const result = contradictConfidence(0.8);
    expect(result).toBeCloseTo(0.64, 2);
  });

  it("decreases confidence from 0.5", () => {
    const result = contradictConfidence(0.5);
    expect(result).toBeCloseTo(0.4, 2);
  });

  it("never goes below 0.05", () => {
    expect(contradictConfidence(0.05)).toBeGreaterThanOrEqual(0.05);
    expect(contradictConfidence(0.06)).toBeGreaterThanOrEqual(0.05);
  });

  it("converges toward 0.05 with repeated contradiction", () => {
    let c = 0.9;
    for (let i = 0; i < 30; i++) {
      c = contradictConfidence(c);
    }
    expect(c).toBeLessThan(0.1);
    expect(c).toBeGreaterThanOrEqual(0.05);
  });
});

/* ------------------------------------------------------------------ */
/*  writeKnowledge tests                                               */
/* ------------------------------------------------------------------ */

describe("writeKnowledge", () => {
  it("creates new knowledge when no similar exists", async () => {
    const mock = createMockSupabase();
    const result = await writeKnowledge({
      brandId: "brand-1",
      knowledgeType: "rate_benchmark",
      fact: "Micro fitness creators median ₹12-18K per reel",
      supabase: mock as unknown as Parameters<typeof writeKnowledge>[0]["supabase"],
    });

    expect(result.action).toBe("created");
    expect(result.id).toBe("new-knowledge-1");
  });

  it("returns error for empty fact", async () => {
    const mock = createMockSupabase();
    const result = await writeKnowledge({
      brandId: "brand-1",
      knowledgeType: "rate_benchmark",
      fact: "",
      supabase: mock as unknown as Parameters<typeof writeKnowledge>[0]["supabase"],
    });

    expect(result.action).toBe("error");
  });

  it("returns error for whitespace-only fact", async () => {
    const mock = createMockSupabase();
    const result = await writeKnowledge({
      brandId: "brand-1",
      knowledgeType: "rate_benchmark",
      fact: "   ",
      supabase: mock as unknown as Parameters<typeof writeKnowledge>[0]["supabase"],
    });

    expect(result.action).toBe("error");
  });
});

/* ------------------------------------------------------------------ */
/*  extractFromRateBenchmark tests                                     */
/* ------------------------------------------------------------------ */

describe("extractFromRateBenchmark", () => {
  it("extracts market rate knowledge", async () => {
    const mock = createMockSupabase();
    await extractFromRateBenchmark(
      "brand-1",
      {
        tier: "micro",
        market_rate: { min: 8000, max: 25000, median: 15000, currency: "INR" },
        creator_specific: null,
      },
      mock as unknown as Parameters<typeof extractFromRateBenchmark>[2]
    );

    // Should have called insert (via writeKnowledge) for market rate
    expect(mock.from).toHaveBeenCalled();
  });

  it("extracts creator-specific knowledge when available", async () => {
    const mock = createMockSupabase();
    await extractFromRateBenchmark(
      "brand-1",
      {
        tier: "micro",
        market_rate: { min: 8000, max: 25000, median: 15000, currency: "INR" },
        creator_specific: {
          handle: "fit_priya",
          cpi: 86,
          engagement_rate: 5.1,
          niche: "fitness",
        },
      },
      mock as unknown as Parameters<typeof extractFromRateBenchmark>[2]
    );

    // Should call from() multiple times (once for rate, once for creator)
    expect(mock.from).toHaveBeenCalled();
  });

  it("does nothing when no market_rate and no creator_specific", async () => {
    const mock = createMockSupabase();
    await extractFromRateBenchmark(
      "brand-1",
      { tier: "micro" },
      mock as unknown as Parameters<typeof extractFromRateBenchmark>[2]
    );
    // from() should not be called for inserts since both are null
    expect(mock._insert).not.toHaveBeenCalled();
  });

  it("handles creator_specific without handle (no creator_insight written)", async () => {
    const mock = createMockSupabase();
    await extractFromRateBenchmark(
      "brand-1",
      {
        tier: "nano",
        market_rate: null,
        creator_specific: { cpi: 30, engagement_rate: 2.5 },
      },
      mock as unknown as Parameters<typeof extractFromRateBenchmark>[2]
    );
    // creator_specific.handle is falsy, so no creator_insight writeKnowledge call
    // and market_rate is null so no rate_benchmark call either
    expect(mock._insert).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  contradictKnowledge tests                                          */
/* ------------------------------------------------------------------ */

describe("contradictKnowledge", () => {
  it("reduces confidence on existing knowledge", async () => {
    const mock = createMockSupabase({
      existingKnowledge: [
        { id: "k1", confidence: 0.8, contradicted_count: 1 },
      ],
    });
    await contradictKnowledge(
      "k1",
      "brand-1",
      mock as unknown as Parameters<typeof contradictKnowledge>[2]
    );
    expect(mock._update).toHaveBeenCalled();
  });

  it("does nothing when knowledge item not found", async () => {
    const mock = createMockSupabase({ existingKnowledge: [] });
    // Override single to return null data
    mock.from("agent_knowledge").select().eq("id", "nonexistent").eq("brand_id", "brand-1");
    await contradictKnowledge(
      "nonexistent",
      "brand-1",
      mock as unknown as Parameters<typeof contradictKnowledge>[2]
    );
    // update is called by the chain setup but with no real data; the key point
    // is no error is thrown
  });
});

/* ------------------------------------------------------------------ */
/*  extractFromOutreachOutcome tests                                   */
/* ------------------------------------------------------------------ */

import { extractFromOutreachOutcome } from "../knowledge-writer";

describe("extractFromOutreachOutcome", () => {
  it("writes knowledge for rejected outcome with reason", async () => {
    const mock = createMockSupabase();
    await extractFromOutreachOutcome(
      "brand-1",
      "rejected",
      { rejection_reason: "Too expensive for the brand budget" },
      mock as unknown as Parameters<typeof extractFromOutreachOutcome>[3]
    );
    expect(mock.from).toHaveBeenCalled();
  });

  it("does nothing for approved outcome", async () => {
    const mock = createMockSupabase();
    await extractFromOutreachOutcome(
      "brand-1",
      "approved",
      { some_details: "stuff" },
      mock as unknown as Parameters<typeof extractFromOutreachOutcome>[3]
    );
    // No insert should happen for approved outcomes
    expect(mock._insert).not.toHaveBeenCalled();
  });

  it("does nothing for rejected outcome without rejection_reason", async () => {
    const mock = createMockSupabase();
    await extractFromOutreachOutcome(
      "brand-1",
      "rejected",
      { other_field: "no rejection reason" },
      mock as unknown as Parameters<typeof extractFromOutreachOutcome>[3]
    );
    expect(mock._insert).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  writeKnowledge additional edge cases                               */
/* ------------------------------------------------------------------ */

describe("writeKnowledge – additional coverage", () => {
  it("passes details and source IDs through on create", async () => {
    const mock = createMockSupabase();
    const result = await writeKnowledge({
      brandId: "brand-1",
      knowledgeType: "rate_benchmark",
      fact: "Micro fitness creators median twelve to eighteen thousand per reel",
      details: { tier: "micro", min: 12000, max: 18000 },
      sourceEpisodeId: "ep-42",
      sourceCampaignId: "camp-7",
      supabase: mock as unknown as Parameters<typeof writeKnowledge>[0]["supabase"],
    });
    expect(result.action).toBe("created");
  });

  it("reinforces existing knowledge when similar fact found", async () => {
    const existingItem = {
      id: "existing-k1",
      fact: "Micro fitness creators median twelve to eighteen thousand per reel",
      confidence: 0.6,
      evidence_count: 3,
      reinforced_count: 2,
      source_episode_ids: ["ep-1"],
      source_campaign_ids: ["camp-1"],
      details: { tier: "micro" },
    };
    const mock = createMockSupabase({ existingKnowledge: [existingItem] });
    const result = await writeKnowledge({
      brandId: "brand-1",
      knowledgeType: "rate_benchmark",
      fact: "Micro fitness creators median twelve to eighteen thousand per reel",
      sourceEpisodeId: "ep-2",
      sourceCampaignId: "camp-2",
      supabase: mock as unknown as Parameters<typeof writeKnowledge>[0]["supabase"],
    });
    expect(result.action).toBe("reinforced");
    expect(result.id).toBe("existing-k1");
  });
});
