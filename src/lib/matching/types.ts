/**
 * Zod schemas mirroring the Pydantic models in
 * pipeline/schemas/intelligence.py. Regenerate by running
 * `python3 -m pipeline.scripts.export_json_schema` and hand-editing
 * below if shapes change.
 *
 * These are the boundary schemas the matching engine uses to parse
 * creator intelligence rows. engine.ts should .safeParse() every
 * row it reads, and on failure route to the match_ingest_errors
 * table so drift is visible instead of silent.
 */

import { z } from "zod";

// ── helpers ────────────────────────────────────────────────────

const nullableNumber = z.number().nullable().optional();
const nullableString = z.string().nullable().optional();

const percentageToDecimal = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  if (Number.isNaN(n)) return undefined;
  return n > 1 ? n / 100 : n;
}, z.number().min(0).max(1).nullable().optional());

const signedPercentageToDecimal = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  if (Number.isNaN(n)) return undefined;
  if (Math.abs(n) > 1) {
    const scaled = n / 100;
    return Math.max(-1, Math.min(1, scaled));
  }
  return n;
}, z.number().min(-1).max(1).nullable().optional());

// ── Caption ────────────────────────────────────────────────────

export const CaptionIntelligencePayloadSchema = z
  .object({
    niche_classification: z
      .object({
        primary_niche: nullableString,
        secondary_niche: nullableString,
        confidence: percentageToDecimal,
        reasoning: nullableString,
      })
      .partial()
      .default({}),
    tone_profile: z
      .object({
        primary_tone: nullableString,
        secondary_tone: nullableString,
        formality_score: percentageToDecimal,
        humor_score: percentageToDecimal,
        authenticity_feel: percentageToDecimal,
      })
      .partial()
      .default({}),
    language_analysis: z
      .object({
        primary_language: nullableString,
        language_mix_percentages: z.record(z.string(), z.number()).default({}),
        uses_transliteration: z.boolean().default(false),
        script_types: z.array(z.string()).default([]),
      })
      .partial()
      .default({}),
    cta_patterns: z
      .object({
        dominant_cta_style: z.string().default("none"),
        cta_frequency: percentageToDecimal,
        conversion_oriented: z.boolean().default(false),
      })
      .partial()
      .default({}),
    brand_mentions: z
      .object({
        organic_brand_mentions: z.array(z.string()).default([]),
        paid_brand_mentions: z.array(z.string()).default([]),
        brand_categories: z.array(z.string()).default([]),
      })
      .partial()
      .default({}),
    content_themes: z
      .object({
        recurring_topics: z.array(z.string()).default([]),
        content_pillars: z.array(z.string()).default([]),
      })
      .partial()
      .default({}),
    authenticity_signals: z
      .object({
        personal_storytelling_frequency: percentageToDecimal,
        vulnerability_openness: percentageToDecimal,
        engagement_bait_score: percentageToDecimal,
      })
      .partial()
      .default({}),
  })
  .passthrough();

export type CaptionIntelligencePayload = z.infer<
  typeof CaptionIntelligencePayloadSchema
>;

// ── Transcript ─────────────────────────────────────────────────

export const TranscriptIntelligencePayloadSchema = z
  .object({
    data_quality: nullableString,
    speaking_language: z
      .object({
        primary_spoken_language: nullableString,
        languages_spoken: z.array(z.string()).default([]),
        caption_vs_spoken_mismatch: z.boolean().default(false),
      })
      .partial()
      .default({}),
    hook_analysis: z
      .object({
        hooks: z.array(z.any()).default([]),
        avg_hook_quality: percentageToDecimal,
        dominant_hook_style: nullableString,
      })
      .partial()
      .default({}),
    content_depth: z
      .object({
        avg_word_count_per_reel: z.number().nullable().optional(),
        vocabulary_complexity: nullableString,
        educational_density: percentageToDecimal,
        storytelling_score: percentageToDecimal,
        filler_word_frequency: percentageToDecimal,
      })
      .partial()
      .default({}),
    audio_production: z
      .object({
        overall_quality_assessment: z.string().default("casual"),
        uses_background_music: z.boolean().default(false),
        voiceover_vs_oncamera: nullableString,
        pacing: nullableString,
      })
      .partial()
      .default({}),
    regional_signals: z
      .object({
        cultural_references: z.array(z.string()).default([]),
        local_places_mentioned: z.array(z.string()).default([]),
        regional_language_phrases: z.array(z.string()).default([]),
        estimated_region: nullableString,
      })
      .partial()
      .default({}),
  })
  .passthrough();

export type TranscriptIntelligencePayload = z.infer<
  typeof TranscriptIntelligencePayloadSchema
>;

// ── Audience ───────────────────────────────────────────────────

export const AudienceIntelligencePayloadSchema = z
  .object({
    audience_language_distribution: z
      .object({
        languages: z.record(z.string(), z.number()).default({}),
        primary_audience_language: nullableString,
        multilingual_audience: z.boolean().default(false),
      })
      .partial()
      .default({}),
    audience_geography_inference: z
      .object({
        regions: z.array(z.string()).default([]),
        domestic_vs_international_split: z
          .object({
            domestic_percentage: percentageToDecimal,
            primary_country: nullableString,
          })
          .partial()
          .default({}),
      })
      .partial()
      .default({}),
    audience_authenticity: z
      .object({
        authenticity_score: percentageToDecimal,
        emoji_only_percentage: percentageToDecimal,
        generic_comment_percentage: percentageToDecimal,
        substantive_comment_percentage: percentageToDecimal,
        suspicious_patterns: z.array(z.string()).default([]),
      })
      .partial()
      .default({}),
    audience_sentiment: z
      .object({
        overall_sentiment: nullableString,
        sentiment_score: signedPercentageToDecimal,
      })
      .partial()
      .default({}),
    audience_demographics_inference: z
      .object({
        estimated_age_group: nullableString,
        estimated_gender_skew: nullableString,
        interest_signals: z.array(z.string()).default([]),
      })
      .partial()
      .default({}),
    engagement_quality: z
      .object({
        quality_score: percentageToDecimal,
        conversation_depth: nullableString,
        community_feel: nullableString,
      })
      .partial()
      .default({}),
  })
  .passthrough();

export type AudienceIntelligencePayload = z.infer<
  typeof AudienceIntelligencePayloadSchema
>;

// ── Data-quality envelope attached by W1 to every intelligence row ──

export const DataQualityEnvelopeSchema = z
  .object({
    confidence: z.number().min(0).max(1).default(0),
    coverage_percentage: z.number().default(0),
    was_defaulted: z.boolean().default(true),
    missing_fields: z.array(z.string()).default([]),
    sample_size: z.number().default(0),
    schema_version: z.string().default("1.0"),
    llm_failure: z.boolean().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export type DataQualityEnvelope = z.infer<typeof DataQualityEnvelopeSchema>;

// ── Helper: classify engine parse results so the engine can route
// failures to match_ingest_errors instead of silently dropping creators.

export type IntelligenceParseResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; reason: string; details: unknown };

export function parseCaptionIntel(
  raw: unknown,
): IntelligenceParseResult<CaptionIntelligencePayload> {
  const result = CaptionIntelligencePayloadSchema.safeParse(raw);
  return result.success
    ? { kind: "ok", data: result.data }
    : { kind: "error", reason: "caption_intelligence:schema_mismatch", details: result.error.issues };
}

export function parseTranscriptIntel(
  raw: unknown,
): IntelligenceParseResult<TranscriptIntelligencePayload> {
  const result = TranscriptIntelligencePayloadSchema.safeParse(raw);
  return result.success
    ? { kind: "ok", data: result.data }
    : { kind: "error", reason: "transcript_intelligence:schema_mismatch", details: result.error.issues };
}

export function parseAudienceIntel(
  raw: unknown,
): IntelligenceParseResult<AudienceIntelligencePayload> {
  const result = AudienceIntelligencePayloadSchema.safeParse(raw);
  return result.success
    ? { kind: "ok", data: result.data }
    : { kind: "error", reason: "audience_intelligence:schema_mismatch", details: result.error.issues };
}
