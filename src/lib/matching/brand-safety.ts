/* ------------------------------------------------------------------ */
/*  Brand Safety Scoring — sub-dimensions for brand-creator alignment  */
/*  Pure functions, no I/O. All inputs passed in.                      */
/*                                                                     */
/*  W5: every sub-dimension returns a SubScoreResult. Missing inputs   */
/*  no longer silently produce a 0.5 neutral — they return             */
/*  `{ sufficient: false }` so the orchestrator can exclude the        */
/*  creator from ranking when < 3 of 5 sub-dims are usable.            */
/* ------------------------------------------------------------------ */

import { NICHE_ADJACENCY } from "./engine";
import {
  DEFAULT_PERCENTILES,
  percentileRank,
  type Percentiles,
} from "./calibration";

// ── Types ────────────────────────────────────────────────────────────

type ContentTone =
  | "casual"
  | "professional"
  | "funny"
  | "emotional"
  | "educational"
  | "inspirational"
  | "sarcastic"
  | "raw"
  | "polished";

export interface CaptionIntelForSafety {
  primary_tone: ContentTone | null;
  secondary_tone: ContentTone | null;
  formality_score: number | null;
  engagement_bait_score: number | null;
  vulnerability_openness: number | null;
  recurring_topics: string[] | null;
  brand_categories: string[] | null;
}

export interface AudienceIntelForSafety {
  authenticity_score: number | null;
  suspicious_patterns: string[] | null;
  estimated_age_group: string | null;
  sentiment_score: number | null;
  negative_themes: string[] | null;
}

export interface CreatorScoresForSafety {
  professionalism: number | null;
  content_quality: number | null;
  creator_reply_rate: number | null;
  sponsored_post_rate: number | null;
  sponsored_vs_organic_delta: number | null;
}

export interface BrandSafetyConfig {
  brand_voice_preference: ContentTone | null;
  min_audience_age: number | null;
  product_categories: string[];
  forbidden_topics: string[];
}

/**
 * One sub-dimension result. When `sufficient=false`, the caller must
 * NOT use `score` — renormalize weights over the sufficient dims.
 * `confidence` is an optional per-sub-dim self-rating ∈ [0, 1].
 */
export type SubScoreResult =
  | { score: number; sufficient: true; confidence?: number; reason?: string }
  | { score: null; sufficient: false; reason: string };

export interface BrandSafetyResult {
  /** null when fewer than MIN_SUFFICIENT_SUBSCORES dims are usable. */
  score: number | null;
  confidence: number;
  sufficient_count: number;
  total_count: number;
  missing_inputs: string[];
  per_subscore: Record<string, SubScoreResult>;
  /** True when the engine should route this to manual review. */
  manual_review_required: boolean;
}

// ── Weights ──────────────────────────────────────────────────────────

export const BRAND_SAFETY_WEIGHTS = {
  content_appropriateness: 0.3,
  audience_safety: 0.25,
  tone_alignment: 0.2,
  professionalism: 0.15,
  collaboration_history: 0.1,
} as const;

export const MIN_SUFFICIENT_SUBSCORES = 3;

/**
 * When false, sub-scores use the legacy hardcoded cutoffs and ignore
 * any calibration overrides passed in. When true, the caller's
 * calibration snapshot drives the band boundaries. Keep false in
 * production until `scoring_calibration` has at least one row
 * per metric from a real recalibration run.
 *
 * The flag is read at call time (per-score) rather than at module
 * load so tests can flip it without juggling imports.
 */
export function isCalibratedMode(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.BRAND_MATCH_CALIBRATED === "true";
}

export interface BrandSafetyCalibration {
  engagement_bait: Percentiles;
  authenticity: Percentiles;
  sponsored_rate: Percentiles;
}

export const DEFAULT_BRAND_SAFETY_CALIBRATION: BrandSafetyCalibration = {
  engagement_bait: DEFAULT_PERCENTILES.engagement_bait,
  authenticity: DEFAULT_PERCENTILES.authenticity,
  sponsored_rate: DEFAULT_PERCENTILES.sponsored_rate,
};

// ── Tone adjacency map ───────────────────────────────────────────────

export const TONE_ADJACENCY: Record<string, string[]> = {
  casual: ["funny", "raw", "inspirational"],
  professional: ["educational", "polished"],
  funny: ["casual", "sarcastic", "raw"],
  emotional: ["inspirational", "raw"],
  educational: ["professional", "inspirational", "polished"],
  inspirational: ["emotional", "educational", "casual"],
  sarcastic: ["funny", "raw", "casual"],
  raw: ["casual", "funny", "emotional", "sarcastic"],
  polished: ["professional", "educational"],
};

// ── Sub-dimension functions ──────────────────────────────────────────

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Content Appropriateness (weight 0.30).
 * Needs `engagement_bait_score` to have a real reading; otherwise
 * returns insufficient.
 */
export function computeContentAppropriateness(
  captionIntel: CaptionIntelForSafety | null,
  audienceIntel: AudienceIntelForSafety | null,
  forbiddenTopics: string[],
  calibration: BrandSafetyCalibration = DEFAULT_BRAND_SAFETY_CALIBRATION,
): SubScoreResult {
  if (captionIntel?.engagement_bait_score == null) {
    return {
      score: null,
      sufficient: false,
      reason: "caption_intelligence.engagement_bait_score missing",
    };
  }

  let score = 1.0;
  // Engagement bait penalty. Legacy mode: fixed linear weight.
  // Calibrated mode: map reading to its percentile in the cohort,
  // so p50 ≈ "normal" (no penalty) and p90+ incurs the full 0.4
  // deduction. Keeps the max-penalty identical to the hardcode.
  if (isCalibratedMode()) {
    const rank = percentileRank(
      captionIntel.engagement_bait_score,
      calibration.engagement_bait,
    );
    // Penalize the top half: rank∈[0.5,1] → deduction∈[0,0.4]
    const deduction = Math.max(0, (rank - 0.5) * 0.8);
    score -= Math.min(0.4, deduction);
  } else {
    score -= captionIntel.engagement_bait_score * 0.4;
  }

  const negativeThemes = audienceIntel?.negative_themes ?? [];
  if (negativeThemes.length > 0) {
    score -= Math.min(0.3, negativeThemes.length * 0.1);
  }

  if (forbiddenTopics.length > 0 && captionIntel?.recurring_topics?.length) {
    const forbidden = new Set(
      forbiddenTopics.map((t) => t.toLowerCase().trim()),
    );
    const topics = captionIntel.recurring_topics.map((t) =>
      t.toLowerCase().trim(),
    );
    let matches = 0;
    for (const topic of topics) {
      if (forbidden.has(topic)) matches++;
    }
    score -= Math.min(0.6, matches * 0.3);
  }

  return {
    score: clamp(score),
    sufficient: true,
    confidence: 1.0,
  };
}

/**
 * Audience Safety (weight 0.25).
 * Needs `authenticity_score` to have a real reading.
 */
export function computeAudienceSafety(
  audienceIntel: AudienceIntelForSafety | null,
  minAudienceAge: number | null,
  calibration: BrandSafetyCalibration = DEFAULT_BRAND_SAFETY_CALIBRATION,
): SubScoreResult {
  if (audienceIntel?.authenticity_score == null) {
    return {
      score: null,
      sufficient: false,
      reason: "audience_intelligence.authenticity_score missing",
    };
  }

  // Legacy: use raw authenticity (0-1) directly.
  // Calibrated: translate the raw value into its percentile rank so
  // "authentic vs. our cohort" drives the score, not an absolute
  // threshold. Preserves direction (higher = safer).
  let authenticity = isCalibratedMode()
    ? percentileRank(
        audienceIntel.authenticity_score,
        calibration.authenticity,
      )
    : audienceIntel.authenticity_score;
  const suspiciousPatterns = audienceIntel.suspicious_patterns ?? [];
  if (suspiciousPatterns.length > 0) {
    authenticity -= Math.min(0.3, suspiciousPatterns.length * 0.1);
  }
  authenticity = clamp(authenticity);

  let ageSafety = 1.0;
  let ageKnown = true;
  if (minAudienceAge != null && audienceIntel.estimated_age_group) {
    const lowerBound = parseAgeLowerBound(audienceIntel.estimated_age_group);
    if (lowerBound != null && lowerBound < minAudienceAge) {
      ageSafety = 0.0;
    }
  } else if (minAudienceAge != null && !audienceIntel.estimated_age_group) {
    ageSafety = 0.7;
    ageKnown = false;
  }

  const sentiment = audienceIntel.sentiment_score ?? 0.5;

  return {
    score: clamp(authenticity * 0.5 + ageSafety * 0.3 + sentiment * 0.2),
    sufficient: true,
    confidence: ageKnown ? 1.0 : 0.7,
  };
}

export function parseAgeLowerBound(ageGroup: string): number | null {
  if (!ageGroup) return null;
  const lower = ageGroup.toLowerCase().trim();

  const underMatch = lower.match(/under\s+(\d+)/);
  if (underMatch) return parseInt(underMatch[1], 10) - 1;

  const rangeMatch = lower.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);

  const numMatch = lower.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return null;
}

/**
 * Tone Alignment (weight 0.20).
 * When the brand has no `brand_voice_preference`, returns the
 * previous 0.7 pref-absent behavior marked sufficient/low-confidence.
 * When the brand DOES have a pref but the creator's tone is missing,
 * returns insufficient.
 */
export function computeToneAlignment(
  captionIntel: CaptionIntelForSafety | null,
  brandVoicePref: ContentTone | null,
): SubScoreResult {
  if (!brandVoicePref) {
    return { score: 0.7, sufficient: true, confidence: 0.5 };
  }
  if (!captionIntel?.primary_tone) {
    return {
      score: null,
      sufficient: false,
      reason: "caption_intelligence.primary_tone missing (brand voice pref set)",
    };
  }

  const primary = captionIntel.primary_tone;
  const secondary = captionIntel.secondary_tone;
  const pref = brandVoicePref.toLowerCase().trim();

  let baseScore = 0.3;
  if (primary.toLowerCase().trim() === pref) {
    baseScore = 1.0;
  } else if (secondary?.toLowerCase().trim() === pref) {
    baseScore = 0.8;
  } else {
    const adjacent = TONE_ADJACENCY[pref] ?? [];
    if (
      adjacent.includes(primary.toLowerCase().trim()) ||
      (secondary && adjacent.includes(secondary.toLowerCase().trim()))
    ) {
      baseScore = 0.6;
    }
  }

  if (captionIntel.formality_score != null) {
    if (
      (pref === "professional" || pref === "polished") &&
      captionIntel.formality_score < 30
    ) {
      baseScore -= 0.2;
    } else if (
      (pref === "casual" || pref === "raw") &&
      captionIntel.formality_score > 80
    ) {
      baseScore -= 0.1;
    }
  }

  return { score: clamp(baseScore), sufficient: true, confidence: 1.0 };
}

/**
 * Professionalism Score (weight 0.15).
 * Needs at least one of `professionalism` or `content_quality`.
 */
export function computeProfessionalismScore(
  creatorScores: CreatorScoresForSafety | null,
  captionIntel: CaptionIntelForSafety | null,
): SubScoreResult {
  const prof = creatorScores?.professionalism;
  const quality = creatorScores?.content_quality;
  if (prof == null && quality == null) {
    return {
      score: null,
      sufficient: false,
      reason: "creator_scores.professionalism AND content_quality both missing",
    };
  }

  let qualityComposite: number;
  if (prof != null && quality != null) {
    qualityComposite = (prof / 100 + quality / 100) / 2;
  } else if (prof != null) {
    qualityComposite = prof / 100;
  } else {
    qualityComposite = (quality as number) / 100;
  }

  const replyRate = creatorScores?.creator_reply_rate ?? 0.5;
  const vuln = captionIntel?.vulnerability_openness ?? 0;
  const oversharingScore = 1.0 - Math.max(0, (vuln - 0.5) / 0.5);

  return {
    score: clamp(qualityComposite * 0.6 + replyRate * 0.2 + oversharingScore * 0.2),
    sufficient: true,
    confidence: prof != null && quality != null ? 1.0 : 0.75,
  };
}

/**
 * Collaboration History (weight 0.10).
 * Needs `sponsored_post_rate` as the primary signal.
 */
export function computeCollaborationHistory(
  creatorScores: CreatorScoresForSafety | null,
  captionIntel: CaptionIntelForSafety | null,
  brandProductCategories: string[],
  calibration: BrandSafetyCalibration = DEFAULT_BRAND_SAFETY_CALIBRATION,
): SubScoreResult {
  if (creatorScores?.sponsored_post_rate == null) {
    return {
      score: null,
      sufficient: false,
      reason: "creator_scores.sponsored_post_rate missing",
    };
  }

  const rate = creatorScores.sponsored_post_rate;
  let sponsoredExp: number;
  if (isCalibratedMode()) {
    // Calibrated bands: p25–p75 is the "healthy" band (brands want
    // creators who do sponsor work, but not an ad feed). Below p25 →
    // low experience, above p75 → ad-fatigue risk, above p90 →
    // highest risk. Mirrors the legacy shape but anchored in cohort
    // reality instead of 0.05/0.30/0.50 folklore.
    const p = calibration.sponsored_rate;
    if (rate >= p.p25 && rate <= p.p75) sponsoredExp = 1.0;
    else if (rate < p.p25) sponsoredExp = 0.6;
    else if (rate <= p.p90) sponsoredExp = 0.7;
    else sponsoredExp = 0.4;
  } else {
    if (rate >= 0.05 && rate <= 0.3) sponsoredExp = 1.0;
    else if (rate < 0.05) sponsoredExp = 0.6;
    else if (rate <= 0.5) sponsoredExp = 0.7;
    else sponsoredExp = 0.4;
  }

  let qualityConsistency = 0.5;
  if (creatorScores.sponsored_vs_organic_delta != null) {
    qualityConsistency = clamp(
      1.0 - Math.min(1.0, Math.abs(creatorScores.sponsored_vs_organic_delta) / 30),
    );
  }

  let categoryAlignment = 0.5;
  if (captionIntel?.brand_categories?.length && brandProductCategories.length) {
    const creatorCats = captionIntel.brand_categories.map((c) =>
      c.toLowerCase().trim(),
    );
    const brandCats = brandProductCategories.map((c) =>
      c.toLowerCase().trim(),
    );

    const directOverlap = creatorCats.some((c) => brandCats.includes(c));
    if (directOverlap) {
      categoryAlignment = 1.0;
    } else {
      let adjacent = false;
      for (const cc of creatorCats) {
        const adj = NICHE_ADJACENCY[cc] ?? [];
        if (adj.some((a) => brandCats.includes(a))) {
          adjacent = true;
          break;
        }
      }
      categoryAlignment = adjacent ? 0.7 : 0.3;
    }
  }

  return {
    score: clamp(
      sponsoredExp * 0.3 + qualityConsistency * 0.3 + categoryAlignment * 0.4,
    ),
    sufficient: true,
    confidence: 1.0,
  };
}

// ── Orchestrator ─────────────────────────────────────────────────────

/**
 * Compute the composite brand safety score with fail-loud handling.
 *
 * - When fewer than MIN_SUFFICIENT_SUBSCORES dims are sufficient,
 *   `score=null` and `manual_review_required=true`. The matching
 *   engine excludes these from default ranking.
 * - Otherwise, renormalizes the 5 fixed weights over just the
 *   sufficient dims so they sum to 1.0 and composes the score.
 */
export function computeBrandSafety(
  captionIntel: CaptionIntelForSafety | null,
  audienceIntel: AudienceIntelForSafety | null,
  creatorScores: CreatorScoresForSafety | null,
  config: BrandSafetyConfig,
  calibration: BrandSafetyCalibration = DEFAULT_BRAND_SAFETY_CALIBRATION,
): BrandSafetyResult {
  const results: Record<string, SubScoreResult> = {
    content_appropriateness: computeContentAppropriateness(
      captionIntel,
      audienceIntel,
      config.forbidden_topics,
      calibration,
    ),
    audience_safety: computeAudienceSafety(
      audienceIntel,
      config.min_audience_age,
      calibration,
    ),
    tone_alignment: computeToneAlignment(
      captionIntel,
      config.brand_voice_preference,
    ),
    professionalism: computeProfessionalismScore(creatorScores, captionIntel),
    collaboration_history: computeCollaborationHistory(
      creatorScores,
      captionIntel,
      config.product_categories,
      calibration,
    ),
  };

  const sufficientKeys = Object.keys(results).filter(
    (k) => results[k].sufficient,
  );
  const missingInputs = Object.entries(results)
    .filter(([, r]) => !r.sufficient)
    .map(([k, r]) => `${k}: ${r.reason ?? "missing"}`);

  if (sufficientKeys.length < MIN_SUFFICIENT_SUBSCORES) {
    return {
      score: null,
      confidence: 0,
      sufficient_count: sufficientKeys.length,
      total_count: Object.keys(results).length,
      missing_inputs: missingInputs,
      per_subscore: results,
      manual_review_required: true,
    };
  }

  // Renormalize fixed weights over the sufficient dims.
  const totalWeight = sufficientKeys.reduce(
    (sum, k) =>
      sum + BRAND_SAFETY_WEIGHTS[k as keyof typeof BRAND_SAFETY_WEIGHTS],
    0,
  );
  let composed = 0;
  let confidenceSum = 0;
  for (const k of sufficientKeys) {
    const r = results[k] as Extract<SubScoreResult, { sufficient: true }>;
    const w =
      BRAND_SAFETY_WEIGHTS[k as keyof typeof BRAND_SAFETY_WEIGHTS] /
      totalWeight;
    composed += r.score * w;
    confidenceSum += (r.confidence ?? 1.0) * w;
  }

  return {
    score: clamp(composed),
    confidence: clamp(confidenceSum),
    sufficient_count: sufficientKeys.length,
    total_count: Object.keys(results).length,
    missing_inputs: missingInputs,
    per_subscore: results,
    manual_review_required: false,
  };
}
