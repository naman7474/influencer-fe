import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rerank, isRerankerEnabled } from "@/lib/agent/rerank";
import { embedQuery } from "@/lib/embed-cache";

/**
 * Hybrid semantic search over creator embeddings (Phase 2 of the
 * agent-search plan). Use for fuzzy intent queries — "creators who do
 * NEET prep", "shorts about home cooking" — that filter-only search
 * (`creator_search`) can't easily express.
 *
 * Pipeline:
 *   1. Embed the user's `intent` via OpenAI text-embedding-3-small
 *      (cached per process to avoid re-embedding identical intents).
 *   2. Call `fn_hybrid_search_creators` (BM25 FTS + vector ANN, fused
 *      with RRF, structured filters layered on top).
 *   3. Layer brand-match into ranking and emit briefs in the same shape
 *      as `creator_search` so the chat UI can render them with the
 *      existing CreatorSearchCard.
 */

/* ─── Types ──────────────────────────────────────────────────── */

interface HybridRow {
  creator_id: string;
  platform: "instagram" | "youtube" | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  biography: string | null;
  followers: number | null;
  tier: string | null;
  cpi: number | null;
  primary_niche: string | null;
  primary_tone: string | null;
  avg_engagement_rate: number | null;
  city: string | null;
  country: string | null;
  audience_country: string | null;
  primary_spoken_language: string | null;
  is_verified: boolean | null;
  spoken_region: string | null;
  avg_hook_quality: number | null;
  organic_brand_mentions: string[] | null;
  is_conversion_oriented: boolean | null;
  dominant_cta_style: string | null;
  upload_cadence_days: number | null;
  audience_authenticity_score: number | null;
  audience_sentiment: string | null;
  rrf_score: number | null;
}

interface SemanticBrief {
  id: string;
  handle: string | null;
  display_name: string | null;
  platform: "instagram" | "youtube" | null;
  avatar_url: string | null;
  followers: number | null;
  tier: string | null;
  is_verified: boolean | null;
  summary: string;
  why: string;
  scores: {
    cpi: number | null;
    er: number | null;
    hook_quality: number | null;
    audience_authenticity: number | null;
    brand_match: number | null;
    similarity: number | null;
  };
  hits: Record<string, boolean | string | number>;
}

/* ─── Schema ─────────────────────────────────────────────────── */

const inputSchema = z.object({
  intent: z
    .string()
    .min(3)
    .describe(
      "Natural-language intent — what kind of creator is the user looking for? E.g. 'creators who do NEET preparation in Hindi', 'home cooking shorts with regional recipes', 'fitness creators with educational tone for women in their 20s'. Better than keyword search for paraphrase queries.",
    ),
  /* Same structured filters as creator_search — layered on top of the
     hybrid retrieval inside fn_hybrid_search_creators. */
  niche: z.string().optional(),
  platform: z.enum(["instagram", "youtube"]).optional(),
  tier: z.enum(["nano", "micro", "mid", "macro", "mega"]).optional(),
  country: z.string().optional(),
  min_followers: z.number().optional(),
  max_followers: z.number().optional(),
  min_cpi: z.number().optional(),
  estimated_region: z.string().optional(),
  audience_country: z.string().optional(),
  audience_language: z.string().optional(),
  mentions_brand: z.string().optional(),
  min_hook_quality: z.number().optional(),
  max_engagement_bait: z.number().optional(),
  min_authenticity_score: z.number().optional(),
  is_conversion_oriented: z.boolean().optional(),
  dominant_cta_style: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe("Max results to return (1–20). Past 20, refine the query."),
});

type SearchParams = z.infer<typeof inputSchema>;

/* ─── Brief renderers (mirrors creator-search.ts conventions) ── */

function fmtScore(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildSummary(c: HybridRow): string {
  const parts: string[] = [];
  if (c.primary_niche) parts.push(capitalize(c.primary_niche));
  if (c.primary_spoken_language) parts.push(c.primary_spoken_language);
  if (c.spoken_region) parts.push(c.spoken_region);
  if (c.avg_hook_quality != null) {
    parts.push(
      `${(c.avg_hook_quality <= 1 ? c.avg_hook_quality : c.avg_hook_quality / 100).toFixed(2)} hook`,
    );
  }
  if (c.organic_brand_mentions && c.organic_brand_mentions.length > 0) {
    parts.push(`mentions ${c.organic_brand_mentions.slice(0, 3).join(", ")}`);
  }
  return parts.join(" · ");
}

function buildWhy(c: HybridRow, p: SearchParams, intent: string): string {
  const reasons: string[] = [];

  // Always lead with the matched intent — it's the *reason* the LLM picked
  // semantic search over keyword filters.
  reasons.push(`matches intent: "${intent.slice(0, 60)}${intent.length > 60 ? "…" : ""}"`);

  if (
    p.mentions_brand &&
    c.organic_brand_mentions?.some(
      (b) => b.toLowerCase() === p.mentions_brand!.toLowerCase(),
    )
  ) {
    reasons.push(`mentions ${p.mentions_brand}`);
  }
  if (
    p.estimated_region &&
    c.spoken_region?.toLowerCase().includes(p.estimated_region.toLowerCase())
  ) {
    reasons.push(`region ${c.spoken_region}`);
  }
  if (
    p.min_hook_quality != null &&
    c.avg_hook_quality != null &&
    c.avg_hook_quality >= p.min_hook_quality
  ) {
    reasons.push(`hook ${fmtScore(c.avg_hook_quality)}/100`);
  }
  if (p.audience_country && c.audience_country === p.audience_country) {
    reasons.push(`${p.audience_country} audience`);
  }
  return reasons.slice(0, 3).join(" · ");
}

function buildHits(c: HybridRow, p: SearchParams): Record<string, boolean | string | number> {
  const hits: Record<string, boolean | string | number> = {};
  if (p.niche && c.primary_niche) hits.niche = c.primary_niche;
  if (p.tier && c.tier) hits.tier = c.tier;
  if (p.estimated_region && c.spoken_region) hits.region = c.spoken_region;
  if (p.audience_country && c.audience_country) hits.audience_country = c.audience_country;
  if (p.audience_language) hits.audience_language = p.audience_language;
  if (p.mentions_brand) hits.mentions_brand = p.mentions_brand;
  return hits;
}

/* ─── Filter-recap helper for the UI ────────────────────────── */

function buildFilterRecap(p: SearchParams): Record<string, unknown> {
  const r: Record<string, unknown> = { intent: p.intent };
  if (p.niche) r.niche = p.niche;
  if (p.tier) r.tier = p.tier;
  if (p.platform) r.platform = p.platform;
  if (p.country) r.country = p.country;
  if (p.estimated_region) r.region = p.estimated_region;
  if (p.audience_country) r.audience_country = p.audience_country;
  if (p.audience_language) r.audience_language = p.audience_language;
  if (p.mentions_brand) r.mentions_brand = p.mentions_brand;
  if (p.dominant_cta_style) r.cta_style = p.dominant_cta_style;
  if (p.is_conversion_oriented !== undefined)
    r.is_conversion_oriented = p.is_conversion_oriented;
  if (p.min_followers != null) r.min_followers = p.min_followers;
  if (p.max_followers != null) r.max_followers = p.max_followers;
  if (p.min_cpi != null) r.min_cpi = p.min_cpi;
  if (p.min_hook_quality != null) r.min_hook_quality = p.min_hook_quality;
  if (p.max_engagement_bait != null) r.max_engagement_bait = p.max_engagement_bait;
  if (p.min_authenticity_score != null)
    r.min_authenticity_score = p.min_authenticity_score;
  return r;
}

/* ─── Translate input filters → JSONB blob for the RPC ──────── */

function buildFiltersJson(p: SearchParams): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (p.niche) filters.niche = p.niche;
  if (p.platform) filters.platform = p.platform;
  if (p.tier) filters.tier = p.tier;
  if (p.country) filters.country = p.country;
  if (p.min_followers != null) filters.min_followers = p.min_followers;
  if (p.max_followers != null) filters.max_followers = p.max_followers;
  if (p.min_cpi != null) filters.min_cpi = p.min_cpi;
  if (p.estimated_region) filters.estimated_region = p.estimated_region;
  if (p.audience_country) filters.audience_country = p.audience_country;
  if (p.audience_language) filters.audience_language = p.audience_language;
  if (p.mentions_brand) filters.mentions_brand = p.mentions_brand;
  if (p.min_hook_quality != null) filters.min_hook_quality = p.min_hook_quality;
  if (p.max_engagement_bait != null) filters.max_engagement_bait = p.max_engagement_bait;
  if (p.min_authenticity_score != null)
    filters.min_authenticity_score = p.min_authenticity_score;
  if (p.is_conversion_oriented !== undefined)
    filters.is_conversion_oriented = p.is_conversion_oriented;
  if (p.dominant_cta_style) filters.dominant_cta_style = p.dominant_cta_style;
  return filters;
}

/* ─── Tool ───────────────────────────────────────────────────── */

export function creatorSemanticSearchTool(
  brandId: string,
  supabase: SupabaseClient,
) {
  return tool({
    description:
      "Semantic creator search — use this for FUZZY / PARAPHRASE queries that filter-only search would miss. Examples: 'creators who do NEET preparation', 'shorts about home cooking', 'parenting creators with empathetic tone'. Combines BM25 lexical retrieval with vector embedding similarity, fused via Reciprocal Rank Fusion. For strict structured queries (specific tier + country + min CPI), use `creator_search` instead — it's faster and the filters are exact.",
    inputSchema,
    execute: async (params: SearchParams) => {
      // 1. Embed the intent (shared LRU cache — see lib/embed-cache.ts).
      let queryEmbedding: number[];
      try {
        queryEmbedding = await embedQuery(params.intent);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          results: [],
          count: 0,
          error: `Failed to embed intent: ${msg}`,
        };
      }

      // 2. Call the hybrid RPC. p_query_text is the same string we
      // embedded — the RPC runs it through plainto_tsquery for FTS while
      // p_query_embedding drives the vector search.
      //
      // Pull a wider pool than we'll return so the cross-encoder reranker
      // (step 3) has room to shuffle — Cohere's published recommendation
      // is 50 → 10. We cap the RPC output at 50; the user's `limit` is
      // applied AFTER rerank.
      const requestedLimit = Math.min(params.limit ?? 10, 20);
      const candidatePoolSize = isRerankerEnabled() ? 50 : requestedLimit;
      const { data, error } = await supabase.rpc("fn_hybrid_search_creators", {
        p_query_text: params.intent,
        p_query_embedding: queryEmbedding,
        p_filters: buildFiltersJson(params),
        p_limit: candidatePoolSize,
      });

      if (error) {
        return {
          results: [],
          count: 0,
          error: `Hybrid search failed: ${error.message}`,
        };
      }

      let candidates = (data || []) as HybridRow[];
      if (candidates.length === 0) {
        return {
          results: [],
          count: 0,
          message:
            "No creators matched this intent. Try rephrasing, broadening filters, or fall back to `creator_search` with structured filters.",
        };
      }

      // 3. Cross-encoder rerank (Phase 3). No-op when COHERE_API_KEY
      // isn't set — `rerank()` falls back to the input order capped at
      // topK. The reranker scores (intent, summary) pairs — `summary`
      // is the same templated brief the LLM and the UI use, so the
      // reranker sees what the user / agent will see.
      const reranked = await rerank<HybridRow>({
        query: params.intent,
        candidates,
        getText: (c) =>
          [
            c.display_name ?? c.handle ?? "",
            c.primary_niche ?? "",
            c.spoken_region ?? "",
            (c.organic_brand_mentions ?? []).join(" "),
            c.biography ?? "",
          ]
            .filter(Boolean)
            .join(". "),
        topK: requestedLimit,
      });
      candidates = reranked;

      // 4. Brand-match scores in one query (only for creators that
      // survived rerank, so we don't over-fetch).
      const ids = candidates.map((c) => c.creator_id);
      const { data: matchesRaw } = await supabase
        .from("creator_brand_matches")
        .select("creator_id, match_score, niche_fit_score, audience_geo_score, match_reasoning")
        .eq("brand_id", brandId)
        .in("creator_id", ids);
      const matchMap = new Map(
        ((matchesRaw || []) as Array<{
          creator_id: string;
          match_score: number | null;
        }>).map((m) => [m.creator_id, m]),
      );

      // 5. Brief format. `similarity` is the rerank score when present
      // (more meaningful than RRF), otherwise the normalized RRF score.
      const maxRrf = Math.max(
        ...candidates.map((c) => Number(c.rrf_score) || 0),
        1e-6,
      );
      const briefs: SemanticBrief[] = candidates.map((c) => {
        const match = matchMap.get(c.creator_id);
        const rrf = Number(c.rrf_score) || 0;
        const reranked = c as HybridRow & { rerank_score?: number };
        const similarity =
          reranked.rerank_score != null
            ? reranked.rerank_score
            : rrf > 0
              ? Math.min(1, rrf / maxRrf)
              : null;
        return {
          id: c.creator_id,
          handle: c.handle,
          display_name: c.display_name,
          platform: c.platform,
          avatar_url: c.avatar_url,
          followers: c.followers,
          tier: c.tier,
          is_verified: c.is_verified,
          summary: buildSummary(c),
          why: buildWhy(c, params, params.intent),
          scores: {
            cpi: c.cpi != null ? Math.round(c.cpi) : null,
            er: c.avg_engagement_rate ?? null,
            hook_quality: c.avg_hook_quality ?? null,
            audience_authenticity: c.audience_authenticity_score ?? null,
            brand_match: match?.match_score ?? null,
            // Prefer the cross-encoder score when present — it's calibrated
            // (0–1, higher = more relevant). Falls back to RRF normalized
            // by the max in this result set when the reranker isn't enabled.
            similarity,
          },
          hits: buildHits(c, params),
        };
      });

      // 6. Brand-aware sort. Per the locked decision in the plan:
      //   * With brand match available: 0.7 × similarity + 0.3 × match_score
      //     (locked weights; preserves the rerank's relevance signal as
      //     primary, while still giving brand-tuned creators a boost)
      //   * Without brand match: pure similarity order.
      const rankScore = (b: SemanticBrief): number => {
        const sim = b.scores.similarity ?? 0;
        if (b.scores.brand_match != null) {
          return 0.7 * sim + 0.3 * b.scores.brand_match;
        }
        return sim;
      };
      briefs.sort((a, b) => rankScore(b) - rankScore(a));

      return {
        results: briefs,
        count: briefs.length,
        intent: params.intent,
        filters: buildFilterRecap(params),
      };
    },
  });
}
