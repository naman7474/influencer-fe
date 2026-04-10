import { describe, it, expect } from "vitest";
import {
  computeRecencyDecay,
  computeCompositeScore,
  rankMemories,
} from "../memory-scorer";

/* ------------------------------------------------------------------ */
/*  computeRecencyDecay                                                */
/* ------------------------------------------------------------------ */

describe("computeRecencyDecay", () => {
  it("returns ~1.0 for items created today", () => {
    const now = new Date();
    expect(computeRecencyDecay(now.toISOString())).toBeCloseTo(1.0, 1);
  });

  it("returns lower score for older items", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const score = computeRecencyDecay(thirtyDaysAgo.toISOString());
    expect(score).toBeLessThan(0.8);
    expect(score).toBeGreaterThan(0);
  });

  it("returns very low score for very old items", () => {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const score = computeRecencyDecay(sixMonthsAgo.toISOString());
    expect(score).toBeLessThan(0.2);
  });

  it("never returns negative", () => {
    const ancient = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    expect(computeRecencyDecay(ancient.toISOString())).toBeGreaterThanOrEqual(0);
  });

  it("is monotonically decreasing with age", () => {
    const scores = [1, 7, 14, 30, 60, 90].map((days) => {
      const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return computeRecencyDecay(date.toISOString());
    });

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  computeCompositeScore                                              */
/* ------------------------------------------------------------------ */

describe("computeCompositeScore", () => {
  it("combines similarity, recency, and importance", () => {
    const score = computeCompositeScore({
      similarity: 0.9,
      recencyDecay: 0.8,
      importance: 0.7,
    });

    // 0.9 * 0.5 + 0.8 * 0.3 + 0.7 * 0.2 = 0.45 + 0.24 + 0.14 = 0.83
    expect(score).toBeCloseTo(0.83, 2);
  });

  it("returns 0 when all inputs are 0", () => {
    expect(
      computeCompositeScore({ similarity: 0, recencyDecay: 0, importance: 0 })
    ).toBe(0);
  });

  it("returns max ~1.0 when all inputs are 1.0", () => {
    const score = computeCompositeScore({
      similarity: 1.0,
      recencyDecay: 1.0,
      importance: 1.0,
    });
    expect(score).toBeCloseTo(1.0, 2);
  });

  it("weights similarity highest", () => {
    const highSim = computeCompositeScore({ similarity: 1.0, recencyDecay: 0, importance: 0 });
    const highRec = computeCompositeScore({ similarity: 0, recencyDecay: 1.0, importance: 0 });
    const highImp = computeCompositeScore({ similarity: 0, recencyDecay: 0, importance: 1.0 });

    expect(highSim).toBeGreaterThan(highRec);
    expect(highRec).toBeGreaterThan(highImp);
  });
});

/* ------------------------------------------------------------------ */
/*  rankMemories                                                       */
/* ------------------------------------------------------------------ */

describe("rankMemories", () => {
  const now = Date.now();

  it("ranks by composite score (high similarity + recent + important first)", () => {
    const items = [
      {
        id: "a",
        summary: "low relevance",
        episode_type: "general_interaction",
        created_at: new Date(now - 30 * 86400000).toISOString(),
        similarity: 0.3,
        importance: 0.3,
      },
      {
        id: "b",
        summary: "high relevance",
        episode_type: "correction_received",
        created_at: new Date(now - 1 * 86400000).toISOString(),
        similarity: 0.95,
        importance: 0.9,
      },
      {
        id: "c",
        summary: "medium relevance",
        episode_type: "creator_search",
        created_at: new Date(now - 7 * 86400000).toISOString(),
        similarity: 0.7,
        importance: 0.5,
      },
    ];

    const ranked = rankMemories(items);

    expect(ranked[0].id).toBe("b"); // highest composite
    expect(ranked[1].id).toBe("c"); // medium
    expect(ranked[2].id).toBe("a"); // lowest
  });

  it("returns empty array for empty input", () => {
    expect(rankMemories([])).toEqual([]);
  });

  it("handles items without similarity (defaults to 0.5)", () => {
    const items = [
      {
        id: "x",
        summary: "no similarity",
        episode_type: "general_interaction",
        created_at: new Date().toISOString(),
      },
    ];

    const ranked = rankMemories(items);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]._compositeScore).toBeGreaterThan(0);
  });

  it("limits output to requested count", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      summary: `item ${i}`,
      episode_type: "general_interaction",
      created_at: new Date().toISOString(),
      similarity: Math.random(),
      importance: 0.5,
    }));

    const ranked = rankMemories(items, 3);
    expect(ranked).toHaveLength(3);
  });
});
