/* ------------------------------------------------------------------ */
/*  Brand Safety Scoring — sub-dimensions for brand-creator alignment  */
/*  Pure functions, no I/O. All inputs passed in.                      */
/* ------------------------------------------------------------------ */

import { NICHE_ADJACENCY } from "./engine";

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

// ── Weights ──────────────────────────────────────────────────────────

export const BRAND_SAFETY_WEIGHTS = {
  content_appropriateness: 0.3,
  audience_safety: 0.25,
  tone_alignment: 0.2,
  professionalism: 0.15,
  collaboration_history: 0.1,
} as const;

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
 * Content Appropriateness (weight 0.30)
 * Penalizes engagement bait, negative themes, and forbidden topic overlap.
 */
export function computeContentAppropriateness(
  captionIntel: CaptionIntelForSafety | null,
  audienceIntel: AudienceIntelForSafety | null,
  forbiddenTopics: string[]
): number {
  if (!captionIntel && !audienceIntel) return 0.5;

  let score = 1.0;

  // Engagement bait penalty (0–100 scale → subtract up to 0.4)
  if (captionIntel?.engagement_bait_score != null) {
    score -= (captionIntel.engagement_bait_score / 100) * 0.4;
  }

  // Negative themes penalty (from audience comments)
  const negativeThemes = audienceIntel?.negative_themes ?? [];
  if (negativeThemes.length > 0) {
    score -= Math.min(0.3, negativeThemes.length * 0.1);
  }

  // Forbidden topic overlap (hardest signal)
  if (forbiddenTopics.length > 0 && captionIntel?.recurring_topics?.length) {
    const forbidden = new Set(forbiddenTopics.map((t) => t.toLowerCase().trim()));
    const topics = captionIntel.recurring_topics.map((t) => t.toLowerCase().trim());
    let matches = 0;
    for (const topic of topics) {
      if (forbidden.has(topic)) matches++;
    }
    score -= Math.min(0.6, matches * 0.3);
  }

  return clamp(score);
}

/**
 * Audience Safety (weight 0.25)
 * Checks authenticity, age appropriateness, and audience sentiment.
 */
export function computeAudienceSafety(
  audienceIntel: AudienceIntelForSafety | null,
  minAudienceAge: number | null
): number {
  if (!audienceIntel) return 0.5;

  // Authenticity component (weight 0.5 within this sub-score)
  let authenticity = audienceIntel.authenticity_score ?? 0.5;
  const suspiciousPatterns = audienceIntel.suspicious_patterns ?? [];
  if (suspiciousPatterns.length > 0) {
    authenticity -= Math.min(0.3, suspiciousPatterns.length * 0.1);
  }
  authenticity = clamp(authenticity);

  // Age safety component (weight 0.3)
  let ageSafety = 1.0;
  if (minAudienceAge != null && audienceIntel.estimated_age_group) {
    const lowerBound = parseAgeLowerBound(audienceIntel.estimated_age_group);
    if (lowerBound != null && lowerBound < minAudienceAge) {
      ageSafety = 0.0;
    }
  } else if (minAudienceAge != null && !audienceIntel.estimated_age_group) {
    ageSafety = 0.7; // uncertainty penalty
  }

  // Sentiment component (weight 0.2)
  const sentiment = audienceIntel.sentiment_score ?? 0.5;

  return clamp(authenticity * 0.5 + ageSafety * 0.3 + sentiment * 0.2);
}

/**
 * Parse the lower bound from an age group string like "18-24", "13-17", "Under 18", "35+"
 */
export function parseAgeLowerBound(ageGroup: string): number | null {
  if (!ageGroup) return null;
  const lower = ageGroup.toLowerCase().trim();

  // "under N"
  const underMatch = lower.match(/under\s+(\d+)/);
  if (underMatch) return parseInt(underMatch[1], 10) - 1;

  // "N-M" range
  const rangeMatch = lower.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);

  // "N+" or just "N"
  const numMatch = lower.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return null;
}

/**
 * Tone Alignment (weight 0.20)
 * Measures how well creator's tone matches brand voice preference.
 */
export function computeToneAlignment(
  captionIntel: CaptionIntelForSafety | null,
  brandVoicePref: ContentTone | null
): number {
  if (!brandVoicePref) return 0.7;
  if (!captionIntel) return 0.5;

  const primary = captionIntel.primary_tone;
  const secondary = captionIntel.secondary_tone;
  const pref = brandVoicePref.toLowerCase().trim();

  let baseScore = 0.3; // default: no match

  if (primary?.toLowerCase().trim() === pref) {
    baseScore = 1.0;
  } else if (secondary?.toLowerCase().trim() === pref) {
    baseScore = 0.8;
  } else {
    // Check adjacency
    const adjacent = TONE_ADJACENCY[pref] ?? [];
    if (
      (primary && adjacent.includes(primary.toLowerCase().trim())) ||
      (secondary && adjacent.includes(secondary.toLowerCase().trim()))
    ) {
      baseScore = 0.6;
    }
  }

  // Formality mismatch penalty
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

  return clamp(baseScore);
}

/**
 * Professionalism Score (weight 0.15)
 * Combines professionalism, content quality, reply rate, and oversharing risk.
 */
export function computeProfessionalismScore(
  creatorScores: CreatorScoresForSafety | null,
  captionIntel: CaptionIntelForSafety | null
): number {
  if (!creatorScores && !captionIntel) return 0.5;

  // Quality composite (weight 0.6)
  const prof = creatorScores?.professionalism;
  const quality = creatorScores?.content_quality;
  let qualityComposite: number;
  if (prof != null && quality != null) {
    qualityComposite = (prof / 100 + quality / 100) / 2;
  } else if (prof != null) {
    qualityComposite = prof / 100;
  } else if (quality != null) {
    qualityComposite = quality / 100;
  } else {
    qualityComposite = 0.5;
  }

  // Community engagement (weight 0.2)
  const replyRate = creatorScores?.creator_reply_rate ?? 0.5;

  // Oversharing penalty (weight 0.2)
  const vuln = captionIntel?.vulnerability_openness ?? 0;
  const oversharingScore = 1.0 - Math.max(0, (vuln - 50) / 50);

  return clamp(qualityComposite * 0.6 + replyRate * 0.2 + oversharingScore * 0.2);
}

/**
 * Collaboration History (weight 0.10)
 * Evaluates sponsorship experience, quality consistency, and category alignment.
 */
export function computeCollaborationHistory(
  creatorScores: CreatorScoresForSafety | null,
  captionIntel: CaptionIntelForSafety | null,
  brandProductCategories: string[]
): number {
  if (!creatorScores && !captionIntel) return 0.5;

  // Sponsored experience (weight 0.3)
  let sponsoredExp = 0.5;
  if (creatorScores?.sponsored_post_rate != null) {
    const rate = creatorScores.sponsored_post_rate;
    if (rate >= 0.05 && rate <= 0.3) sponsoredExp = 1.0;
    else if (rate < 0.05) sponsoredExp = 0.6;
    else if (rate <= 0.5) sponsoredExp = 0.7;
    else sponsoredExp = 0.4;
  }

  // Quality consistency (weight 0.3)
  let qualityConsistency = 0.5;
  if (creatorScores?.sponsored_vs_organic_delta != null) {
    qualityConsistency = clamp(
      1.0 - Math.min(1.0, Math.abs(creatorScores.sponsored_vs_organic_delta) / 30)
    );
  }

  // Category alignment (weight 0.4)
  let categoryAlignment = 0.5;
  if (captionIntel?.brand_categories?.length && brandProductCategories.length) {
    const creatorCats = captionIntel.brand_categories.map((c) =>
      c.toLowerCase().trim()
    );
    const brandCats = brandProductCategories.map((c) => c.toLowerCase().trim());

    const directOverlap = creatorCats.some((c) => brandCats.includes(c));
    if (directOverlap) {
      categoryAlignment = 1.0;
    } else {
      // Check adjacency
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
  } else if (!captionIntel?.brand_categories?.length) {
    categoryAlignment = 0.5;
  }

  return clamp(
    sponsoredExp * 0.3 + qualityConsistency * 0.3 + categoryAlignment * 0.4
  );
}

// ── Orchestrator ─────────────────────────────────────────────────────

/**
 * Compute the composite brand safety score (0–1).
 * Replaces the old authenticityModifier in the matching engine.
 */
export function computeBrandSafety(
  captionIntel: CaptionIntelForSafety | null,
  audienceIntel: AudienceIntelForSafety | null,
  creatorScores: CreatorScoresForSafety | null,
  config: BrandSafetyConfig
): number {
  const content = computeContentAppropriateness(
    captionIntel,
    audienceIntel,
    config.forbidden_topics
  );
  const audience = computeAudienceSafety(audienceIntel, config.min_audience_age);
  const tone = computeToneAlignment(captionIntel, config.brand_voice_preference);
  const prof = computeProfessionalismScore(creatorScores, captionIntel);
  const collab = computeCollaborationHistory(
    creatorScores,
    captionIntel,
    config.product_categories
  );

  return clamp(
    content * BRAND_SAFETY_WEIGHTS.content_appropriateness +
      audience * BRAND_SAFETY_WEIGHTS.audience_safety +
      tone * BRAND_SAFETY_WEIGHTS.tone_alignment +
      prof * BRAND_SAFETY_WEIGHTS.professionalism +
      collab * BRAND_SAFETY_WEIGHTS.collaboration_history
  );
}
