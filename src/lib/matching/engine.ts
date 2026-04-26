/* ------------------------------------------------------------------ */
/*  Matching Engine — Brand-Creator scoring algorithm                   */
/*  Computes a composite match score between brands and creators        */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Brand,
  BrandShopifyGeo,
  CreatorTier,
  ContentFormat,
} from "@/lib/types/database";
import {
  buildCreatorZoneProfile,
  buildBrandZoneNeeds,
  resolveState,
  resolveGeoRegionsToStates,
  resolveZone,
  type IndiaZone,
  ZONE_LABELS,
} from "@/lib/geo/india";
import {
  computeBrandSafety,
  DEFAULT_BRAND_SAFETY_CALIBRATION,
  type BrandSafetyCalibration,
  type CaptionIntelForSafety,
  type AudienceIntelForSafety,
  type CreatorScoresForSafety,
  type BrandSafetyConfig,
  type BrandSafetyResult,
} from "./brand-safety";
import { loadAllCalibrations } from "./calibration";

// ── Constants ─────────────────────────────────────────────────────────

const ALGORITHM_VERSION = "3.2.0";

/** Floor for brand-safety multiplier so a missing safety reading
 *  can't zero out the composite; also used when score is null. */
const BRAND_SAFETY_MOD_FLOOR = 0.3;

/** Below this confidence on a data-quality envelope we taper the
 *  sub-score weight linearly toward zero. */
const DATA_QUALITY_TAPER_THRESHOLD = 0.5;

export const NICHE_ADJACENCY: Record<string, string[]> = {
  beauty: ["skincare", "fashion", "lifestyle"],
  fitness: ["wellness", "health", "food"],
  food: ["health", "lifestyle", "fitness"],
  tech: ["gadgets", "lifestyle"],
  fashion: ["beauty", "lifestyle"],
  wellness: ["fitness", "health", "beauty"],
  skincare: ["beauty", "wellness"],
  lifestyle: ["fashion", "beauty", "food"],
};

export const TIER_RATES: Record<CreatorTier, [number, number]> = {
  nano: [1000, 5000],
  micro: [5000, 20000],
  mid: [20000, 100000],
  macro: [100000, 500000],
  mega: [500000, 2000000],
};

/**
 * Weights for composite score (used when brand has NO IG analysis).
 * Note: price/budget tier was removed (no pricing data in product). The
 * old 0.15 budget weight was redistributed proportionally to the four
 * remaining factors so weights still sum to 1.0. `price_tier_score` is
 * still computed and persisted for forward-compat but no longer
 * influences `match_score` or `match_reasoning`.
 */
const WEIGHTS = {
  niche_fit: 0.35,
  audience_geo: 0.29,
  budget_fit: 0,
  content_format: 0.18,
  engagement_quality: 0.18,
} as const;

/**
 * Weights used when the brand has a completed platform analysis.
 * Phase 2: renamed from WEIGHTS_WITH_IG. Same weights apply to whichever
 * platform the brand has analyzed (IG or YT). Retune per-platform after
 * we have pilot YT CPI data. Budget weight removed (see WEIGHTS note);
 * the old 0.10 was redistributed proportionally.
 */
const WEIGHTS_WITH_PLATFORM_SIGNALS = {
  niche_fit: 0.17,
  semantic_similarity: 0.22,
  past_collab_similarity: 0.17,
  audience_geo: 0.22,
  budget_fit: 0,
  content_format: 0.11,
  engagement_quality: 0.11,
} as const;

// Back-compat alias for tests and any external callers that imported the
// old name. Will be removed with the shadow-column drop migration.
const WEIGHTS_WITH_IG = WEIGHTS_WITH_PLATFORM_SIGNALS;

type SocialPlatform = "instagram" | "youtube";

// ── Types for internal use ────────────────────────────────────────────

type LeaderboardRow =
  Database["public"]["Views"]["mv_creator_leaderboard"]["Row"];

interface CreatorMatchData {
  leaderboard: LeaderboardRow;
  captionIntel: {
    primary_niche: string | null;
    secondary_niche: string | null;
  } | null;
  audienceIntel: {
    geo_regions: unknown;
    authenticity_score: number | null;
  } | null;
  scores: {
    engagement_quality: number | null;
    content_mix: Record<string, number> | null;
    brand_mentions: string[] | null;
  } | null;
}

// ── Exported sub-score functions (individually testable) ──────────────

/**
 * Computes niche fit between a creator and brand categories.
 * 1.0 = primary niche exact match
 * 0.8 = secondary niche exact match
 * 0.5 = niche is adjacent to a brand category
 * 0.0 = no match
 */
export function computeNicheFit(
  primaryNiche: string | null,
  secondaryNiche: string | null,
  brandCategories: string[]
): number {
  if (!brandCategories.length) return 0.0;

  const categories = brandCategories.map((c) => c.toLowerCase().trim());

  // Check primary niche
  if (primaryNiche) {
    const primary = primaryNiche.toLowerCase().trim();
    if (categories.includes(primary)) return 1.0;
  }

  // Check secondary niche
  if (secondaryNiche) {
    const secondary = secondaryNiche.toLowerCase().trim();
    if (categories.includes(secondary)) return 0.8;
  }

  // Check adjacency for primary niche
  if (primaryNiche) {
    const primary = primaryNiche.toLowerCase().trim();
    const adjacentNiches = NICHE_ADJACENCY[primary] ?? [];
    for (const adj of adjacentNiches) {
      if (categories.includes(adj)) return 0.5;
    }
  }

  // Check adjacency for secondary niche
  if (secondaryNiche) {
    const secondary = secondaryNiche.toLowerCase().trim();
    const adjacentNiches = NICHE_ADJACENCY[secondary] ?? [];
    for (const adj of adjacentNiches) {
      if (categories.includes(adj)) return 0.5;
    }
  }

  return 0.0;
}

/**
 * Normalizes geo_regions from either format into Record<string, number>
 * where values are 0.0-1.0 (confidence/percentage).
 *
 * Pipeline writes array: [{region: "Maharashtra", confidence: 0.45}]
 * Some code may pass object: {"maharashtra": 0.45}
 */
export function normalizeGeoRegions(
  raw: unknown
): Record<string, number> {
  if (!raw) return {};

  // Already a Record<string, number> (object format)
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof val === "number") {
        result[key.toLowerCase().trim()] = val > 1 ? val / 100 : val;
      }
    }
    return result;
  }

  // Array format from pipeline: [{region, confidence, signals?}]
  if (Array.isArray(raw)) {
    const result: Record<string, number> = {};
    for (const item of raw) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const region = (obj.region ?? obj.country ?? "") as string;
        const confidence = Number(obj.confidence ?? obj.percentage ?? obj.pct ?? 0);
        if (region) {
          result[region.toLowerCase().trim()] = confidence > 1 ? confidence / 100 : confidence;
        }
      }
    }
    return result;
  }

  return {};
}

/**
 * Computes audience geography score for creator-brand matching.
 *
 * Scoring strategy:
 * - Gap zones (awareness_gap, conversion_gap) get FULL weight — these are
 *   regions where the brand needs help, so matching audience is most valuable.
 * - Strong markets get PARTIAL weight (0.4x) — creator audiences in proven
 *   markets still convert, but the brand already has presence there.
 * - Returns 0.3 (neutral) if no geo data available from either side.
 */
export function computeAudienceGeo(
  creatorGeoRegions: unknown,
  brandGeoData: BrandShopifyGeo[]
): number {
  // Normalize array or object format to Record<string, number> with 0-1 values
  const creatorRegions = normalizeGeoRegions(creatorGeoRegions);
  if (!Object.keys(creatorRegions).length) return 0.3;
  if (!brandGeoData.length) return 0.3;

  // Separate zones by type
  const gapZones = brandGeoData.filter(
    (g) =>
      g.problem_type === "awareness_gap" ||
      g.problem_type === "conversion_gap"
  );
  const strongZones = brandGeoData.filter(
    (g) => g.problem_type === "strong_market"
  );

  // If ALL regions are strong_market (no gaps), score purely on strong market overlap
  const hasGaps = gapZones.length > 0;
  const hasStrong = strongZones.length > 0;

  if (!hasGaps && !hasStrong) return 0.3;

  let gapScore = 0;
  let strongScore = 0;

  // --- Score gap zones (full weight) ---
  if (hasGaps) {
    let gapOverlap = 0;
    let gapMatched = 0;

    for (const zone of gapZones) {
      const zoneKeys: string[] = [];
      if (zone.city) zoneKeys.push(zone.city.toLowerCase().trim());
      if (zone.state) zoneKeys.push(zone.state.toLowerCase().trim());
      if (zone.country) zoneKeys.push(zone.country.toLowerCase().trim());

      for (const key of zoneKeys) {
        if (creatorRegions[key] !== undefined) {
          // Confidence is already 0-1; weight by normalized gap_score
          const normalizedGap = Math.min(1.0, (zone.gap_score ?? 50) / 100);
          gapOverlap += creatorRegions[key] * normalizedGap;
          gapMatched++;
          break;
        }
      }
    }

    // Coverage ratio: what fraction of gap zones does the creator reach?
    const coverageRatio = gapMatched / gapZones.length;
    // Intensity: average overlap strength across gap zones
    const intensity = gapMatched > 0 ? gapOverlap / gapMatched : 0;
    // Combine: 60% coverage + 40% intensity
    gapScore = coverageRatio * 0.6 + intensity * 0.4;
  }

  // --- Score strong market zones (partial weight) ---
  if (hasStrong) {
    let strongMatched = 0;
    let strongOverlap = 0;

    for (const zone of strongZones) {
      const zoneKeys: string[] = [];
      if (zone.city) zoneKeys.push(zone.city.toLowerCase().trim());
      if (zone.state) zoneKeys.push(zone.state.toLowerCase().trim());
      if (zone.country) zoneKeys.push(zone.country.toLowerCase().trim());

      for (const key of zoneKeys) {
        if (creatorRegions[key] !== undefined) {
          strongOverlap += creatorRegions[key];
          strongMatched++;
          break;
        }
      }
    }

    const coverageRatio = strongMatched / strongZones.length;
    const intensity = strongMatched > 0 ? strongOverlap / strongMatched : 0;
    strongScore = coverageRatio * 0.5 + intensity * 0.5;
  }

  // --- Combine gap and strong scores ---
  let finalScore: number;
  if (hasGaps && hasStrong) {
    // Gap zones are more valuable (70/30 split)
    finalScore = gapScore * 0.7 + strongScore * 0.3;
  } else if (hasGaps) {
    finalScore = gapScore;
  } else {
    // All strong markets — still useful but lower ceiling
    finalScore = strongScore * 0.8;
  }

  // Map to 0.1-1.0 range (never fully zero if there's some data)
  return Math.min(1.0, 0.1 + finalScore * 0.9);
}

/**
 * Computes budget fit based on overlap between brand budget range
 * and creator's estimated tier rate range.
 * Returns 0-1 where 1 is perfect overlap.
 */
export function computeBudgetFit(
  brandBudgetMin: number | null,
  brandBudgetMax: number | null,
  creatorTier: CreatorTier | null
): number {
  if (!creatorTier) return 0.5; // Unknown tier, neutral score
  if (brandBudgetMin == null && brandBudgetMax == null) return 0.5;

  const [tierMin, tierMax] = TIER_RATES[creatorTier];
  const budgetMin = brandBudgetMin ?? 0;
  const budgetMax = brandBudgetMax ?? Infinity;

  // Calculate overlap between [budgetMin, budgetMax] and [tierMin, tierMax]
  const overlapStart = Math.max(budgetMin, tierMin);
  const overlapEnd = Math.min(budgetMax, tierMax);

  if (overlapStart >= overlapEnd) {
    // No overlap
    return 0.0;
  }

  const overlapLength = overlapEnd - overlapStart;
  const tierRange = tierMax - tierMin;
  const budgetRange = budgetMax === Infinity ? tierRange : budgetMax - budgetMin;
  const maxRange = Math.max(tierRange, budgetRange);

  if (maxRange === 0) return 1.0;

  return Math.min(1.0, overlapLength / maxRange);
}

/**
 * Computes content format fit between brand preference and creator's content mix.
 * Returns 0-1 where 1 is perfect match.
 * "any" format preference returns 0.8 (broadly compatible).
 */
export function computeFormatFit(
  brandFormatPref: ContentFormat | null,
  creatorContentMix: Record<string, number> | null
): number {
  if (!brandFormatPref) return 0.5; // No preference, neutral

  if (brandFormatPref === "any") return 0.8;

  if (!creatorContentMix || !Object.keys(creatorContentMix).length) return 0.3;

  // Normalize keys to lowercase
  const mix: Record<string, number> = {};
  for (const [key, value] of Object.entries(creatorContentMix)) {
    mix[key.toLowerCase().trim()] = value as number;
  }

  // Map brand format preferences to content type keys
  const formatMapping: Record<string, string[]> = {
    reels: ["video", "reels", "reel"],
    static: ["image", "static", "photo"],
    carousel: ["carousel", "sidecar"],
  };

  const matchingKeys = formatMapping[brandFormatPref] ?? [brandFormatPref];
  let totalProportion = 0;

  for (const key of matchingKeys) {
    if (mix[key] !== undefined) {
      totalProportion += mix[key];
    }
  }

  // totalProportion is typically a percentage (0-100) or fraction (0-1)
  // Normalize to 0-1 if it looks like a percentage
  if (totalProportion > 1) {
    totalProportion = totalProportion / 100;
  }

  return Math.min(1.0, totalProportion);
}

/**
 * Normalizes engagement quality score from 0-100 range to 0-1.
 */
export function computeEngagementQuality(
  engagementQuality: number | null
): number {
  if (engagementQuality == null) return 0.3; // Neutral if no data
  return Math.min(1.0, Math.max(0.0, engagementQuality / 100));
}

/**
 * Computes authenticity modifier.
 * - Returns 0.5 if auth_score < 0.6
 * - Returns 0.75 if auth_score < 0.7
 * - Returns 1.0 otherwise
 */
export function computeAuthenticityModifier(
  authenticityScore: number | null
): number {
  if (authenticityScore == null) return 1.0; // No data, no penalty
  if (authenticityScore < 0.6) return 0.5;
  if (authenticityScore < 0.7) return 0.75;
  return 1.0;
}

/**
 * Computes competitor bonus.
 * Returns 1.15 if creator mentions a competitor brand, 1.0 otherwise.
 */
export function computeCompetitorBonus(
  creatorBrandMentions: string[] | null,
  competitorBrands: string[] | null
): number {
  if (!creatorBrandMentions?.length || !competitorBrands?.length) return 1.0;

  const mentionsLower = creatorBrandMentions.map((m) =>
    m.toLowerCase().trim()
  );
  const competitorsLower = competitorBrands.map((c) =>
    c.toLowerCase().trim()
  );

  for (const mention of mentionsLower) {
    if (competitorsLower.includes(mention)) return 1.15;
  }

  return 1.0;
}

// ── IG-signal sub-scores (active when brand has content_embedding) ────

/** Cosine similarity between two equal-length vectors. Returns 0 if either is missing. */
export function cosineSimilarity(
  a: number[] | null | undefined,
  b: number[] | null | undefined
): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  // cosine ∈ [-1, 1]; shift to [0, 1] so it combines cleanly with other sub-scores.
  const raw = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

/**
 * Semantic similarity between the brand's content fingerprint and the
 * creator's. Catches theme-level matches that the 10-label niche_fit misses
 * (e.g. "K-beauty routines" vs "Korean skincare ingredients").
 */
export function computeSemanticSimilarity(
  brandEmbedding: number[] | null,
  creatorEmbedding: number[] | null
): number {
  return cosineSimilarity(brandEmbedding, creatorEmbedding);
}

/**
 * Max cosine similarity between the creator and any of the brand's past
 * collaborators (with known embeddings). Encodes "find more creators like
 * the ones this brand has already worked with successfully."
 */
export function computePastCollabSimilarity(
  creatorEmbedding: number[] | null,
  pastCollaboratorEmbeddings: (number[] | null)[]
): number {
  if (!creatorEmbedding || !pastCollaboratorEmbeddings.length) return 0;
  let best = 0;
  for (const emb of pastCollaboratorEmbeddings) {
    if (!emb) continue;
    const sim = cosineSimilarity(creatorEmbedding, emb);
    if (sim > best) best = sim;
  }
  return best;
}

/**
 * Jaccard overlap between the brand's recurring_topics and the creator's.
 * Returned as a multiplicative bonus in [1.0, 1.10]. Topics are fine-grained
 * strings ("morning routines", "protein recipes") — orthogonal to niche_fit.
 */
export function computeThemeOverlapBonus(
  brandTopics: string[] | null | undefined,
  creatorTopics: string[] | null | undefined
): number {
  if (!brandTopics?.length || !creatorTopics?.length) return 1.0;
  const bset = new Set(brandTopics.map((t) => t.toLowerCase().trim()));
  const cset = new Set(creatorTopics.map((t) => t.toLowerCase().trim()));
  let intersection = 0;
  for (const t of cset) if (bset.has(t)) intersection++;
  const union = new Set([...bset, ...cset]).size;
  if (union === 0) return 1.0;
  const jaccard = intersection / union;
  return 1.0 + jaccard * 0.1; // up to +10%
}

/**
 * Collaboration-network proximity. If the creator's handle appears in the
 * brand's ig_collaborators list (past collaborators directly tagged from
 * the brand's own IG + manual entries), give a flat 1.15× bonus.
 */
export function computeCollabNetworkBonus(
  creatorHandle: string | null | undefined,
  brandCollaborators: string[] | null | undefined
): number {
  if (!creatorHandle || !brandCollaborators?.length) return 1.0;
  const ch = creatorHandle.toLowerCase().trim().replace(/^@/, "");
  for (const h of brandCollaborators) {
    if (h.toLowerCase().trim().replace(/^@/, "") === ch) return 1.15;
  }
  return 1.0;
}

// ── Match reasoning generator ─────────────────────────────────────────

/**
 * Tapers a sub-score's weight toward zero as data-quality confidence drops
 * below DATA_QUALITY_TAPER_THRESHOLD. Returns the effective (possibly
 * reduced) weight; the caller is responsible for renormalizing.
 */
function taperedWeight(
  baseWeight: number,
  dataQualityConfidence: number | null | undefined
): number {
  if (dataQualityConfidence == null) return baseWeight;
  if (dataQualityConfidence >= DATA_QUALITY_TAPER_THRESHOLD) return baseWeight;
  return baseWeight * (dataQualityConfidence / DATA_QUALITY_TAPER_THRESHOLD);
}

/**
 * Applies linear data-quality tapering to sub-score weights based on the
 * intelligence envelopes feeding each sub-score, and renormalizes so the
 * remaining weights still sum to 1.0 exactly.
 *
 * Contribution map (which envelope(s) feed which sub-score):
 *   niche_fit            ← caption
 *   semantic_similarity  ← (brand.content_embedding; no creator envelope)
 *   past_collab_similarity ← (pool embedding; no creator envelope)
 *   audience_geo         ← audience
 *   budget_fit           ← (tier; no envelope)
 *   content_format       ← (scores; no envelope)
 *   engagement_quality   ← (scores; no envelope)
 */
function applyDataQualityAdjustments(
  weights: Record<string, number>,
  envelopes: {
    caption_confidence: number | null;
    audience_confidence: number | null;
  }
): { adjusted: Record<string, number>; effective_confidence: number } {
  const contribution: Record<string, number | null> = {
    niche_fit: envelopes.caption_confidence,
    semantic_similarity: envelopes.caption_confidence,
    past_collab_similarity: envelopes.caption_confidence,
    audience_geo: envelopes.audience_confidence,
    budget_fit: null,
    content_format: null,
    engagement_quality: null,
  };

  const tapered: Record<string, number> = {};
  let totalTapered = 0;
  for (const key of Object.keys(weights)) {
    const base = weights[key];
    const conf = contribution[key] ?? null;
    const w = taperedWeight(base, conf);
    tapered[key] = w;
    totalTapered += w;
  }

  if (totalTapered <= 0) {
    return { adjusted: weights, effective_confidence: 0 };
  }

  const adjusted: Record<string, number> = {};
  for (const key of Object.keys(tapered)) {
    adjusted[key] = tapered[key] / totalTapered;
  }

  // Harmonic-mean of non-null envelope confidences, weighted by
  // how much of the original weight they back.
  const contribs: Array<{ conf: number; weight: number }> = [];
  for (const key of Object.keys(weights)) {
    const c = contribution[key];
    if (c != null) contribs.push({ conf: Math.max(c, 0.01), weight: weights[key] });
  }
  let effective_confidence = 1.0;
  if (contribs.length) {
    const wsum = contribs.reduce((s, x) => s + x.weight, 0);
    const denom = contribs.reduce((s, x) => s + x.weight / x.conf, 0);
    effective_confidence = wsum / denom;
  }
  return { adjusted, effective_confidence };
}

/** Binary-search percentile with tie handling (ties share the same rank). */
export function computePercentileInPool(score: number, sortedDescScores: number[]): number {
  if (!sortedDescScores.length) return 0;
  // Number of scores strictly greater than this one
  let lo = 0;
  let hi = sortedDescScores.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedDescScores[mid] > score) lo = mid + 1;
    else hi = mid;
  }
  const rank = lo; // count of scores strictly greater
  const pct = ((sortedDescScores.length - rank) / sortedDescScores.length) * 100;
  return Math.round(pct * 10) / 10;
}

function generateMatchReasoning(
  nicheFit: number,
  audienceGeo: number,
  formatFit: number,
  engagementQuality: number,
  brandSafety: number,
  competitorBonus: number,
  finalScore: number
): string {
  const reasons: string[] = [];

  if (nicheFit >= 0.8) reasons.push("Strong niche alignment");
  else if (nicheFit >= 0.5) reasons.push("Adjacent niche relevance");
  else if (nicheFit > 0) reasons.push("Weak niche overlap");
  else reasons.push("No niche overlap");

  if (audienceGeo >= 0.7)
    reasons.push("Strong audience in brand's target zones");
  else if (audienceGeo > 0.4)
    reasons.push("Good audience overlap with target regions");
  else if (audienceGeo > 0.3)
    reasons.push("Some audience in target regions");

  if (formatFit >= 0.7)
    reasons.push("Content format strongly matches brand preference");
  else if (formatFit >= 0.5) reasons.push("Moderate content format fit");

  if (engagementQuality >= 0.7) reasons.push("High engagement quality");
  else if (engagementQuality >= 0.4)
    reasons.push("Moderate engagement quality");

  if (brandSafety >= 0.8) reasons.push("High brand safety alignment");
  else if (brandSafety >= 0.5) reasons.push("Moderate brand safety");
  else if (brandSafety >= 0.3)
    reasons.push("Low brand safety — review recommended");
  else reasons.push("Brand safety concern — not recommended");

  if (competitorBonus > 1.0)
    reasons.push("Bonus: already mentions competitor brands");

  return `Score: ${(finalScore * 100).toFixed(1)}%. ${reasons.join(". ")}.`;
}

// ── Brand zone derivation ────────────────────────────────────────────

/**
 * Derives target IndiaZones from a brand's shipping_zones and target_regions.
 * shipping_zones contains city names like "Delhi", "Mumbai", "All India".
 */
function deriveBrandTargetZones(brand: Brand): IndiaZone[] {
  const zones = new Set<IndiaZone>();

  // Check shipping_zones (from onboarding step 1)
  const shippingZones = brand.shipping_zones ?? [];
  for (const sz of shippingZones) {
    if (sz.toLowerCase() === "all india") {
      // All India = all zones
      return ["north", "south", "east", "west"];
    }
    const zone = resolveZone(sz);
    if (zone) zones.add(zone);
  }

  return Array.from(zones);
}

// ── Main matching function ────────────────────────────────────────────

/**
 * Computes match scores for a brand against top creators and upserts
 * results into the creator_brand_matches table.
 */
export async function computeMatchesForBrand(
  supabase: SupabaseClient<Database>,
  brandId: string,
  limit: number = 200,
  opts?: { platforms?: SocialPlatform[] }
): Promise<number> {
  // ── 1. Fetch brand data ─────────────────────────────────────────────
  const { data: brandRow, error: brandError } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (brandError || !brandRow) {
    throw new Error(`Brand not found: ${brandId}`);
  }

  const brand = brandRow as Brand & {
    content_embedding?: number[] | null;
    ig_collaborators?: string[] | null;
    ig_content_dna?: { recurring_topics?: string[] | null } | null;
  };

  // ── 1a. Determine which platforms to score ──────────────────────────
  // Phase 2: fetch brand_platform_analyses for every completed platform.
  // Legacy shadow columns on `brands` are used as a last-resort fallback
  // so brands onboarded pre-migration-045 still produce IG match rows.
  const { data: allAnalyses } = await supabase
    .from("brand_platform_analyses")
    .select("platform, content_embedding, collaborators, content_dna, analysis_status")
    .eq("brand_id", brandId);

  type PlatformAnalysis = {
    platform: SocialPlatform;
    content_embedding: number[] | null;
    collaborators: string[] | null;
    content_dna: { recurring_topics?: string[] | null } | null;
    analysis_status: string | null;
  };

  const analysesByPlatform = new Map<SocialPlatform, PlatformAnalysis>();
  for (const row of (allAnalyses ?? []) as PlatformAnalysis[]) {
    if (row.analysis_status === "completed" || row.content_embedding) {
      analysesByPlatform.set(row.platform, row);
    }
  }

  // Shadow fallback — if no IG row in brand_platform_analyses but the
  // legacy columns are populated, synthesize an IG analysis.
  if (
    !analysesByPlatform.has("instagram") &&
    (brand.content_embedding || brand.ig_collaborators?.length || brand.ig_content_dna)
  ) {
    analysesByPlatform.set("instagram", {
      platform: "instagram",
      content_embedding: brand.content_embedding ?? null,
      collaborators: brand.ig_collaborators ?? [],
      content_dna: brand.ig_content_dna ?? null,
      analysis_status: "completed",
    });
  }

  // Narrow to the caller-specified set (if any); otherwise iterate all
  // analyzed platforms. If the brand has NO analysis at all, fall back
  // to a single IG pass so every existing caller keeps working.
  const wantedPlatforms: SocialPlatform[] = opts?.platforms
    ? opts.platforms.filter((p): p is SocialPlatform =>
        p === "instagram" || p === "youtube"
      )
    : Array.from(analysesByPlatform.keys());
  const platformsToScore: SocialPlatform[] =
    wantedPlatforms.length > 0 ? wantedPlatforms : ["instagram"];

  // ── 2. Fetch brand_shopify_geo data (brand-level, shared) ──────────
  const { data: geoRows } = await supabase
    .from("brand_shopify_geo")
    .select("*")
    .eq("brand_id", brandId);

  const brandGeoData = (geoRows ?? []) as BrandShopifyGeo[];

  // ── 3. Fetch top creators from leaderboard ──────────────────────────
  // Phase 2: filter by platform so a creator on both IG and YT appears
  // twice (once per platform) with platform-specific intelligence loaded
  // each time. Multi-platform creators get two match rows, one per
  // platform, with independent scores.
  const { data: leaderboardRows, error: lbError } = await supabase
    .from("mv_creator_leaderboard")
    .select("*")
    .in("platform", platformsToScore as unknown as string[])
    .order("cpi", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (lbError || !leaderboardRows?.length) {
    return 0; // No creators to match against
  }

  const creators = leaderboardRows as LeaderboardRow[];
  const creatorIds = creators
    .map((c) => c.creator_id)
    .filter((id): id is string => id !== null);

  // ── 4. Batch-fetch related data for all creators ────────────────────
  // Fetch brand guidelines for brand safety scoring
  const { data: guidelinesRow } = await supabase
    .from("brand_guidelines")
    .select("*")
    .eq("brand_id", brandId)
    .single();
  const guidelines = guidelinesRow as { forbidden_topics?: string[] } | null;

  const brandSafetyConfig: BrandSafetyConfig = {
    brand_voice_preference: (brand as Record<string, unknown>).brand_voice_preference as BrandSafetyConfig["brand_voice_preference"] ?? null,
    min_audience_age: (brand as Record<string, unknown>).min_audience_age as number | null ?? null,
    product_categories: brand.product_categories ?? [],
    forbidden_topics: guidelines?.forbidden_topics ?? [],
  };

  // Pull the current percentile snapshot once per batch so sub-score
  // cutoffs match the live cohort rather than 2023-vintage folklore.
  // Falls back to DEFAULT_BRAND_SAFETY_CALIBRATION when the table is
  // empty; `brand-safety.ts` only actually uses these when
  // BRAND_MATCH_CALIBRATED=true.
  const calibrationSnapshot: BrandSafetyCalibration = await loadAllCalibrations(
    supabase,
  ).catch(() => DEFAULT_BRAND_SAFETY_CALIBRATION);

  // Intelligence fetches are scoped by (creator_id, platform) after
  // migration 047. A creator on both IG and YT has distinct rows on each
  // of these tables. We pull both platforms in one call and key the maps
  // by `${creator_id}:${platform}` below.
  const [captionResult, audienceResult, scoresResult, transcriptResult] = await Promise.all([
    supabase
      .from("caption_intelligence")
      .select("creator_id, platform, primary_niche, secondary_niche, primary_tone, secondary_tone, formality_score, engagement_bait_score, vulnerability_openness, recurring_topics, brand_categories, data_quality")
      .in("creator_id", creatorIds)
      .in("platform", platformsToScore as unknown as string[]),
    supabase
      .from("audience_intelligence")
      .select("creator_id, platform, geo_regions, authenticity_score, suspicious_patterns, sentiment_score, negative_themes, estimated_age_group, data_quality")
      .in("creator_id", creatorIds)
      .in("platform", platformsToScore as unknown as string[]),
    supabase
      .from("creator_scores")
      .select("creator_id, platform, engagement_quality, content_mix, brand_mentions, professionalism, content_quality, sponsored_post_rate, sponsored_vs_organic_delta, creator_reply_rate")
      .in("creator_id", creatorIds)
      .in("platform", platformsToScore as unknown as string[]),
    supabase
      .from("transcript_intelligence")
      .select("creator_id, platform, primary_spoken_language")
      .in("creator_id", creatorIds)
      .in("platform", platformsToScore as unknown as string[]),
  ]);

  // Intelligence rows created before migration 047 don't have a
  // `platform` column selected — default to 'instagram' so pre-migration
  // test fixtures and any legacy rows still key correctly.
  const key = (creatorId: string, platform: string | null | undefined) =>
    `${creatorId}:${platform ?? "instagram"}`;

  // Index by creator_id for fast lookup
  type CaptionRow = {
    primary_niche: string | null;
    secondary_niche: string | null;
    primary_tone: string | null;
    secondary_tone: string | null;
    formality_score: number | null;
    engagement_bait_score: number | null;
    vulnerability_openness: number | null;
    recurring_topics: string[] | null;
    brand_categories: string[] | null;
    data_quality: { confidence?: number | null; coverage_percentage?: number | null } | null;
  };
  // Key by "${creator_id}:${platform}" so a multi-platform creator has
  // distinct IG and YT intelligence rows, not one overwriting the other.
  const captionMap = new Map<string, CaptionRow>();
  for (const row of (captionResult.data ?? []) as Array<
    { creator_id: string; platform: string } & CaptionRow
  >) {
    captionMap.set(key(row.creator_id, row.platform), row);
  }

  type AudienceRow = {
    geo_regions: unknown;
    authenticity_score: number | null;
    suspicious_patterns: string[] | null;
    sentiment_score: number | null;
    negative_themes: string[] | null;
    estimated_age_group: string | null;
    data_quality: { confidence?: number | null; coverage_percentage?: number | null } | null;
  };
  const audienceMap = new Map<string, AudienceRow>();
  for (const row of (audienceResult.data ?? []) as Array<
    { creator_id: string; platform: string } & AudienceRow
  >) {
    audienceMap.set(key(row.creator_id, row.platform), row);
  }

  type ScoresRow = {
    engagement_quality: number | null;
    content_mix: Record<string, number> | null;
    brand_mentions: string[] | null;
    professionalism: number | null;
    content_quality: number | null;
    sponsored_post_rate: number | null;
    sponsored_vs_organic_delta: number | null;
    creator_reply_rate: number | null;
  };
  const scoresMap = new Map<string, ScoresRow>();
  for (const row of (scoresResult.data ?? []) as Array<
    { creator_id: string; platform: string } & ScoresRow
  >) {
    scoresMap.set(key(row.creator_id, row.platform), row);
  }

  const transcriptMap = new Map<string, { primary_spoken_language: string | null }>();
  for (const row of (transcriptResult.data ?? []) as Array<{
    creator_id: string;
    platform: string;
    primary_spoken_language: string | null;
  }>) {
    transcriptMap.set(key(row.creator_id, row.platform), row);
  }

  // ── 4c. Per-platform creator embeddings (migration 046) ────────────
  // Load the per-platform creator_content_embeddings table keyed by
  // (creator_id, platform). The scoring loop below pulls the embedding
  // matching the row's platform. Brand-side past-collaborator pool is
  // loaded per platform inside the scoring loop since the resolve RPC
  // keys off brand (IG shadow path for now — extend in a follow-up).
  const creatorEmbeddingMap = new Map<string, number[] | null>();
  const anyBrandHasAnalysis = Array.from(analysesByPlatform.values()).some(
    (a) => Array.isArray(a.content_embedding) && a.content_embedding.length > 0,
  );
  if (anyBrandHasAnalysis) {
    const { data: embRows } = await supabase
      .from("creator_content_embeddings")
      .select("creator_id, platform, embedding")
      .in("creator_id", creatorIds)
      .in("platform", platformsToScore as unknown as string[]);
    for (const row of (embRows ?? []) as Array<{
      creator_id: string;
      platform: string;
      embedding: number[] | null;
    }>) {
      creatorEmbeddingMap.set(key(row.creator_id, row.platform), row.embedding);
    }
  }

  // Past-collab pool: keyed off brand. For now we resolve once using the
  // IG-side RPC (which reads `brands.ig_collaborators` — the shadow path).
  // In a follow-up we'll add per-platform resolution so YT briefs match
  // against YT past collaborators. For now YT briefs re-use the IG pool.
  let pastCollaboratorEmbeddings: (number[] | null)[] = [];
  const igAnalysis = analysesByPlatform.get("instagram");
  if (igAnalysis && (igAnalysis.collaborators?.length ?? 0) > 0) {
    const { data: pastRows } = await supabase.rpc(
      "fn_resolve_brand_past_collaborators",
      { p_brand_id: brandId } as never,
    );
    const pastList =
      (pastRows as Array<{ content_embedding: number[] | null }> | null) ?? [];
    pastCollaboratorEmbeddings = pastList
      .map((r) => r.content_embedding)
      .filter((v): v is number[] => Array.isArray(v) && v.length > 0);
  }

  // ── 4b. Build brand zone needs (dashboard uses this) ───────────────
  const brandTargetZones = deriveBrandTargetZones(brand);
  const brandZoneNeeds = buildBrandZoneNeeds(
    brandGeoData,
    brandTargetZones.length > 0 ? brandTargetZones : undefined
  );

  // ── 4c. Fetch per-state gap classification from v_brand_geo_gaps ───
  // This view recomputes problem_type on read, so stale/partial sync
  // rows don't feed into the matcher. Matching engine reads this
  // directly instead of trusting brand_shopify_geo.problem_type.
  const { data: gapRowsRaw } = await supabase
    .from("v_brand_geo_gaps" as never)
    .select(
      "state, city, gap_score, problem_type_current, pop_weight, session_share, order_share"
    )
    .eq("brand_id", brandId);
  type GapRow = {
    state: string | null;
    city: string | null;
    gap_score: number | null;
    problem_type_current: string | null;
    pop_weight: number | null;
    session_share: number | null;
    order_share: number | null;
  };
  const brandGapRows = (gapRowsRaw ?? []) as GapRow[];

  // State → { problemType, gapWeight }. gapWeight is what a creator
  // whose audience sits in this state is worth:
  //   awareness_gap / conversion_gap:  0.6 + gap_score × 0.4  (∈ [0.6, 1.0])
  //   strong_market:                   0.5                    (loyalty value)
  //   untracked:                       0
  const brandStateGaps = new Map<
    string,
    { problemType: string; gapWeight: number }
  >();
  for (const row of brandGapRows) {
    const state = resolveState(row.state ?? "") ?? resolveState(row.city ?? "");
    if (!state) continue;
    const pt = row.problem_type_current ?? "untracked";
    let gapWeight: number;
    if (pt === "awareness_gap" || pt === "conversion_gap") {
      const g = Math.max(0, Math.min(1, row.gap_score ?? 0));
      gapWeight = 0.6 + g * 0.4;
    } else if (pt === "strong_market") {
      gapWeight = 0.5;
    } else {
      gapWeight = 0;
    }
    // If multiple rows per state (e.g. with city), keep the max.
    const prev = brandStateGaps.get(state);
    if (!prev || gapWeight > prev.gapWeight) {
      brandStateGaps.set(state, { problemType: pt, gapWeight });
    }
  }
  const brandHasGapData = brandStateGaps.size > 0;

  // ── 5. Compute match scores for each creator ───────────────────────
  const brandCategories = brand.product_categories ?? [];
  const matchRows: Database["public"]["Tables"]["creator_brand_matches"]["Insert"][] =
    [];

  for (const creator of creators) {
    if (!creator.creator_id) continue;

    // Each leaderboard row is per-(creator, platform). Scope intelligence
    // + embedding + brand-side analysis to the row's platform.
    const creatorPlatform: SocialPlatform =
      ((creator as unknown as { platform?: SocialPlatform }).platform) ?? "instagram";
    const platformAnalysis = analysesByPlatform.get(creatorPlatform) ?? null;
    const hasAnalysisForPlatform =
      Array.isArray(platformAnalysis?.content_embedding) &&
      (platformAnalysis?.content_embedding?.length ?? 0) > 0;
    const brandEmbedding: number[] | null = hasAnalysisForPlatform
      ? (platformAnalysis!.content_embedding as number[])
      : null;
    const brandCollaborators = platformAnalysis?.collaborators ?? [];
    const brandTopics = platformAnalysis?.content_dna?.recurring_topics ?? [];
    const hasIgAnalysis = creatorPlatform === "instagram" && hasAnalysisForPlatform;

    const captionIntel = captionMap.get(key(creator.creator_id, creatorPlatform)) ?? null;
    const audienceIntel = audienceMap.get(key(creator.creator_id, creatorPlatform)) ?? null;
    const creatorScores = scoresMap.get(key(creator.creator_id, creatorPlatform)) ?? null;
    const transcriptIntel = transcriptMap.get(key(creator.creator_id, creatorPlatform)) ?? null;

    // Use caption intelligence for niche, fallback to leaderboard
    const primaryNiche =
      captionIntel?.primary_niche ?? creator.primary_niche ?? null;
    const secondaryNiche = captionIntel?.secondary_niche ?? null;

    // Build multi-signal zone profile for this creator (used for
    // dashboard-facing geo_match_regions and as a fallback when the
    // audience intel doesn't resolve to any state).
    const creatorZoneProfile = buildCreatorZoneProfile({
      geoRegions: audienceIntel?.geo_regions,
      spokenLanguage: transcriptIntel?.primary_spoken_language ?? null,
      creatorCity: creator.city,
      creatorCountry: creator.country,
    });

    // Build per-state audience share for this creator (sums to ≤1).
    // Priority: comment-inferred geo_regions → creator's own location.
    let creatorStateShares: Record<string, number> =
      resolveGeoRegionsToStates(audienceIntel?.geo_regions);
    if (Object.keys(creatorStateShares).length === 0) {
      const locState =
        resolveState(creator.city ?? "") ??
        resolveState(creator.country ?? "");
      if (locState) creatorStateShares = { [locState]: 1 };
    }

    // Sub-scores
    const nicheFit = computeNicheFit(
      primaryNiche,
      secondaryNiche,
      brandCategories
    );
    // State-level gap overlap (replaces zone-opportunity blending).
    //   - Σ creator_state_share × brand_state_gap_weight
    //   - Neutral 0.3 if brand has no geo data OR creator has no state signal.
    let audienceGeo: number;
    let dominantProblemType: string | null = null;
    if (!brandHasGapData || Object.keys(creatorStateShares).length === 0) {
      audienceGeo = 0.3;
    } else {
      let overlap = 0;
      const perTypeOverlap: Record<string, number> = {};
      for (const [state, share] of Object.entries(creatorStateShares)) {
        const gap = brandStateGaps.get(state);
        if (!gap) continue;
        const contrib = share * gap.gapWeight;
        overlap += contrib;
        perTypeOverlap[gap.problemType] =
          (perTypeOverlap[gap.problemType] ?? 0) + contrib;
      }
      audienceGeo = Math.min(1, 0.1 + overlap * 0.9);
      // Pick the problem_type carrying the most overlap as the hint.
      let bestType: string | null = null;
      let bestValue = 0;
      for (const [t, v] of Object.entries(perTypeOverlap)) {
        if (v > bestValue) {
          bestValue = v;
          bestType = t;
        }
      }
      dominantProblemType = bestType;
    }
    const budgetFit = computeBudgetFit(
      brand.budget_per_creator_min,
      brand.budget_per_creator_max,
      creator.tier
    );
    const formatFit = computeFormatFit(
      brand.content_format_pref,
      creatorScores?.content_mix ?? null
    );
    const engagementQuality = computeEngagementQuality(
      creatorScores?.engagement_quality ?? creator.engagement_quality
    );

    // Brand safety score (replaces authenticityMod)
    const captionSafety: CaptionIntelForSafety | null = captionIntel
      ? {
          primary_tone: captionIntel.primary_tone as CaptionIntelForSafety["primary_tone"],
          secondary_tone: captionIntel.secondary_tone as CaptionIntelForSafety["secondary_tone"],
          formality_score: captionIntel.formality_score,
          engagement_bait_score: captionIntel.engagement_bait_score,
          vulnerability_openness: captionIntel.vulnerability_openness,
          recurring_topics: captionIntel.recurring_topics,
          brand_categories: captionIntel.brand_categories,
        }
      : null;
    const audienceSafety: AudienceIntelForSafety | null = audienceIntel
      ? {
          authenticity_score: audienceIntel.authenticity_score,
          suspicious_patterns: audienceIntel.suspicious_patterns,
          estimated_age_group: audienceIntel.estimated_age_group,
          sentiment_score: audienceIntel.sentiment_score,
          negative_themes: audienceIntel.negative_themes,
        }
      : null;
    const scoresSafety: CreatorScoresForSafety | null = creatorScores
      ? {
          professionalism: creatorScores.professionalism,
          content_quality: creatorScores.content_quality,
          creator_reply_rate: creatorScores.creator_reply_rate,
          sponsored_post_rate: creatorScores.sponsored_post_rate,
          sponsored_vs_organic_delta: creatorScores.sponsored_vs_organic_delta,
        }
      : null;

    const brandSafety: BrandSafetyResult = computeBrandSafety(
      captionSafety,
      audienceSafety,
      scoresSafety,
      brandSafetyConfig,
      calibrationSnapshot,
    );
    const brandSafetyScoreForOutput = brandSafety.score ?? 0;
    const brandSafetyMod =
      brandSafety.score === null
        ? BRAND_SAFETY_MOD_FLOOR
        : Math.max(BRAND_SAFETY_MOD_FLOOR, brandSafety.score);
    const manualReviewRequired = brandSafety.manual_review_required;

    // Modifiers
    const competitorBonus = computeCompetitorBonus(
      creatorScores?.brand_mentions ?? null,
      brand.competitor_brands
    );

    // ── Platform-signal sub-scores (only meaningful when the brand
    // has a completed analysis for this creator's platform) ──
    const creatorEmbedding = hasAnalysisForPlatform
      ? creatorEmbeddingMap.get(key(creator.creator_id, creatorPlatform)) ?? null
      : null;
    const semanticSimilarity = hasAnalysisForPlatform
      ? computeSemanticSimilarity(brandEmbedding, creatorEmbedding)
      : 0;
    const pastCollabSimilarity = hasAnalysisForPlatform
      ? computePastCollabSimilarity(creatorEmbedding, pastCollaboratorEmbeddings)
      : 0;
    const themeOverlapBonus = hasAnalysisForPlatform
      ? computeThemeOverlapBonus(
          brandTopics,
          captionIntel?.recurring_topics ?? null
        )
      : 1.0;
    const collabNetworkBonus = hasAnalysisForPlatform
      ? computeCollabNetworkBonus(creator.handle, brandCollaborators)
      : 1.0;

    // ── Data-quality tapering ────────────────────────────────────
    const captionConfidence =
      typeof captionIntel?.data_quality?.confidence === "number"
        ? captionIntel!.data_quality!.confidence!
        : null;
    const audienceConfidence =
      typeof audienceIntel?.data_quality?.confidence === "number"
        ? audienceIntel!.data_quality!.confidence!
        : null;

    const baseWeights: Record<string, number> = hasAnalysisForPlatform
      ? { ...WEIGHTS_WITH_PLATFORM_SIGNALS }
      : { ...WEIGHTS };
    const subScoreValues: Record<string, number> = hasAnalysisForPlatform
      ? {
          niche_fit: nicheFit,
          semantic_similarity: semanticSimilarity,
          past_collab_similarity: pastCollabSimilarity,
          audience_geo: audienceGeo,
          budget_fit: budgetFit,
          content_format: formatFit,
          engagement_quality: engagementQuality,
        }
      : {
          niche_fit: nicheFit,
          audience_geo: audienceGeo,
          budget_fit: budgetFit,
          content_format: formatFit,
          engagement_quality: engagementQuality,
        };

    const { adjusted: adjustedWeights, effective_confidence: matchConfidence } =
      applyDataQualityAdjustments(baseWeights, {
        caption_confidence: captionConfidence,
        audience_confidence: audienceConfidence,
      });

    let rawScore = 0;
    for (const key of Object.keys(adjustedWeights)) {
      rawScore += (subScoreValues[key] ?? 0) * adjustedWeights[key];
    }

    const finalScore = Math.min(
      1.0,
      rawScore *
        brandSafetyMod *
        competitorBonus *
        themeOverlapBonus *
        collabNetworkBonus
    );

    // ── Missing-inputs & coverage tracking ──────────────────────
    const missingInputs: string[] = [...brandSafety.missing_inputs];
    if (captionIntel == null)
      missingInputs.push("caption_intelligence: not available");
    else if (captionConfidence == null)
      missingInputs.push("caption_intelligence.data_quality.confidence missing");
    if (audienceIntel == null)
      missingInputs.push("audience_intelligence: not available");
    else if (audienceConfidence == null)
      missingInputs.push("audience_intelligence.data_quality.confidence missing");
    if (!brandGeoData.length)
      missingInputs.push("brand_shopify_geo: no rows");

    // coverage_percentage = share of requested inputs that had real data.
    // Buckets: [caption present+confident, audience present+confident,
    //           brand geo rows present, creator scores present, captionIntel present].
    const coverageBuckets: boolean[] = [
      captionIntel != null && captionConfidence != null && captionConfidence >= 0.5,
      audienceIntel != null && audienceConfidence != null && audienceConfidence >= 0.5,
      brandGeoData.length > 0,
      creatorScores != null,
      captionIntel != null,
    ];
    const coveragePercentage = Math.round(
      (coverageBuckets.filter(Boolean).length / coverageBuckets.length) * 100
    );

    // Check if creator mentions the brand itself
    const brandNameLower = brand.brand_name.toLowerCase().trim();
    const alreadyMentionsBrand =
      creatorScores?.brand_mentions?.some(
        (m) => m.toLowerCase().trim() === brandNameLower
      ) ?? false;

    const mentionsCompetitor = competitorBonus > 1.0;

    // Determine which regions matched.
    // Primary: list states where the creator's audience sits that are
    // also gap/strong-market states for the brand. Fall back to the
    // zone-level view if we don't have state-granular data.
    const matchedGeoRegions: string[] = [];
    if (brandHasGapData && Object.keys(creatorStateShares).length > 0) {
      const matched = Object.entries(creatorStateShares)
        .filter(([state, share]) => {
          if (share < 0.05) return false;
          const gap = brandStateGaps.get(state);
          return !!(gap && gap.gapWeight > 0);
        })
        .sort((a, b) => b[1] - a[1])
        .map(([state]) => state);
      for (const s of matched.slice(0, 5)) matchedGeoRegions.push(s);
    } else {
      for (const zone of ["north", "south", "east", "west"] as IndiaZone[]) {
        if (
          creatorZoneProfile[zone] > 0.1 &&
          brandZoneNeeds[zone].opportunity > 0
        ) {
          matchedGeoRegions.push(ZONE_LABELS[zone]);
        }
      }
    }

    // recommended_for: if the creator overlaps a dominant gap type,
    // that's the right campaign goal. Otherwise fall back to the
    // brand-level default_campaign_goal.
    const recommendedFor: string =
      dominantProblemType === "awareness_gap"
        ? "awareness"
        : dominantProblemType === "conversion_gap"
          ? "conversion"
          : dominantProblemType === "strong_market"
            ? (brand.default_campaign_goal ?? "awareness")
            : (brand.default_campaign_goal ?? "awareness");

    const reasoning = generateMatchReasoning(
      nicheFit,
      audienceGeo,
      formatFit,
      engagementQuality,
      brandSafetyScoreForOutput,
      competitorBonus,
      finalScore
    );

    const breakdown = {
      niche_fit: nicheFit,
      audience_geo: audienceGeo,
      budget_fit: budgetFit,
      content_format: formatFit,
      engagement_quality: engagementQuality,
      brand_safety: brandSafety.score,
      brand_safety_sufficient_count: brandSafety.sufficient_count,
      brand_safety_confidence: brandSafety.confidence,
      competitor_bonus: competitorBonus,
      semantic_similarity: semanticSimilarity,
      past_collab_similarity: pastCollabSimilarity,
      theme_overlap_bonus: themeOverlapBonus,
      collab_network_bonus: collabNetworkBonus,
      weights: hasAnalysisForPlatform ? "with_platform_signals" : "legacy",
      weights_adjusted: adjustedWeights,
      data_quality: {
        caption_confidence: captionConfidence,
        audience_confidence: audienceConfidence,
      },
    };

    // `used_platform_signals` replaces `used_ig_signals` post-migration-046.
    // IG path keeps the shadow bool for one release so any reader that
    // predates the refactor still works.
    const usedPlatformSignals: Record<string, boolean> = {
      [creatorPlatform]: hasAnalysisForPlatform,
    };

    matchRows.push({
      creator_id: creator.creator_id,
      brand_id: brandId,
      platform: creatorPlatform,
      match_score: Math.round(finalScore * 1000) / 1000, // 3 decimal places
      niche_fit_score: Math.round(nicheFit * 1000) / 1000,
      audience_geo_score: Math.round(audienceGeo * 1000) / 1000,
      price_tier_score: Math.round(budgetFit * 1000) / 1000,
      engagement_score: Math.round(engagementQuality * 1000) / 1000,
      brand_safety_score: Math.round(brandSafetyScoreForOutput * 1000) / 1000,
      content_style_score: Math.round(formatFit * 1000) / 1000,
      already_mentions_brand: alreadyMentionsBrand,
      mentions_competitor: mentionsCompetitor,
      geo_match_regions: matchedGeoRegions as unknown as Database["public"]["Tables"]["creator_brand_matches"]["Insert"]["geo_match_regions"],
      recommended_for: recommendedFor,
      match_reasoning: reasoning,
      match_score_breakdown: breakdown as unknown as Database["public"]["Tables"]["creator_brand_matches"]["Insert"]["match_score_breakdown"],
      used_ig_signals: creatorPlatform === "instagram" && hasAnalysisForPlatform,
      used_platform_signals: usedPlatformSignals as unknown as Database["public"]["Tables"]["creator_brand_matches"]["Insert"]["used_platform_signals"],
      confidence: Math.round(matchConfidence * 100) / 100,
      coverage_percentage: coveragePercentage,
      missing_inputs: missingInputs as unknown as never,
      manual_review_required: manualReviewRequired,
      // percentile_in_brand_pool filled after the loop, when we have the pool.
      computed_at: new Date().toISOString(),
      algorithm_version: ALGORITHM_VERSION,
    } as Database["public"]["Tables"]["creator_brand_matches"]["Insert"]);
  }

  // ── 5b. Compute percentile_in_brand_pool over the pool ─────────────
  const sortedDescScores = matchRows
    .map((r) => r.match_score ?? 0)
    .sort((a, b) => b - a);
  for (const row of matchRows) {
    const score = row.match_score ?? 0;
    (row as Record<string, unknown>).percentile_in_brand_pool =
      computePercentileInPool(score, sortedDescScores);
  }

  // ── 6. Upsert into creator_brand_matches ────────────────────────────
  if (matchRows.length > 0) {
    // Upsert in batches of 50 to stay within payload limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < matchRows.length; i += BATCH_SIZE) {
      const batch = matchRows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from("creator_brand_matches")
        .upsert(batch as never[], {
          onConflict: "creator_id,brand_id,platform",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(
          `Upsert error (batch ${i / BATCH_SIZE + 1}):`,
          upsertError
        );
        throw new Error(`Failed to upsert matches: ${upsertError.message}`);
      }
    }
  }

  return matchRows.length;
}

// ── Single-creator recompute ─────────────────────────────────────────

/**
 * Recomputes matches for a single creator against every brand that
 * has shopify_connected=true OR already has brand_shopify_geo rows.
 *
 * Implementation: calls computeMatchesForBrand per affected brand.
 * That recomputes the whole 200-row brand pool — slightly wider than
 * necessary, but keeps the scoring surface consolidated in one place
 * and correctly rebuilds the percentile distribution.
 *
 * 5-min debounce via brands.matches_recompute_queued_at prevents
 * duplicate work when the same creator finishes back-to-back pipeline
 * runs.
 */
export async function recomputeMatchesForCreator(
  supabase: SupabaseClient<Database>,
  creatorId: string
): Promise<{ brands_recomputed: number; brands_skipped: number }> {
  // Find brands that should care about this creator's score change.
  const [connectedRes, geoRes] = await Promise.all([
    supabase
      .from("brands")
      .select("id, matches_recompute_queued_at")
      .eq("shopify_connected", true),
    supabase
      .from("brand_shopify_geo")
      .select("brand_id")
      .limit(5000),
  ]);

  const connectedBrands =
    ((connectedRes.data ?? []) as Array<{
      id: string;
      matches_recompute_queued_at: string | null;
    }>);
  const geoBrandIds = new Set(
    ((geoRes.data ?? []) as Array<{ brand_id: string }>).map(
      (r) => r.brand_id
    )
  );

  // All connected brands are candidates.
  const candidateBrands = connectedBrands;
  // Plus any geo-only brands that aren't already in the connected list.
  const connectedIds = new Set(connectedBrands.map((b) => b.id));
  const geoOnlyIds = Array.from(geoBrandIds).filter(
    (id) => !connectedIds.has(id)
  );

  const debounceCutoff = new Date(Date.now() - 5 * 60_000).toISOString();

  let recomputed = 0;
  let skipped = 0;

  for (const brand of candidateBrands) {
    if (
      brand.matches_recompute_queued_at &&
      brand.matches_recompute_queued_at > debounceCutoff
    ) {
      skipped++;
      continue;
    }
    await supabase
      .from("brands")
      .update({
        matches_recompute_queued_at: new Date().toISOString(),
      } as never)
      .eq("id", brand.id);

    try {
      await computeMatchesForBrand(supabase, brand.id);
      await supabase
        .from("brands")
        .update({
          matches_last_computed_at: new Date().toISOString(),
        } as never)
        .eq("id", brand.id);
      recomputed++;
    } catch (err) {
      console.error(
        `recomputeMatchesForCreator(${creatorId}) failed for brand ${brand.id}:`,
        err
      );
    }
  }

  for (const brandId of geoOnlyIds) {
    try {
      await computeMatchesForBrand(supabase, brandId);
      recomputed++;
    } catch (err) {
      console.error(
        `recomputeMatchesForCreator(${creatorId}) failed for geo brand ${brandId}:`,
        err
      );
    }
  }

  // `creatorId` is used only for logging context; scoring happens per-brand.
  void creatorId;

  return { brands_recomputed: recomputed, brands_skipped: skipped };
}
