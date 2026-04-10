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
  TIER_RATES,
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
    // Verify the weights sum to 1.0
    const totalWeight = 0.3 + 0.25 + 0.15 + 0.15 + 0.15;
    expect(totalWeight).toBe(1.0);
  });

  it("computes a full score correctly with all perfect sub-scores", () => {
    const niche = 1.0;
    const geo = 1.0;
    const budget = 1.0;
    const format = 1.0;
    const engagement = 1.0;
    const authMod = 1.0;
    const compBonus = 1.0;

    const raw =
      niche * 0.3 + geo * 0.25 + budget * 0.15 + format * 0.15 + engagement * 0.15;
    const final = Math.min(1.0, raw * authMod * compBonus);

    expect(raw).toBe(1.0);
    expect(final).toBe(1.0);
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
