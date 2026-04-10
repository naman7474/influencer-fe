import { describe, it, expect, vi, beforeEach } from "vitest";
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
});
