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
  computeZoneGeoScore,
  resolveZone,
  type IndiaZone,
  ZONE_LABELS,
} from "@/lib/geo/india";
import {
  computeBrandSafety,
  type CaptionIntelForSafety,
  type AudienceIntelForSafety,
  type CreatorScoresForSafety,
  type BrandSafetyConfig,
} from "./brand-safety";

// ── Constants ─────────────────────────────────────────────────────────

const ALGORITHM_VERSION = "3.1.0";

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

/** Weights for composite score (used when brand has NO IG analysis). */
const WEIGHTS = {
  niche_fit: 0.3,
  audience_geo: 0.25,
  budget_fit: 0.15,
  content_format: 0.15,
  engagement_quality: 0.15,
} as const;

/**
 * Weights used when the brand has completed the IG analysis pipeline.
 * Shifts weight from coarse niche_fit to semantic + past-collab signals
 * which carry finer-grained DNA than the 10-category brand taxonomy.
 */
const WEIGHTS_WITH_IG = {
  niche_fit: 0.15,
  semantic_similarity: 0.2,
  past_collab_similarity: 0.15,
  audience_geo: 0.2,
  budget_fit: 0.1,
  content_format: 0.1,
  engagement_quality: 0.1,
} as const;

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

function generateMatchReasoning(
  nicheFit: number,
  audienceGeo: number,
  budgetFit: number,
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

  if (budgetFit >= 0.7) reasons.push("Budget well-matched to creator tier");
  else if (budgetFit > 0) reasons.push("Partial budget overlap");
  else reasons.push("Budget mismatch with creator tier");

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
  limit: number = 200
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

  // Flip to the IG-aware scoring path only when the pipeline has actually
  // produced an embedding for this brand. Graceful-degradation default.
  const hasIgAnalysis =
    Array.isArray(brand.content_embedding) && brand.content_embedding.length > 0;
  const brandEmbedding = hasIgAnalysis ? brand.content_embedding ?? null : null;
  const brandCollaborators = brand.ig_collaborators ?? [];
  const brandTopics = brand.ig_content_dna?.recurring_topics ?? [];

  // ── 2. Fetch brand_shopify_geo data ─────────────────────────────────
  const { data: geoRows } = await supabase
    .from("brand_shopify_geo")
    .select("*")
    .eq("brand_id", brandId);

  const brandGeoData = (geoRows ?? []) as BrandShopifyGeo[];

  // ── 3. Fetch top creators from leaderboard ──────────────────────────
  const { data: leaderboardRows, error: lbError } = await supabase
    .from("mv_creator_leaderboard")
    .select("*")
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

  const [captionResult, audienceResult, scoresResult, transcriptResult] = await Promise.all([
    supabase
      .from("caption_intelligence")
      .select("creator_id, primary_niche, secondary_niche, primary_tone, secondary_tone, formality_score, engagement_bait_score, vulnerability_openness, recurring_topics, brand_categories")
      .in("creator_id", creatorIds),
    supabase
      .from("audience_intelligence")
      .select("creator_id, geo_regions, authenticity_score, suspicious_patterns, sentiment_score, negative_themes, estimated_age_group")
      .in("creator_id", creatorIds),
    supabase
      .from("creator_scores")
      .select("creator_id, engagement_quality, content_mix, brand_mentions, professionalism, content_quality, sponsored_post_rate, sponsored_vs_organic_delta, creator_reply_rate")
      .in("creator_id", creatorIds),
    supabase
      .from("transcript_intelligence")
      .select("creator_id, primary_spoken_language")
      .in("creator_id", creatorIds),
  ]);

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
  };
  const captionMap = new Map<string, CaptionRow>();
  for (const row of (captionResult.data ?? []) as Array<{ creator_id: string } & CaptionRow>) {
    captionMap.set(row.creator_id, row);
  }

  type AudienceRow = {
    geo_regions: unknown;
    authenticity_score: number | null;
    suspicious_patterns: string[] | null;
    sentiment_score: number | null;
    negative_themes: string[] | null;
    estimated_age_group: string | null;
  };
  const audienceMap = new Map<string, AudienceRow>();
  for (const row of (audienceResult.data ?? []) as Array<{ creator_id: string } & AudienceRow>) {
    audienceMap.set(row.creator_id, row);
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
  for (const row of (scoresResult.data ?? []) as Array<{ creator_id: string } & ScoresRow>) {
    scoresMap.set(row.creator_id, row);
  }

  const transcriptMap = new Map<string, { primary_spoken_language: string | null }>();
  for (const row of (transcriptResult.data ?? []) as Array<{
    creator_id: string;
    primary_spoken_language: string | null;
  }>) {
    transcriptMap.set(row.creator_id, row);
  }

  // ── 4c. (IG path only) Fetch creator embeddings + past-collab pool ─
  const creatorEmbeddingMap = new Map<string, number[] | null>();
  let pastCollaboratorEmbeddings: (number[] | null)[] = [];
  if (hasIgAnalysis) {
    const { data: embRows } = await supabase
      .from("creators")
      .select("id, content_embedding")
      .in("id", creatorIds);
    for (const row of (embRows ?? []) as Array<{
      id: string;
      content_embedding: number[] | null;
    }>) {
      creatorEmbeddingMap.set(row.id, row.content_embedding);
    }

    if (brandCollaborators.length) {
      const { data: pastRows } = await supabase.rpc(
        "fn_resolve_brand_past_collaborators",
        { p_brand_id: brandId } as never
      );
      const pastList =
        (pastRows as Array<{ content_embedding: number[] | null }> | null) ?? [];
      pastCollaboratorEmbeddings = pastList
        .map((r) => r.content_embedding)
        .filter(
          (v): v is number[] =>
            Array.isArray(v) && v.length > 0
        );
    }
  }

  // ── 4b. Build brand zone needs (once, for all creators) ────────────
  // Derive target zones from brand's shipping_zones (cities → zones)
  const brandTargetZones = deriveBrandTargetZones(brand);
  const brandZoneNeeds = buildBrandZoneNeeds(brandGeoData, brandTargetZones.length > 0 ? brandTargetZones : undefined);

  // ── 5. Compute match scores for each creator ───────────────────────
  const brandCategories = brand.product_categories ?? [];
  const matchRows: Database["public"]["Tables"]["creator_brand_matches"]["Insert"][] =
    [];

  for (const creator of creators) {
    if (!creator.creator_id) continue;

    const captionIntel = captionMap.get(creator.creator_id) ?? null;
    const audienceIntel = audienceMap.get(creator.creator_id) ?? null;
    const creatorScores = scoresMap.get(creator.creator_id) ?? null;
    const transcriptIntel = transcriptMap.get(creator.creator_id) ?? null;

    // Use caption intelligence for niche, fallback to leaderboard
    const primaryNiche =
      captionIntel?.primary_niche ?? creator.primary_niche ?? null;
    const secondaryNiche = captionIntel?.secondary_niche ?? null;

    // Build multi-signal zone profile for this creator
    const creatorZoneProfile = buildCreatorZoneProfile({
      geoRegions: audienceIntel?.geo_regions,
      spokenLanguage: transcriptIntel?.primary_spoken_language ?? null,
      creatorCity: creator.city,
      creatorCountry: creator.country,
    });

    // Sub-scores
    const nicheFit = computeNicheFit(
      primaryNiche,
      secondaryNiche,
      brandCategories
    );
    const audienceGeo = computeZoneGeoScore(creatorZoneProfile, brandZoneNeeds);
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

    const brandSafety = computeBrandSafety(
      captionSafety,
      audienceSafety,
      scoresSafety,
      brandSafetyConfig
    );
    const brandSafetyMod = Math.max(0.3, brandSafety);

    // Modifiers
    const competitorBonus = computeCompetitorBonus(
      creatorScores?.brand_mentions ?? null,
      brand.competitor_brands
    );

    // ── IG-signal sub-scores (only meaningful when hasIgAnalysis) ──
    const creatorEmbedding = hasIgAnalysis
      ? creatorEmbeddingMap.get(creator.creator_id) ?? null
      : null;
    const semanticSimilarity = hasIgAnalysis
      ? computeSemanticSimilarity(brandEmbedding, creatorEmbedding)
      : 0;
    const pastCollabSimilarity = hasIgAnalysis
      ? computePastCollabSimilarity(creatorEmbedding, pastCollaboratorEmbeddings)
      : 0;
    const themeOverlapBonus = hasIgAnalysis
      ? computeThemeOverlapBonus(
          brandTopics,
          captionIntel?.recurring_topics ?? null
        )
      : 1.0;
    const collabNetworkBonus = hasIgAnalysis
      ? computeCollabNetworkBonus(creator.handle, brandCollaborators)
      : 1.0;

    // Composite score — branch on whether we have IG signals
    const rawScore = hasIgAnalysis
      ? nicheFit * WEIGHTS_WITH_IG.niche_fit +
        semanticSimilarity * WEIGHTS_WITH_IG.semantic_similarity +
        pastCollabSimilarity * WEIGHTS_WITH_IG.past_collab_similarity +
        audienceGeo * WEIGHTS_WITH_IG.audience_geo +
        budgetFit * WEIGHTS_WITH_IG.budget_fit +
        formatFit * WEIGHTS_WITH_IG.content_format +
        engagementQuality * WEIGHTS_WITH_IG.engagement_quality
      : nicheFit * WEIGHTS.niche_fit +
        audienceGeo * WEIGHTS.audience_geo +
        budgetFit * WEIGHTS.budget_fit +
        formatFit * WEIGHTS.content_format +
        engagementQuality * WEIGHTS.engagement_quality;

    const finalScore = Math.min(
      1.0,
      rawScore *
        brandSafetyMod *
        competitorBonus *
        themeOverlapBonus *
        collabNetworkBonus
    );

    // Check if creator mentions the brand itself
    const brandNameLower = brand.brand_name.toLowerCase().trim();
    const alreadyMentionsBrand =
      creatorScores?.brand_mentions?.some(
        (m) => m.toLowerCase().trim() === brandNameLower
      ) ?? false;

    const mentionsCompetitor = competitorBonus > 1.0;

    // Determine which zones matched (using zone profile + brand needs)
    const matchedGeoRegions: string[] = [];
    for (const zone of ["north", "south", "east", "west"] as IndiaZone[]) {
      if (creatorZoneProfile[zone] > 0.1 && brandZoneNeeds[zone].opportunity > 0) {
        matchedGeoRegions.push(ZONE_LABELS[zone]);
      }
    }

    const reasoning = generateMatchReasoning(
      nicheFit,
      audienceGeo,
      budgetFit,
      formatFit,
      engagementQuality,
      brandSafety,
      competitorBonus,
      finalScore
    );

    const breakdown = {
      niche_fit: nicheFit,
      audience_geo: audienceGeo,
      budget_fit: budgetFit,
      content_format: formatFit,
      engagement_quality: engagementQuality,
      brand_safety: brandSafety,
      competitor_bonus: competitorBonus,
      semantic_similarity: semanticSimilarity,
      past_collab_similarity: pastCollabSimilarity,
      theme_overlap_bonus: themeOverlapBonus,
      collab_network_bonus: collabNetworkBonus,
      weights: hasIgAnalysis ? "with_ig" : "legacy",
    };

    matchRows.push({
      creator_id: creator.creator_id,
      brand_id: brandId,
      match_score: Math.round(finalScore * 1000) / 1000, // 3 decimal places
      niche_fit_score: Math.round(nicheFit * 1000) / 1000,
      audience_geo_score: Math.round(audienceGeo * 1000) / 1000,
      price_tier_score: Math.round(budgetFit * 1000) / 1000,
      engagement_score: Math.round(engagementQuality * 1000) / 1000,
      brand_safety_score: Math.round(brandSafety * 1000) / 1000,
      content_style_score: Math.round(formatFit * 1000) / 1000,
      already_mentions_brand: alreadyMentionsBrand,
      mentions_competitor: mentionsCompetitor,
      geo_match_regions: matchedGeoRegions as unknown as Database["public"]["Tables"]["creator_brand_matches"]["Insert"]["geo_match_regions"],
      recommended_for: brand.default_campaign_goal,
      match_reasoning: reasoning,
      match_score_breakdown: breakdown as unknown as Database["public"]["Tables"]["creator_brand_matches"]["Insert"]["match_score_breakdown"],
      used_ig_signals: hasIgAnalysis,
      computed_at: new Date().toISOString(),
      algorithm_version: ALGORITHM_VERSION,
    });
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
          onConflict: "creator_id,brand_id",
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
