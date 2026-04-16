import { describe, it, expect } from "vitest";
import {
  computeContentAppropriateness,
  computeAudienceSafety,
  computeToneAlignment,
  computeProfessionalismScore,
  computeCollaborationHistory,
  computeBrandSafety,
  parseAgeLowerBound,
  BRAND_SAFETY_WEIGHTS,
  type CaptionIntelForSafety,
  type AudienceIntelForSafety,
  type CreatorScoresForSafety,
  type BrandSafetyConfig,
} from "../brand-safety";

// ── Helpers ──────────────────────────────────────────────────────────

function makeCaptionIntel(
  overrides: Partial<CaptionIntelForSafety> = {}
): CaptionIntelForSafety {
  return {
    primary_tone: "casual",
    secondary_tone: null,
    formality_score: 50,
    engagement_bait_score: 10,
    vulnerability_openness: 20,
    recurring_topics: ["fitness", "health"],
    brand_categories: ["health food"],
    ...overrides,
  };
}

function makeAudienceIntel(
  overrides: Partial<AudienceIntelForSafety> = {}
): AudienceIntelForSafety {
  return {
    authenticity_score: 0.9,
    suspicious_patterns: [],
    estimated_age_group: "25-34",
    sentiment_score: 0.8,
    negative_themes: [],
    ...overrides,
  };
}

function makeCreatorScores(
  overrides: Partial<CreatorScoresForSafety> = {}
): CreatorScoresForSafety {
  return {
    professionalism: 75,
    content_quality: 80,
    creator_reply_rate: 0.6,
    sponsored_post_rate: 0.15,
    sponsored_vs_organic_delta: 5,
    ...overrides,
  };
}

function makeConfig(
  overrides: Partial<BrandSafetyConfig> = {}
): BrandSafetyConfig {
  return {
    brand_voice_preference: null,
    min_audience_age: null,
    product_categories: ["health food"],
    forbidden_topics: [],
    ...overrides,
  };
}

// ── parseAgeLowerBound ───────────────────────────────────────────────

describe("parseAgeLowerBound", () => {
  it("parses range format '18-24'", () => {
    expect(parseAgeLowerBound("18-24")).toBe(18);
  });

  it("parses range with en-dash '25–34'", () => {
    expect(parseAgeLowerBound("25–34")).toBe(25);
  });

  it("parses 'Under 18'", () => {
    expect(parseAgeLowerBound("Under 18")).toBe(17);
  });

  it("parses '35+'", () => {
    expect(parseAgeLowerBound("35+")).toBe(35);
  });

  it("parses '13-17'", () => {
    expect(parseAgeLowerBound("13-17")).toBe(13);
  });

  it("returns null for empty string", () => {
    expect(parseAgeLowerBound("")).toBeNull();
  });
});

// ── computeContentAppropriateness ────────────────────────────────────

describe("computeContentAppropriateness", () => {
  it("returns 1.0 when no penalties apply", () => {
    const intel = makeCaptionIntel({ engagement_bait_score: 0 });
    expect(computeContentAppropriateness(intel, makeAudienceIntel(), [])).toBeCloseTo(1.0, 1);
  });

  it("penalizes high engagement bait score", () => {
    const intel = makeCaptionIntel({ engagement_bait_score: 80 });
    const score = computeContentAppropriateness(intel, makeAudienceIntel(), []);
    expect(score).toBeLessThan(0.7);
  });

  it("penalizes negative themes", () => {
    const audience = makeAudienceIntel({
      negative_themes: ["controversy", "drama", "hate"],
    });
    const score = computeContentAppropriateness(makeCaptionIntel({ engagement_bait_score: 0 }), audience, []);
    expect(score).toBeLessThanOrEqual(0.7);
  });

  it("applies forbidden topic overlap penalty", () => {
    const intel = makeCaptionIntel({ recurring_topics: ["gambling", "alcohol"] });
    const score = computeContentAppropriateness(intel, makeAudienceIntel(), [
      "gambling",
      "alcohol",
    ]);
    expect(score).toBeLessThan(0.5);
  });

  it("returns 0.5 when all data is null", () => {
    expect(computeContentAppropriateness(null, null, [])).toBe(0.5);
  });

  it("clamps to 0 when all penalties stack", () => {
    const intel = makeCaptionIntel({
      engagement_bait_score: 100,
      recurring_topics: ["gambling", "drugs"],
    });
    const audience = makeAudienceIntel({
      negative_themes: ["hate", "violence", "abuse"],
    });
    const score = computeContentAppropriateness(intel, audience, [
      "gambling",
      "drugs",
    ]);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ── computeAudienceSafety ────────────────────────────────────────────

describe("computeAudienceSafety", () => {
  it("returns high score for authentic, age-appropriate audience", () => {
    const score = computeAudienceSafety(makeAudienceIntel(), null);
    expect(score).toBeGreaterThan(0.7);
  });

  it("penalizes low authenticity", () => {
    const low = computeAudienceSafety(
      makeAudienceIntel({ authenticity_score: 0.3 }),
      null
    );
    const high = computeAudienceSafety(
      makeAudienceIntel({ authenticity_score: 0.95 }),
      null
    );
    expect(low).toBeLessThan(high);
    expect(low).toBeLessThan(0.7);
  });

  it("penalizes suspicious patterns", () => {
    const intel = makeAudienceIntel({
      suspicious_patterns: ["bot_follows", "click_farms"],
    });
    const score = computeAudienceSafety(intel, null);
    expect(score).toBeLessThan(
      computeAudienceSafety(makeAudienceIntel(), null)
    );
  });

  it("flags age mismatch when audience is too young", () => {
    const mismatch = computeAudienceSafety(
      makeAudienceIntel({ estimated_age_group: "13-17" }),
      18
    );
    const match = computeAudienceSafety(
      makeAudienceIntel({ estimated_age_group: "25-34" }),
      18
    );
    expect(mismatch).toBeLessThan(match);
    // Age mismatch component = 0.0 (weight 0.3), so score drops by ~0.3
    expect(mismatch).toBeLessThan(0.7);
  });

  it("returns 1.0 for age component when no min_audience_age", () => {
    const score = computeAudienceSafety(makeAudienceIntel(), null);
    // age component = 1.0, so score should be high
    expect(score).toBeGreaterThan(0.7);
  });

  it("returns 0.5 when audience intel is null", () => {
    expect(computeAudienceSafety(null, 18)).toBe(0.5);
  });

  it("low sentiment pulls score down", () => {
    const low = computeAudienceSafety(
      makeAudienceIntel({ sentiment_score: 0.1 }),
      null
    );
    const high = computeAudienceSafety(
      makeAudienceIntel({ sentiment_score: 0.9 }),
      null
    );
    expect(low).toBeLessThan(high);
  });
});

// ── computeToneAlignment ─────────────────────────────────────────────

describe("computeToneAlignment", () => {
  it("returns 1.0 for exact primary tone match", () => {
    const intel = makeCaptionIntel({ primary_tone: "professional" });
    expect(computeToneAlignment(intel, "professional")).toBe(1.0);
  });

  it("returns 0.8 for secondary tone match", () => {
    const intel = makeCaptionIntel({
      primary_tone: "casual",
      secondary_tone: "professional",
    });
    expect(computeToneAlignment(intel, "professional")).toBe(0.8);
  });

  it("returns 0.6 for adjacent tone match", () => {
    // educational is adjacent to professional
    const intel = makeCaptionIntel({ primary_tone: "educational" });
    expect(computeToneAlignment(intel, "professional")).toBe(0.6);
  });

  it("returns 0.3 for complete tone mismatch", () => {
    const intel = makeCaptionIntel({
      primary_tone: "sarcastic",
      secondary_tone: null,
      formality_score: 50,
    });
    expect(computeToneAlignment(intel, "polished")).toBe(0.3);
  });

  it("returns 0.7 when brand has no voice preference", () => {
    expect(computeToneAlignment(makeCaptionIntel(), null)).toBe(0.7);
  });

  it("applies formality mismatch penalty for professional brand + informal creator", () => {
    const intel = makeCaptionIntel({
      primary_tone: "professional",
      formality_score: 20, // very informal
    });
    const score = computeToneAlignment(intel, "professional");
    expect(score).toBe(0.8); // 1.0 - 0.2 penalty
  });

  it("returns 0.5 when caption intel is null", () => {
    expect(computeToneAlignment(null, "professional")).toBe(0.5);
  });
});

// ── computeProfessionalismScore ──────────────────────────────────────

describe("computeProfessionalismScore", () => {
  it("returns high score for high professionalism and quality", () => {
    const score = computeProfessionalismScore(
      makeCreatorScores({ professionalism: 90, content_quality: 85 }),
      makeCaptionIntel({ vulnerability_openness: 10 })
    );
    expect(score).toBeGreaterThan(0.7);
  });

  it("handles null professionalism (uses content_quality only)", () => {
    const score = computeProfessionalismScore(
      makeCreatorScores({ professionalism: null, content_quality: 80 }),
      null
    );
    expect(score).toBeGreaterThan(0.4);
  });

  it("handles both null scores", () => {
    const score = computeProfessionalismScore(
      makeCreatorScores({ professionalism: null, content_quality: null }),
      null
    );
    // quality composite = 0.5, reply rate contributed, oversharing = 1.0
    expect(score).toBeCloseTo(0.5, 0);
  });

  it("returns 0.5 when all data null", () => {
    expect(computeProfessionalismScore(null, null)).toBe(0.5);
  });

  it("penalizes high vulnerability/oversharing", () => {
    const low = computeProfessionalismScore(
      makeCreatorScores(),
      makeCaptionIntel({ vulnerability_openness: 90 })
    );
    const high = computeProfessionalismScore(
      makeCreatorScores(),
      makeCaptionIntel({ vulnerability_openness: 10 })
    );
    expect(low).toBeLessThan(high);
  });

  it("rewards high reply rate", () => {
    const low = computeProfessionalismScore(
      makeCreatorScores({ creator_reply_rate: 0.1 }),
      makeCaptionIntel()
    );
    const high = computeProfessionalismScore(
      makeCreatorScores({ creator_reply_rate: 0.9 }),
      makeCaptionIntel()
    );
    expect(low).toBeLessThan(high);
  });
});

// ── computeCollaborationHistory ──────────────────────────────────────

describe("computeCollaborationHistory", () => {
  it("scores optimal sponsored rate (5-30%) highest", () => {
    const score = computeCollaborationHistory(
      makeCreatorScores({ sponsored_post_rate: 0.15 }),
      makeCaptionIntel(),
      ["health food"]
    );
    expect(score).toBeGreaterThan(0.7);
  });

  it("penalizes oversaturated creators (>50%)", () => {
    const saturated = computeCollaborationHistory(
      makeCreatorScores({ sponsored_post_rate: 0.7 }),
      makeCaptionIntel(),
      ["health food"]
    );
    const optimal = computeCollaborationHistory(
      makeCreatorScores({ sponsored_post_rate: 0.15 }),
      makeCaptionIntel(),
      ["health food"]
    );
    expect(saturated).toBeLessThan(optimal);
  });

  it("penalizes inexperienced creators (<5%)", () => {
    const inexperienced = computeCollaborationHistory(
      makeCreatorScores({ sponsored_post_rate: 0.01 }),
      makeCaptionIntel(),
      ["health food"]
    );
    const optimal = computeCollaborationHistory(
      makeCreatorScores({ sponsored_post_rate: 0.15 }),
      makeCaptionIntel(),
      ["health food"]
    );
    expect(inexperienced).toBeLessThan(optimal);
  });

  it("rewards low sponsored-vs-organic delta", () => {
    const consistent = computeCollaborationHistory(
      makeCreatorScores({ sponsored_vs_organic_delta: 2 }),
      makeCaptionIntel(),
      ["health food"]
    );
    const inconsistent = computeCollaborationHistory(
      makeCreatorScores({ sponsored_vs_organic_delta: 25 }),
      makeCaptionIntel(),
      ["health food"]
    );
    expect(consistent).toBeGreaterThan(inconsistent);
  });

  it("scores category alignment with direct overlap", () => {
    const intel = makeCaptionIntel({ brand_categories: ["health food"] });
    const score = computeCollaborationHistory(
      makeCreatorScores(),
      intel,
      ["health food"]
    );
    expect(score).toBeGreaterThan(0.7);
  });

  it("returns 0.5 when all data null", () => {
    expect(computeCollaborationHistory(null, null, [])).toBe(0.5);
  });
});

// ── computeBrandSafety (orchestrator) ────────────────────────────────

describe("computeBrandSafety", () => {
  it("weights sum to 1.0", () => {
    const sum = Object.values(BRAND_SAFETY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("returns high score for all-good inputs", () => {
    const score = computeBrandSafety(
      makeCaptionIntel({
        primary_tone: "professional",
        engagement_bait_score: 0,
        vulnerability_openness: 10,
      }),
      makeAudienceIntel(),
      makeCreatorScores({ professionalism: 90, content_quality: 90 }),
      makeConfig({ brand_voice_preference: "professional" })
    );
    expect(score).toBeGreaterThan(0.8);
  });

  it("returns low score for all-bad inputs", () => {
    const score = computeBrandSafety(
      makeCaptionIntel({
        primary_tone: "sarcastic",
        engagement_bait_score: 95,
        vulnerability_openness: 90,
        recurring_topics: ["gambling", "drugs"],
        brand_categories: ["casino"],
      }),
      makeAudienceIntel({
        authenticity_score: 0.2,
        suspicious_patterns: ["bot_follows", "click_farms", "fake_comments"],
        sentiment_score: 0.1,
        negative_themes: ["hate", "abuse", "spam"],
        estimated_age_group: "13-17",
      }),
      makeCreatorScores({
        professionalism: 10,
        content_quality: 15,
        sponsored_post_rate: 0.8,
        sponsored_vs_organic_delta: 40,
      }),
      makeConfig({
        brand_voice_preference: "polished",
        min_audience_age: 18,
        forbidden_topics: ["gambling", "drugs"],
        product_categories: ["kids toys"],
      })
    );
    expect(score).toBeLessThan(0.3);
  });

  it("returns ~0.5 when all data is null", () => {
    const score = computeBrandSafety(null, null, null, makeConfig());
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.65);
  });
});
