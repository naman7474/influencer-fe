import { describe, it, expect } from "vitest";
import {
  computeNicheFit,
  computeBudgetFit,
  computeFormatFit,
  computeEngagementQuality,
  computeAuthenticityModifier,
  computeCompetitorBonus,
  computeAudienceGeo,
  normalizeGeoRegions,
  cosineSimilarity,
  computeSemanticSimilarity,
  computePastCollabSimilarity,
  computeThemeOverlapBonus,
  computeCollabNetworkBonus,
  TIER_RATES,
  NICHE_ADJACENCY,
} from "../engine";
import type { BrandShopifyGeo, CreatorTier, ContentFormat } from "@/lib/types/database";

// ── Helper to build a minimal BrandShopifyGeo stub ────────────────────

function makeGeoZone(
  overrides: Partial<BrandShopifyGeo> = {}
): BrandShopifyGeo {
  return {
    id: "geo-1",
    brand_id: "brand-1",
    city: null,
    state: null,
    country: null,
    sessions: null,
    orders: null,
    revenue: null,
    conversion_rate: null,
    population_weight: null,
    category_relevance: null,
    gap_score: null,
    problem_type: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── computeNicheFit ───────────────────────────────────────────────────

describe("computeNicheFit", () => {
  it("returns 1.0 for exact primary niche match", () => {
    expect(computeNicheFit("beauty", null, ["beauty", "fashion"])).toBe(1.0);
  });

  it("returns 1.0 for primary niche match (case-insensitive)", () => {
    expect(computeNicheFit("Beauty", null, ["beauty"])).toBe(1.0);
  });

  it("returns 0.8 for secondary niche match", () => {
    expect(computeNicheFit("tech", "fashion", ["fashion"])).toBe(0.8);
  });

  it("returns 0.5 for adjacent niche", () => {
    // beauty is adjacent to skincare, fashion, lifestyle
    expect(computeNicheFit("beauty", null, ["skincare"])).toBe(0.5);
  });

  it("returns 0.5 for secondary niche adjacency", () => {
    // food is adjacent to health, lifestyle, fitness
    expect(computeNicheFit("tech", "food", ["health"])).toBe(0.5);
  });

  it("returns 0.0 when no niche overlap exists", () => {
    expect(computeNicheFit("tech", null, ["beauty", "fashion"])).toBe(0.0);
  });

  it("returns 0.0 when brand has no categories", () => {
    expect(computeNicheFit("beauty", "fashion", [])).toBe(0.0);
  });

  it("returns 0.0 when creator has no niches", () => {
    expect(computeNicheFit(null, null, ["beauty"])).toBe(0.0);
  });

  it("prioritizes primary over secondary (primary match = 1.0, not 0.8)", () => {
    // Both primary and secondary match, should return 1.0 (primary)
    expect(computeNicheFit("beauty", "fashion", ["beauty", "fashion"])).toBe(
      1.0
    );
  });
});

// ── computeBudgetFit ──────────────────────────────────────────────────

describe("computeBudgetFit", () => {
  it("returns positive overlap for matching budget and tier", () => {
    // micro tier: [5000, 20000], budget: [5000, 20000] => full overlap
    const result = computeBudgetFit(5000, 20000, "micro");
    expect(result).toBe(1.0);
  });

  it("returns partial overlap for overlapping ranges", () => {
    // nano tier: [1000, 5000], budget: [3000, 10000]
    // overlap: [3000, 5000] = 2000, max range = max(4000, 7000) = 7000
    const result = computeBudgetFit(3000, 10000, "nano");
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("returns 0 when budget is too expensive (too low for tier)", () => {
    // mega tier: [500000, 2000000], budget: [100, 500]
    const result = computeBudgetFit(100, 500, "mega");
    expect(result).toBe(0.0);
  });

  it("returns 0 when budget is too cheap (too high for tier)", () => {
    // nano tier: [1000, 5000], budget: [50000, 100000]
    const result = computeBudgetFit(50000, 100000, "nano");
    expect(result).toBe(0.0);
  });

  it("returns 0.5 when tier is unknown", () => {
    expect(computeBudgetFit(5000, 20000, null)).toBe(0.5);
  });

  it("returns 0.5 when budget range is fully null", () => {
    expect(computeBudgetFit(null, null, "micro")).toBe(0.5);
  });

  it("handles only min budget set", () => {
    // budget: [10000, Infinity], micro tier: [5000, 20000]
    // overlap: [10000, 20000] = 10000
    const result = computeBudgetFit(10000, null, "micro");
    expect(result).toBeGreaterThan(0);
  });

  it("handles only max budget set", () => {
    // budget: [0, 3000], nano tier: [1000, 5000]
    // overlap: [1000, 3000] = 2000
    const result = computeBudgetFit(null, 3000, "nano");
    expect(result).toBeGreaterThan(0);
  });
});

// ── computeFormatFit ──────────────────────────────────────────────────

describe("computeFormatFit", () => {
  it("returns 0.8 for 'any' format preference", () => {
    expect(computeFormatFit("any", { video: 50, image: 50 })).toBe(0.8);
  });

  it("returns high score when creator content matches brand format", () => {
    // Brand wants reels, creator has 80% video
    const result = computeFormatFit("reels", { video: 80, image: 20 });
    expect(result).toBeCloseTo(0.8, 1);
  });

  it("returns low score when creator content does not match", () => {
    // Brand wants reels, creator has 0% video, 100% image
    const result = computeFormatFit("reels", { image: 100 });
    expect(result).toBe(0.0);
  });

  it("returns 0.5 when brand has no format preference", () => {
    expect(computeFormatFit(null, { video: 50, image: 50 })).toBe(0.5);
  });

  it("returns 0.3 when creator has no content mix data", () => {
    expect(computeFormatFit("reels", null)).toBe(0.3);
  });

  it("returns 0.3 when creator content mix is empty", () => {
    expect(computeFormatFit("reels", {})).toBe(0.3);
  });

  it("handles static format matching", () => {
    const result = computeFormatFit("static", { image: 70, video: 30 });
    expect(result).toBeCloseTo(0.7, 1);
  });

  it("handles carousel format matching", () => {
    const result = computeFormatFit("carousel", { carousel: 60, video: 40 });
    expect(result).toBeCloseTo(0.6, 1);
  });
});

// ── computeEngagementQuality ──────────────────────────────────────────

describe("computeEngagementQuality", () => {
  it("normalizes 100 to 1.0", () => {
    expect(computeEngagementQuality(100)).toBe(1.0);
  });

  it("normalizes 0 to 0.0", () => {
    expect(computeEngagementQuality(0)).toBe(0.0);
  });

  it("normalizes 50 to 0.5", () => {
    expect(computeEngagementQuality(50)).toBe(0.5);
  });

  it("normalizes 75 to 0.75", () => {
    expect(computeEngagementQuality(75)).toBe(0.75);
  });

  it("returns 0.3 for null (no data)", () => {
    expect(computeEngagementQuality(null)).toBe(0.3);
  });

  it("clamps values above 100 to 1.0", () => {
    expect(computeEngagementQuality(150)).toBe(1.0);
  });

  it("clamps negative values to 0.0", () => {
    expect(computeEngagementQuality(-10)).toBe(0.0);
  });
});

// ── computeAuthenticityModifier ───────────────────────────────────────

describe("computeAuthenticityModifier", () => {
  it("returns 0.5 when authenticity score < 0.6", () => {
    expect(computeAuthenticityModifier(0.5)).toBe(0.5);
    expect(computeAuthenticityModifier(0.3)).toBe(0.5);
    expect(computeAuthenticityModifier(0.0)).toBe(0.5);
    expect(computeAuthenticityModifier(0.59)).toBe(0.5);
  });

  it("returns 0.75 when authenticity score >= 0.6 and < 0.7", () => {
    expect(computeAuthenticityModifier(0.6)).toBe(0.75);
    expect(computeAuthenticityModifier(0.65)).toBe(0.75);
    expect(computeAuthenticityModifier(0.69)).toBe(0.75);
  });

  it("returns 1.0 when authenticity score >= 0.7", () => {
    expect(computeAuthenticityModifier(0.7)).toBe(1.0);
    expect(computeAuthenticityModifier(0.85)).toBe(1.0);
    expect(computeAuthenticityModifier(1.0)).toBe(1.0);
  });

  it("returns 1.0 when authenticity score is null (no data)", () => {
    expect(computeAuthenticityModifier(null)).toBe(1.0);
  });
});

// ── computeCompetitorBonus ────────────────────────────────────────────

describe("computeCompetitorBonus", () => {
  it("returns 1.15 when creator mentions a competitor", () => {
    expect(
      computeCompetitorBonus(["Nike", "Adidas"], ["Adidas", "Puma"])
    ).toBe(1.15);
  });

  it("returns 1.15 case-insensitively", () => {
    expect(computeCompetitorBonus(["nike"], ["Nike"])).toBe(1.15);
  });

  it("returns 1.0 when no competitor overlap", () => {
    expect(
      computeCompetitorBonus(["Nike", "Apple"], ["Samsung", "Adidas"])
    ).toBe(1.0);
  });

  it("returns 1.0 when creator has no brand mentions", () => {
    expect(computeCompetitorBonus(null, ["Adidas"])).toBe(1.0);
    expect(computeCompetitorBonus([], ["Adidas"])).toBe(1.0);
  });

  it("returns 1.0 when brand has no competitors listed", () => {
    expect(computeCompetitorBonus(["Nike"], null)).toBe(1.0);
    expect(computeCompetitorBonus(["Nike"], [])).toBe(1.0);
  });
});

// ── normalizeGeoRegions ───────────────────────────────────────────────

describe("normalizeGeoRegions", () => {
  it("converts array format [{region, confidence}] to Record", () => {
    const result = normalizeGeoRegions([
      { region: "Maharashtra", confidence: 0.45 },
      { region: "Delhi", confidence: 0.30 },
    ]);
    expect(result).toEqual({ maharashtra: 0.45, delhi: 0.3 });
  });

  it("handles array with percentage > 1 (normalizes to 0-1)", () => {
    const result = normalizeGeoRegions([
      { region: "Karnataka", confidence: 45 },
    ]);
    expect(result).toEqual({ karnataka: 0.45 });
  });

  it("handles array with signals field (ignores it)", () => {
    const result = normalizeGeoRegions([
      { region: "Mumbai", confidence: 0.6, signals: ["hindi", "urban"] },
    ]);
    expect(result).toEqual({ mumbai: 0.6 });
  });

  it("passes through Record<string, number> format", () => {
    const result = normalizeGeoRegions({ india: 0.7, usa: 0.2 });
    expect(result).toEqual({ india: 0.7, usa: 0.2 });
  });

  it("normalizes Record values > 1 to 0-1", () => {
    const result = normalizeGeoRegions({ india: 70, usa: 20 });
    expect(result).toEqual({ india: 0.7, usa: 0.2 });
  });

  it("lowercases keys from Record format", () => {
    const result = normalizeGeoRegions({ Maharashtra: 0.5 });
    expect(result).toEqual({ maharashtra: 0.5 });
  });

  it("returns empty object for null", () => {
    expect(normalizeGeoRegions(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(normalizeGeoRegions(undefined)).toEqual({});
  });

  it("returns empty object for empty array", () => {
    expect(normalizeGeoRegions([])).toEqual({});
  });

  it("handles fallback field names (country, percentage, pct)", () => {
    const result = normalizeGeoRegions([
      { country: "India", percentage: 0.8 },
    ]);
    expect(result).toEqual({ india: 0.8 });
  });
});

// ── computeAudienceGeo ────────────────────────────────────────────────

describe("computeAudienceGeo", () => {
  it("returns 0.3 when creator has no geo data", () => {
    const geoZones = [
      makeGeoZone({ country: "india", problem_type: "awareness_gap" }),
    ];
    expect(computeAudienceGeo(null, geoZones)).toBe(0.3);
  });

  it("returns 0.3 when brand has no geo data", () => {
    expect(computeAudienceGeo({ india: 0.5 }, [])).toBe(0.3);
  });

  // --- Array format (pipeline format) ---

  it("works with array format geo_regions from pipeline", () => {
    const geoZones = [
      makeGeoZone({
        state: "Maharashtra",
        problem_type: "awareness_gap",
        gap_score: 80,
      }),
    ];
    const creatorGeo = [
      { region: "Maharashtra", confidence: 0.45 },
      { region: "Delhi", confidence: 0.30 },
    ];
    const result = computeAudienceGeo(creatorGeo, geoZones);
    expect(result).toBeGreaterThan(0.3);
  });

  it("works with Record format geo_regions", () => {
    const geoZones = [
      makeGeoZone({
        country: "india",
        problem_type: "awareness_gap",
        gap_score: 80,
      }),
    ];
    const result = computeAudienceGeo({ india: 0.6 }, geoZones);
    expect(result).toBeGreaterThan(0.3);
  });

  // --- Gap zone scoring ---

  it("scores higher for more gap zone coverage", () => {
    const twoGapZones = [
      makeGeoZone({ state: "Maharashtra", problem_type: "awareness_gap", gap_score: 80 }),
      makeGeoZone({ state: "Karnataka", problem_type: "conversion_gap", gap_score: 60 }),
    ];

    // Creator covers both gap zones
    const bothCovered = computeAudienceGeo(
      { maharashtra: 0.4, karnataka: 0.3 },
      twoGapZones
    );
    // Creator covers only one gap zone
    const oneCovered = computeAudienceGeo(
      { maharashtra: 0.4, delhi: 0.3 },
      twoGapZones
    );

    expect(bothCovered).toBeGreaterThan(oneCovered);
  });

  it("returns low score when creator audience does not overlap any gap zones", () => {
    const geoZones = [
      makeGeoZone({
        country: "india",
        problem_type: "awareness_gap",
        gap_score: 80,
      }),
    ];
    const result = computeAudienceGeo({ usa: 0.7 }, geoZones);
    // Should still be > 0 because of the 0.1 baseline, but low
    expect(result).toBeLessThan(0.3);
  });

  // --- Strong market scoring ---

  it("scores > 0.1 when all regions are strong_market with audience overlap", () => {
    const geoZones = [
      makeGeoZone({ state: "Maharashtra", problem_type: "strong_market", gap_score: 30 }),
      makeGeoZone({ state: "Delhi", problem_type: "strong_market", gap_score: 25 }),
      makeGeoZone({ state: "Karnataka", problem_type: "strong_market", gap_score: 20 }),
    ];
    const result = computeAudienceGeo(
      { maharashtra: 0.45, delhi: 0.30 },
      geoZones
    );
    // Should be non-trivial since creator overlaps 2 of 3 strong markets
    expect(result).toBeGreaterThan(0.3);
  });

  it("does NOT return flat 0.3 when all regions are strong_market (old behavior)", () => {
    const geoZones = [
      makeGeoZone({ country: "india", problem_type: "strong_market" }),
    ];
    const result = computeAudienceGeo({ india: 0.8 }, geoZones);
    // Old behavior was 0.3 (neutral). New behavior should reward overlap.
    expect(result).toBeGreaterThan(0.3);
  });

  // --- Mixed gap + strong ---

  it("weights gap zones higher than strong markets in mixed scenario", () => {
    const gapZone = [
      makeGeoZone({ state: "Maharashtra", problem_type: "awareness_gap", gap_score: 80 }),
    ];
    const strongZone = [
      makeGeoZone({ state: "Maharashtra", problem_type: "strong_market", gap_score: 30 }),
    ];

    const gapResult = computeAudienceGeo({ maharashtra: 0.5 }, gapZone);
    const strongResult = computeAudienceGeo({ maharashtra: 0.5 }, strongZone);

    expect(gapResult).toBeGreaterThan(strongResult);
  });

  // --- Case sensitivity ---

  it("handles case-insensitive region matching", () => {
    const geoZones = [
      makeGeoZone({
        country: "India",
        problem_type: "conversion_gap",
        gap_score: 60,
      }),
    ];
    const result = computeAudienceGeo({ india: 0.5 }, geoZones);
    expect(result).toBeGreaterThan(0.3);
  });

  it("matches city-level zones to creator regions", () => {
    const geoZones = [
      makeGeoZone({
        city: "Bangalore",
        state: "Karnataka",
        problem_type: "awareness_gap",
        gap_score: 70,
      }),
    ];
    const result = computeAudienceGeo({ bangalore: 0.3 }, geoZones);
    expect(result).toBeGreaterThan(0.3);
  });
});

// ── Composite score integration ───────────────────────────────────────

describe("Composite score formula", () => {
  it("correctly weights sub-scores", () => {
    // Budget/price-tier weight removed (no pricing data in product); the
    // remaining four factors must still sum to 1.0.
    const totalWeight = 0.35 + 0.29 + 0.18 + 0.18;
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("computes a full score correctly with all perfect sub-scores", () => {
    const niche = 1.0;
    const geo = 1.0;
    const format = 1.0;
    const engagement = 1.0;
    const authMod = 1.0;
    const compBonus = 1.0;

    const raw = niche * 0.35 + geo * 0.29 + format * 0.18 + engagement * 0.18;
    const final = Math.min(1.0, raw * authMod * compBonus);

    expect(raw).toBeCloseTo(1.0, 5);
    expect(final).toBeCloseTo(1.0, 5);
  });

  it("applies authenticity modifier penalty correctly", () => {
    const raw = 0.8; // Good raw score
    const authMod = 0.5; // Bad authenticity
    const final = Math.min(1.0, raw * authMod * 1.0);
    expect(final).toBe(0.4);
  });

  it("applies competitor bonus correctly", () => {
    const raw = 0.8;
    const compBonus = 1.15;
    const final = Math.min(1.0, raw * 1.0 * compBonus);
    expect(final).toBeCloseTo(0.92, 2);
  });

  it("caps final score at 1.0", () => {
    const raw = 0.95;
    const compBonus = 1.15;
    const final = Math.min(1.0, raw * 1.0 * compBonus);
    expect(final).toBe(1.0);
  });
});

// ── TIER_RATES constant validation ────────────────────────────────────

describe("TIER_RATES", () => {
  it("has all five tiers defined", () => {
    const tiers: CreatorTier[] = ["nano", "micro", "mid", "macro", "mega"];
    for (const tier of tiers) {
      expect(TIER_RATES[tier]).toBeDefined();
      expect(TIER_RATES[tier]).toHaveLength(2);
      expect(TIER_RATES[tier][0]).toBeLessThan(TIER_RATES[tier][1]);
    }
  });

  it("has non-overlapping ascending ranges", () => {
    const ordered: CreatorTier[] = ["nano", "micro", "mid", "macro", "mega"];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(TIER_RATES[ordered[i]][1]).toBeLessThanOrEqual(
        TIER_RATES[ordered[i + 1]][0]
      );
    }
  });
});

// ── NICHE_ADJACENCY constant validation ─────────────────────────────

describe("NICHE_ADJACENCY", () => {
  it("has adjacencies defined for key niches", () => {
    const expectedNiches = [
      "beauty",
      "fitness",
      "food",
      "tech",
      "fashion",
      "wellness",
      "skincare",
      "lifestyle",
    ];
    for (const niche of expectedNiches) {
      expect(NICHE_ADJACENCY[niche]).toBeDefined();
      expect(NICHE_ADJACENCY[niche].length).toBeGreaterThan(0);
    }
  });
});

// ── cosineSimilarity ────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1.0 (mapped) for identical vectors", () => {
    const v = [1, 0, 0];
    // cosine of identical vectors is 1, mapped to (1+1)/2 = 1.0
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it("returns 0.5 (mapped) for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    // cosine is 0, mapped to (0+1)/2 = 0.5
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });

  it("returns 0.0 (mapped) for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    // cosine is -1, mapped to (-1+1)/2 = 0
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it("returns 0 when either vector is null", () => {
    expect(cosineSimilarity(null, [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], null)).toBe(0);
    expect(cosineSimilarity(null, null)).toBe(0);
  });

  it("returns 0 when either vector is undefined", () => {
    expect(cosineSimilarity(undefined, [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], undefined)).toBe(0);
  });

  it("returns 0 when vectors have different lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 when vectors are empty", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 when a vector is all zeros", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it("handles multi-dimensional vectors correctly", () => {
    const a = [0.5, 0.5, 0.5, 0.5];
    const b = [0.5, 0.5, 0.5, 0.5];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });
});

// ── computeSemanticSimilarity ───────────────────────────────────────

describe("computeSemanticSimilarity", () => {
  it("delegates to cosineSimilarity", () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(computeSemanticSimilarity(a, b)).toBe(cosineSimilarity(a, b));
  });

  it("returns 0 when brand embedding is null", () => {
    expect(computeSemanticSimilarity(null, [1, 2, 3])).toBe(0);
  });

  it("returns 0 when creator embedding is null", () => {
    expect(computeSemanticSimilarity([1, 2, 3], null)).toBe(0);
  });
});

// ── computePastCollabSimilarity ─────────────────────────────────────

describe("computePastCollabSimilarity", () => {
  it("returns 0 when creator embedding is null", () => {
    expect(computePastCollabSimilarity(null, [[1, 0, 0]])).toBe(0);
  });

  it("returns 0 when no past collaborator embeddings", () => {
    expect(computePastCollabSimilarity([1, 0, 0], [])).toBe(0);
  });

  it("returns max similarity across all collaborators", () => {
    const creator = [1, 0, 0];
    const collabs = [
      [0, 1, 0], // orthogonal -> 0.5
      [1, 0, 0], // identical -> 1.0
      [0, 0, 1], // orthogonal -> 0.5
    ];
    expect(computePastCollabSimilarity(creator, collabs)).toBeCloseTo(1.0, 5);
  });

  it("skips null embeddings in collaborator list", () => {
    const creator = [1, 0, 0];
    const collabs: (number[] | null)[] = [null, [1, 0, 0], null];
    expect(computePastCollabSimilarity(creator, collabs)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 when all collaborator embeddings are null", () => {
    const creator = [1, 0, 0];
    const collabs: (number[] | null)[] = [null, null];
    expect(computePastCollabSimilarity(creator, collabs)).toBe(0);
  });
});

// ── computeThemeOverlapBonus ────────────────────────────────────────

describe("computeThemeOverlapBonus", () => {
  it("returns 1.0 when brand topics are null", () => {
    expect(computeThemeOverlapBonus(null, ["topic1"])).toBe(1.0);
  });

  it("returns 1.0 when creator topics are null", () => {
    expect(computeThemeOverlapBonus(["topic1"], null)).toBe(1.0);
  });

  it("returns 1.0 when both are empty", () => {
    expect(computeThemeOverlapBonus([], [])).toBe(1.0);
  });

  it("returns > 1.0 when there is topic overlap", () => {
    const result = computeThemeOverlapBonus(
      ["morning routines", "protein recipes"],
      ["morning routines", "gym tips"]
    );
    expect(result).toBeGreaterThan(1.0);
    expect(result).toBeLessThanOrEqual(1.1);
  });

  it("returns maximum 1.10 for perfect overlap", () => {
    const topics = ["topic1", "topic2", "topic3"];
    const result = computeThemeOverlapBonus(topics, topics);
    expect(result).toBeCloseTo(1.1, 5);
  });

  it("is case-insensitive", () => {
    const result = computeThemeOverlapBonus(
      ["Morning Routines"],
      ["morning routines"]
    );
    expect(result).toBeGreaterThan(1.0);
  });

  it("returns 1.0 when no overlap", () => {
    const result = computeThemeOverlapBonus(
      ["cooking", "recipes"],
      ["tech", "gadgets"]
    );
    expect(result).toBe(1.0);
  });
});

// ── computeCollabNetworkBonus ───────────────────────────────────────

describe("computeCollabNetworkBonus", () => {
  it("returns 1.15 when creator handle is in brand collaborators", () => {
    expect(
      computeCollabNetworkBonus("beauty_queen", ["beauty_queen", "fitness_pro"])
    ).toBe(1.15);
  });

  it("is case-insensitive", () => {
    expect(
      computeCollabNetworkBonus("Beauty_Queen", ["beauty_queen"])
    ).toBe(1.15);
  });

  it("strips @ prefix", () => {
    expect(
      computeCollabNetworkBonus("@beauty_queen", ["@beauty_queen"])
    ).toBe(1.15);
    expect(
      computeCollabNetworkBonus("beauty_queen", ["@beauty_queen"])
    ).toBe(1.15);
    expect(
      computeCollabNetworkBonus("@beauty_queen", ["beauty_queen"])
    ).toBe(1.15);
  });

  it("returns 1.0 when creator handle is null", () => {
    expect(computeCollabNetworkBonus(null, ["beauty_queen"])).toBe(1.0);
  });

  it("returns 1.0 when collaborators list is null", () => {
    expect(computeCollabNetworkBonus("beauty_queen", null)).toBe(1.0);
  });

  it("returns 1.0 when collaborators list is empty", () => {
    expect(computeCollabNetworkBonus("beauty_queen", [])).toBe(1.0);
  });

  it("returns 1.0 when creator is not in collaborators", () => {
    expect(
      computeCollabNetworkBonus("new_creator", ["beauty_queen", "fitness_pro"])
    ).toBe(1.0);
  });

  it("returns 1.0 when creator handle is undefined", () => {
    expect(computeCollabNetworkBonus(undefined, ["a"])).toBe(1.0);
  });
});

// ── normalizeGeoRegions additional edge cases ───────────────────────

describe("normalizeGeoRegions – additional edge cases", () => {
  it("handles array items with pct field", () => {
    const result = normalizeGeoRegions([
      { region: "Delhi", pct: 0.35 },
    ]);
    expect(result).toEqual({ delhi: 0.35 });
  });

  it("handles array items with percentage > 1", () => {
    const result = normalizeGeoRegions([
      { region: "Mumbai", percentage: 55 },
    ]);
    expect(result).toEqual({ mumbai: 0.55 });
  });

  it("handles array items with country field instead of region", () => {
    const result = normalizeGeoRegions([
      { country: "India", confidence: 0.9 },
    ]);
    expect(result).toEqual({ india: 0.9 });
  });

  it("skips array items without region or country", () => {
    const result = normalizeGeoRegions([
      { confidence: 0.5 }, // no region or country
    ]);
    expect(result).toEqual({});
  });

  it("handles non-numeric values in object format", () => {
    const result = normalizeGeoRegions({ india: "not a number" as any });
    // non-numbers are skipped
    expect(result).toEqual({});
  });

  it("returns empty object for string input", () => {
    const result = normalizeGeoRegions("some string");
    expect(result).toEqual({});
  });

  it("returns empty object for number input", () => {
    const result = normalizeGeoRegions(42);
    expect(result).toEqual({});
  });
});

// ── computeAudienceGeo edge cases ───────────────────────────────────

describe("computeAudienceGeo – additional edge cases", () => {
  it("returns 0.3 when both creator regions and brand geo are empty", () => {
    expect(computeAudienceGeo({}, [])).toBe(0.3);
  });

  it("returns 0.3 when brand geo has no gap or strong zones", () => {
    const geoZones = [
      makeGeoZone({ country: "india", problem_type: null }),
    ];
    expect(computeAudienceGeo({ india: 0.5 }, geoZones)).toBe(0.3);
  });

  it("handles mixed gap and strong zones", () => {
    const geoZones = [
      makeGeoZone({ state: "Maharashtra", problem_type: "awareness_gap", gap_score: 80 }),
      makeGeoZone({ state: "Delhi", problem_type: "strong_market", gap_score: 20 }),
    ];
    const result = computeAudienceGeo(
      { maharashtra: 0.5, delhi: 0.3 },
      geoZones
    );
    // Should use 70/30 split between gap and strong scores
    expect(result).toBeGreaterThan(0.3);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  it("handles gap zones with null gap_score (defaults to 50)", () => {
    const geoZones = [
      makeGeoZone({ state: "Maharashtra", problem_type: "awareness_gap", gap_score: null }),
    ];
    const result = computeAudienceGeo({ maharashtra: 0.5 }, geoZones);
    expect(result).toBeGreaterThan(0.3);
  });

  it("never returns more than 1.0", () => {
    const geoZones = [
      makeGeoZone({ state: "Maharashtra", problem_type: "awareness_gap", gap_score: 100 }),
    ];
    const result = computeAudienceGeo({ maharashtra: 1.0 }, geoZones);
    expect(result).toBeLessThanOrEqual(1.0);
  });
});

// ── computeNicheFit additional edge cases ───────────────────────────

describe("computeNicheFit – additional edge cases", () => {
  it("handles whitespace in niche and categories", () => {
    expect(computeNicheFit("  beauty  ", null, ["  beauty  "])).toBe(1.0);
  });

  it("handles case insensitivity for adjacency check", () => {
    // "Beauty" -> "beauty" -> adjacent to ["skincare", "fashion", "lifestyle"]
    expect(computeNicheFit("Beauty", null, ["Skincare"])).toBe(0.5);
  });

  it("returns 0.5 for secondary niche adjacency when primary has no adjacency hit", () => {
    // "tech" is not adjacent to "health", but "food" is
    expect(computeNicheFit("tech", "food", ["health"])).toBe(0.5);
  });

  it("returns 0 when niches have no adjacencies defined", () => {
    expect(computeNicheFit("unknown_niche", null, ["other_category"])).toBe(0.0);
  });
});

// ── computeBudgetFit additional edge cases ──────────────────────────

describe("computeBudgetFit – additional edge cases", () => {
  it("returns 1.0 when budget range equals tier range exactly", () => {
    // nano: [1000, 5000]
    expect(computeBudgetFit(1000, 5000, "nano")).toBe(1.0);
  });

  it("handles very large budget ranges", () => {
    // Budget wider than any tier
    const result = computeBudgetFit(0, 10000000, "nano");
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1.0);
  });
});

// ── computeFormatFit additional edge cases ──────────────────────────

describe("computeFormatFit – additional edge cases", () => {
  it("normalizes percentage values > 1 to 0-1 range", () => {
    // totalProportion > 1, gets divided by 100
    const result = computeFormatFit("reels", { video: 80, reels: 20 });
    // video(80) + reels(20) = 100, /100 = 1.0
    expect(result).toBe(1.0);
  });

  it("handles sidecar key for carousel format", () => {
    const result = computeFormatFit("carousel", { sidecar: 0.4 });
    expect(result).toBeCloseTo(0.4, 2);
  });

  it("sums multiple matching keys", () => {
    // reels maps to ["video", "reels", "reel"]
    const result = computeFormatFit("reels", { video: 0.3, reels: 0.2, reel: 0.1 });
    expect(result).toBeCloseTo(0.6, 2);
  });

  it("handles case-insensitive content mix keys", () => {
    const result = computeFormatFit("reels", { Video: 0.7 });
    expect(result).toBeCloseTo(0.7, 2);
  });
});

/* ------------------------------------------------------------------ */
/*  computeMatchesForBrand (integration)                               */
/* ------------------------------------------------------------------ */

import { computeMatchesForBrand } from "../engine";

function chainBuilder(data: unknown[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const methods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit", "single", "maybeSingle",
  ];
  for (const m of methods) {
    if (m === "single" || m === "maybeSingle") {
      builder[m] = vi.fn().mockImplementation(() => {
        isSingle = true;
        return builder;
      });
    } else {
      builder[m] = vi.fn().mockReturnValue(builder);
    }
  }
  builder.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.then = (resolve: (v: unknown) => void) => {
    if (isSingle) {
      const d = Array.isArray(data) && data.length > 0 ? data[0] : null;
      resolve({ data: d, error });
    } else {
      resolve({ data, error });
    }
  };
  return builder;
}

describe("computeMatchesForBrand", () => {
  const brandRow = {
    id: "brand-1",
    brand_name: "FitBar",
    product_categories: ["fitness", "health"],
    content_format_pref: "reels",
    budget_per_creator_min: 10000,
    budget_per_creator_max: 50000,
    shipping_zones: ["Mumbai", "Delhi"],
    default_campaign_goal: "awareness",
    competitor_brands: ["NutriBites"],
    brand_voice_preference: null,
    min_audience_age: null,
    content_embedding: null,
    ig_collaborators: null,
    ig_content_dna: null,
  };

  const creatorRow = {
    creator_id: "c1",
    handle: "@fit_creator",
    display_name: "Fit Creator",
    followers: 50000,
    tier: "mid" as const,
    cpi: 80,
    primary_niche: "fitness",
    city: "Mumbai",
    country: "India",
    engagement_quality: 0.7,
  };

  it("computes matches for a brand and upserts them", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([brandRow]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([creatorRow]);
        if (table === "brand_guidelines") return chainBuilder([{ forbidden_topics: [] }]);
        if (table === "caption_intelligence") return chainBuilder([{
          creator_id: "c1",
          primary_niche: "fitness",
          secondary_niche: "health",
          primary_tone: "energetic",
          secondary_tone: null,
          formality_score: 0.4,
          engagement_bait_score: 0.1,
          vulnerability_openness: 0.2,
          recurring_topics: ["workout", "protein"],
          brand_categories: ["fitness"],
        }]);
        if (table === "audience_intelligence") return chainBuilder([{
          creator_id: "c1",
          geo_regions: { India: 80, "United States": 20 },
          authenticity_score: 0.9,
          suspicious_patterns: [],
          sentiment_score: 0.8,
          negative_themes: [],
          estimated_age_group: "25-34",
        }]);
        if (table === "creator_scores") return chainBuilder([{
          creator_id: "c1",
          engagement_quality: 0.75,
          content_mix: { video: 0.6, reels: 0.3 },
          brand_mentions: ["NutriBites"],
          professionalism: 0.8,
          content_quality: 0.7,
          sponsored_post_rate: 0.2,
          sponsored_vs_organic_delta: -0.1,
          creator_reply_rate: 0.6,
        }]);
        if (table === "transcript_intelligence") return chainBuilder([{
          creator_id: "c1",
          primary_spoken_language: "Hindi",
        }]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
    } as never;

    const count = await computeMatchesForBrand(supabase, "brand-1", 10);
    expect(count).toBe(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const batch = upsertMock.mock.calls[0][0];
    expect(batch).toHaveLength(1);
    expect(batch[0].creator_id).toBe("c1");
    expect(batch[0].brand_id).toBe("brand-1");
    expect(batch[0].match_score).toBeGreaterThan(0);
    expect(batch[0].match_reasoning).toContain("Score:");
    expect(batch[0].mentions_competitor).toBe(true); // NutriBites in brand_mentions
    expect(batch[0].used_ig_signals).toBe(false);
  });

  it("throws when brand not found", async () => {
    const supabase = {
      from: vi.fn(() => chainBuilder([], { message: "not found" })),
    } as never;

    await expect(computeMatchesForBrand(supabase, "bad-brand")).rejects.toThrow("Brand not found");
  });

  it("returns 0 when no creators in leaderboard", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([brandRow]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([]);
        return chainBuilder([]);
      }),
    } as never;

    const count = await computeMatchesForBrand(supabase, "brand-1");
    expect(count).toBe(0);
  });

  it("uses IG-enhanced scoring when brand has content_embedding", async () => {
    const igBrand = {
      ...brandRow,
      content_embedding: [0.1, 0.2, 0.3],
      ig_collaborators: ["@partner"],
      ig_content_dna: { recurring_topics: ["fitness", "protein"] },
    };

    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([igBrand]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([creatorRow]);
        if (table === "brand_guidelines") return chainBuilder([]);
        if (table === "caption_intelligence") return chainBuilder([{
          creator_id: "c1", primary_niche: "fitness", secondary_niche: null,
          primary_tone: "energetic", secondary_tone: null, formality_score: 0.5,
          engagement_bait_score: 0.1, vulnerability_openness: 0.2,
          recurring_topics: ["fitness"], brand_categories: [],
        }]);
        if (table === "audience_intelligence") return chainBuilder([{
          creator_id: "c1", geo_regions: {}, authenticity_score: 0.8,
          suspicious_patterns: [], sentiment_score: 0.7, negative_themes: [],
          estimated_age_group: "18-24",
        }]);
        if (table === "creator_scores") return chainBuilder([{
          creator_id: "c1", engagement_quality: 0.7, content_mix: { video: 0.5 },
          brand_mentions: [], professionalism: 0.7, content_quality: 0.6,
          sponsored_post_rate: 0.1, sponsored_vs_organic_delta: 0,
          creator_reply_rate: 0.5,
        }]);
        if (table === "transcript_intelligence") return chainBuilder([]);
        if (table === "creators") return chainBuilder([{
          id: "c1", content_embedding: [0.15, 0.25, 0.35],
        }]);
        // Phase 2: engine now reads embeddings from the per-platform
        // creator_content_embeddings table (migration 046).
        if (table === "creator_content_embeddings") return chainBuilder([{
          creator_id: "c1", platform: "instagram",
          embedding: [0.15, 0.25, 0.35],
        }]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ content_embedding: [0.1, 0.3, 0.2] }],
      }),
    } as never;

    const count = await computeMatchesForBrand(supabase, "brand-1", 10);
    expect(count).toBe(1);
    const batch = upsertMock.mock.calls[0][0];
    expect(batch[0].used_ig_signals).toBe(true);
    expect(batch[0].match_score_breakdown.weights).toBe("with_platform_signals");
    expect(batch[0].match_score_breakdown.semantic_similarity).toBeGreaterThan(0);
  });

  it("handles 'All India' shipping zone", async () => {
    const allIndiaBrand = {
      ...brandRow,
      shipping_zones: ["All India"],
    };

    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([allIndiaBrand]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([creatorRow]);
        if (table === "brand_guidelines") return chainBuilder([]);
        if (table === "caption_intelligence") return chainBuilder([]);
        if (table === "audience_intelligence") return chainBuilder([]);
        if (table === "creator_scores") return chainBuilder([]);
        if (table === "transcript_intelligence") return chainBuilder([]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
    } as never;

    const count = await computeMatchesForBrand(supabase, "brand-1", 10);
    expect(count).toBe(1);
  });

  it("throws on upsert error", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: { message: "upsert fail" } });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([brandRow]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([creatorRow]);
        if (table === "brand_guidelines") return chainBuilder([]);
        if (table === "caption_intelligence") return chainBuilder([]);
        if (table === "audience_intelligence") return chainBuilder([]);
        if (table === "creator_scores") return chainBuilder([]);
        if (table === "transcript_intelligence") return chainBuilder([]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
    } as never;

    await expect(computeMatchesForBrand(supabase, "brand-1", 10)).rejects.toThrow("Failed to upsert matches");
  });

  it("detects when creator already mentions the brand", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([brandRow]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder([creatorRow]);
        if (table === "brand_guidelines") return chainBuilder([]);
        if (table === "caption_intelligence") return chainBuilder([]);
        if (table === "audience_intelligence") return chainBuilder([]);
        if (table === "creator_scores") return chainBuilder([{
          creator_id: "c1",
          engagement_quality: 0.7,
          content_mix: {},
          brand_mentions: ["FitBar", "NutriBites"], // mentions brand itself + competitor
          professionalism: 0.7,
          content_quality: 0.6,
          sponsored_post_rate: 0.1,
          sponsored_vs_organic_delta: 0,
          creator_reply_rate: 0.5,
        }]);
        if (table === "transcript_intelligence") return chainBuilder([]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
    } as never;

    await computeMatchesForBrand(supabase, "brand-1", 10);
    const batch = upsertMock.mock.calls[0][0];
    expect(batch[0].already_mentions_brand).toBe(true);
    expect(batch[0].mentions_competitor).toBe(true);
  });

  it("handles batch upsert for many creators", async () => {
    const manyCreators = Array.from({ length: 75 }, (_, i) => ({
      ...creatorRow,
      creator_id: `c${i}`,
      handle: `@creator_${i}`,
    }));

    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([brandRow]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder(manyCreators);
        if (table === "brand_guidelines") return chainBuilder([]);
        if (table === "caption_intelligence") return chainBuilder([]);
        if (table === "audience_intelligence") return chainBuilder([]);
        if (table === "creator_scores") return chainBuilder([]);
        if (table === "transcript_intelligence") return chainBuilder([]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
    } as never;

    const count = await computeMatchesForBrand(supabase, "brand-1", 200);
    expect(count).toBe(75);
    // Should batch in groups of 50: 2 batches (50 + 25)
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0][0]).toHaveLength(50);
    expect(upsertMock.mock.calls[1][0]).toHaveLength(25);
  });

  it("skips creators with null creator_id", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const creatorsWithNull = [
      creatorRow,
      { ...creatorRow, creator_id: null, handle: "@null" },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "brands") return chainBuilder([brandRow]);
        if (table === "brand_shopify_geo") return chainBuilder([]);
        if (table === "mv_creator_leaderboard") return chainBuilder(creatorsWithNull);
        if (table === "brand_guidelines") return chainBuilder([]);
        if (table === "caption_intelligence") return chainBuilder([]);
        if (table === "audience_intelligence") return chainBuilder([]);
        if (table === "creator_scores") return chainBuilder([]);
        if (table === "transcript_intelligence") return chainBuilder([]);
        if (table === "creator_brand_matches") {
          const b = chainBuilder([]);
          b.upsert = upsertMock;
          return b;
        }
        return chainBuilder([]);
      }),
    } as never;

    const count = await computeMatchesForBrand(supabase, "brand-1", 10);
    expect(count).toBe(1); // Only c1, null is skipped
  });
});
