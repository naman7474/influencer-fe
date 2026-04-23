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
  MIN_SUFFICIENT_SUBSCORES,
  type CaptionIntelForSafety,
  type AudienceIntelForSafety,
  type CreatorScoresForSafety,
  type BrandSafetyConfig,
  type SubScoreResult,
} from "../brand-safety";

// ── Helpers ──────────────────────────────────────────────────────────

function makeCaptionIntel(
  overrides: Partial<CaptionIntelForSafety> = {}
): CaptionIntelForSafety {
  return {
    primary_tone: "casual",
    secondary_tone: null,
    formality_score: 50,
    engagement_bait_score: 0.1,
    vulnerability_openness: 0.2,
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

function assertSufficient(
  r: SubScoreResult
): asserts r is Extract<SubScoreResult, { sufficient: true }> {
  expect(r.sufficient).toBe(true);
}

// ── parseAgeLowerBound (unchanged from prior contract) ────────────────

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
  it("returns null for empty string", () => {
    expect(parseAgeLowerBound("")).toBeNull();
  });
});

// ── computeContentAppropriateness — fail-loud on missing input ────────

describe("computeContentAppropriateness", () => {
  it("returns insufficient when engagement_bait_score missing", () => {
    const r = computeContentAppropriateness(
      makeCaptionIntel({ engagement_bait_score: null }),
      makeAudienceIntel(),
      []
    );
    expect(r.sufficient).toBe(false);
    if (!r.sufficient) expect(r.reason).toMatch(/engagement_bait_score/);
  });

  it("returns insufficient when caption intel is null", () => {
    const r = computeContentAppropriateness(null, null, []);
    expect(r.sufficient).toBe(false);
  });

  it("returns ~1.0 when no penalties apply", () => {
    const r = computeContentAppropriateness(
      makeCaptionIntel({ engagement_bait_score: 0 }),
      makeAudienceIntel(),
      []
    );
    assertSufficient(r);
    expect(r.score).toBeCloseTo(1.0, 1);
  });

  it("penalizes high engagement bait score", () => {
    const r = computeContentAppropriateness(
      makeCaptionIntel({ engagement_bait_score: 0.8 }),
      makeAudienceIntel(),
      []
    );
    assertSufficient(r);
    expect(r.score).toBeLessThan(0.75);
  });

  it("applies forbidden-topic overlap penalty", () => {
    const r = computeContentAppropriateness(
      makeCaptionIntel({
        engagement_bait_score: 0,
        recurring_topics: ["gambling", "alcohol"],
      }),
      makeAudienceIntel(),
      ["gambling", "alcohol"]
    );
    assertSufficient(r);
    expect(r.score).toBeLessThan(0.5);
  });
});

// ── computeAudienceSafety — fail-loud ─────────────────────────────────

describe("computeAudienceSafety", () => {
  it("returns insufficient when authenticity_score missing", () => {
    const r = computeAudienceSafety(
      makeAudienceIntel({ authenticity_score: null }),
      null
    );
    expect(r.sufficient).toBe(false);
  });

  it("returns insufficient when audience intel is null", () => {
    expect(computeAudienceSafety(null, 18).sufficient).toBe(false);
  });

  it("returns high score for authentic, age-appropriate audience", () => {
    const r = computeAudienceSafety(makeAudienceIntel(), null);
    assertSufficient(r);
    expect(r.score).toBeGreaterThan(0.7);
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
    assertSufficient(mismatch);
    assertSufficient(match);
    expect(mismatch.score).toBeLessThan(match.score);
    expect(mismatch.score).toBeLessThan(0.7);
  });

  it("lowers confidence when age group unknown but brand requires minimum", () => {
    const r = computeAudienceSafety(
      makeAudienceIntel({ estimated_age_group: null }),
      18
    );
    assertSufficient(r);
    expect(r.confidence).toBeLessThan(1.0);
  });
});

// ── computeToneAlignment — voice-pref branch semantics ────────────────

describe("computeToneAlignment", () => {
  it("returns sufficient/low-confidence 0.7 when brand has no pref", () => {
    const r = computeToneAlignment(makeCaptionIntel(), null);
    assertSufficient(r);
    expect(r.score).toBe(0.7);
    expect(r.confidence).toBeLessThan(1.0);
  });

  it("returns insufficient when brand has pref but creator tone missing", () => {
    const r = computeToneAlignment(
      makeCaptionIntel({ primary_tone: null }),
      "professional"
    );
    expect(r.sufficient).toBe(false);
  });

  it("returns 1.0 for exact primary tone match", () => {
    const r = computeToneAlignment(
      makeCaptionIntel({ primary_tone: "professional" }),
      "professional"
    );
    assertSufficient(r);
    expect(r.score).toBe(1.0);
  });

  it("returns 0.8 for secondary tone match", () => {
    const r = computeToneAlignment(
      makeCaptionIntel({
        primary_tone: "casual",
        secondary_tone: "professional",
      }),
      "professional"
    );
    assertSufficient(r);
    expect(r.score).toBe(0.8);
  });

  it("returns 0.6 for adjacent tone", () => {
    const r = computeToneAlignment(
      makeCaptionIntel({ primary_tone: "educational" }),
      "professional"
    );
    assertSufficient(r);
    expect(r.score).toBe(0.6);
  });
});

// ── computeProfessionalismScore — fail-loud when both inputs null ─────

describe("computeProfessionalismScore", () => {
  it("returns insufficient when both professionalism and content_quality null", () => {
    const r = computeProfessionalismScore(
      makeCreatorScores({ professionalism: null, content_quality: null }),
      null
    );
    expect(r.sufficient).toBe(false);
  });

  it("returns insufficient when scores row is null", () => {
    expect(computeProfessionalismScore(null, null).sufficient).toBe(false);
  });

  it("uses content_quality alone when professionalism null", () => {
    const r = computeProfessionalismScore(
      makeCreatorScores({ professionalism: null, content_quality: 80 }),
      null
    );
    assertSufficient(r);
    expect(r.confidence).toBeLessThan(1.0); // partial data
  });

  it("returns high score for high professionalism and low oversharing", () => {
    const r = computeProfessionalismScore(
      makeCreatorScores({ professionalism: 90, content_quality: 85 }),
      makeCaptionIntel({ vulnerability_openness: 0.1 })
    );
    assertSufficient(r);
    expect(r.score).toBeGreaterThan(0.7);
  });
});

// ── computeCollaborationHistory — fail-loud on missing sponsored rate ─

describe("computeCollaborationHistory", () => {
  it("returns insufficient when sponsored_post_rate missing", () => {
    const r = computeCollaborationHistory(
      makeCreatorScores({ sponsored_post_rate: null }),
      makeCaptionIntel(),
      []
    );
    expect(r.sufficient).toBe(false);
  });

  it("returns insufficient when scores row is null", () => {
    expect(
      computeCollaborationHistory(null, null, []).sufficient
    ).toBe(false);
  });

  it("scores optimal sponsored rate (5-30%) highest", () => {
    const r = computeCollaborationHistory(
      makeCreatorScores({ sponsored_post_rate: 0.15 }),
      makeCaptionIntel({ brand_categories: ["health food"] }),
      ["health food"]
    );
    assertSufficient(r);
    expect(r.score).toBeGreaterThan(0.7);
  });
});

// ── computeBrandSafety (orchestrator) ─────────────────────────────────

describe("computeBrandSafety", () => {
  it("weights sum to 1.0", () => {
    const sum = Object.values(BRAND_SAFETY_WEIGHTS).reduce(
      (a, b) => a + b,
      0
    );
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("returns high composite for all-good inputs", () => {
    const r = computeBrandSafety(
      makeCaptionIntel({
        primary_tone: "professional",
        engagement_bait_score: 0,
        vulnerability_openness: 0.1,
      }),
      makeAudienceIntel(),
      makeCreatorScores({ professionalism: 90, content_quality: 90 }),
      makeConfig({ brand_voice_preference: "professional" })
    );
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(0.75);
    expect(r.manual_review_required).toBe(false);
    expect(r.sufficient_count).toBe(5);
  });

  it("returns low composite for all-bad inputs", () => {
    const r = computeBrandSafety(
      makeCaptionIntel({
        primary_tone: "sarcastic",
        engagement_bait_score: 0.95,
        vulnerability_openness: 0.9,
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
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeLessThan(0.3);
  });

  it("returns score=null + manual_review_required when all data is null", () => {
    const r = computeBrandSafety(null, null, null, makeConfig());
    // With null intel + null pref: tone-alignment still returns sufficient
    // (pref-absent branch), but all other 4 dims fail. Since 1 < 3, we
    // route to manual review.
    expect(r.sufficient_count).toBeLessThan(MIN_SUFFICIENT_SUBSCORES);
    expect(r.score).toBeNull();
    expect(r.manual_review_required).toBe(true);
    expect(r.missing_inputs.length).toBeGreaterThan(0);
  });

  it("renormalizes weights over sufficient dims (still composes when 3 of 5 present)", () => {
    // Deliberately starve tone_alignment (brand pref set, creator tone missing)
    // and collaboration_history (sponsored_post_rate null).
    const r = computeBrandSafety(
      makeCaptionIntel({
        primary_tone: null,
        secondary_tone: null,
        engagement_bait_score: 0,
      }),
      makeAudienceIntel(),
      makeCreatorScores({ sponsored_post_rate: null }),
      makeConfig({ brand_voice_preference: "professional" })
    );
    expect(r.sufficient_count).toBe(3);
    expect(r.score).not.toBeNull();
    expect(r.manual_review_required).toBe(false);
  });

  it("includes sub-dim reasons in missing_inputs", () => {
    const r = computeBrandSafety(
      makeCaptionIntel({ engagement_bait_score: null }),
      null,
      null,
      makeConfig()
    );
    expect(r.missing_inputs.some((m) => m.includes("content_appropriateness"))).toBe(
      true
    );
  });
});
