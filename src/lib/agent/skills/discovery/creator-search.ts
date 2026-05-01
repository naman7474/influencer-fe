import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ─── Types ──────────────────────────────────────────────────── */

interface RpcCreatorRow {
  id: string;
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
  platform: "instagram" | "youtube" | null;
  spoken_region: string | null;
  avg_hook_quality: number | null;
  organic_brand_mentions: string[] | null;
  is_conversion_oriented: boolean | null;
  dominant_cta_style: string | null;
  upload_cadence_days: number | null;
  audience_authenticity_score: number | null;
  audience_sentiment: string | null;
  total_count: number | null;
}

interface CreatorBrief {
  id: string;
  handle: string | null;
  display_name: string | null;
  platform: "instagram" | "youtube" | null;
  avatar_url: string | null;
  followers: number | null;
  tier: string | null;
  is_verified: boolean | null;
  /** One-line natural-language description, templated server-side. */
  summary: string;
  /** Top filter conditions this creator satisfied; empty when no filters. */
  why: string;
  scores: {
    cpi: number | null;
    er: number | null;
    hook_quality: number | null;
    audience_authenticity: number | null;
    brand_match: number | null;
  };
  /** Optional filter recap — which active filter values this creator hit. */
  hits: Record<string, boolean | string | number>;
}

type SearchParams = z.infer<ReturnType<typeof buildInputSchema>>;

/* ─── Schema ─────────────────────────────────────────────────── */

function buildInputSchema() {
  return z.object({
    query: z
      .string()
      .optional()
      .describe(
        "Free-text search across handle, name, bio, and language. Use for name searches, language (e.g. 'tamil', 'hindi'), keywords, etc.",
      ),
    niche: z
      .string()
      .optional()
      .describe(
        "Content niche. Common values: beauty, fashion, lifestyle, health, entertainment, education, parenting. Case-insensitive.",
      ),
    min_followers: z
      .number()
      .optional()
      .describe("Minimum follower count (subscribers for YouTube)"),
    max_followers: z
      .number()
      .optional()
      .describe("Maximum follower count (subscribers for YouTube)"),
    tier: z
      .enum(["nano", "micro", "mid", "macro", "mega"])
      .optional()
      .describe("Creator tier by size"),
    city: z.string().optional().describe("Creator city (partial match)"),
    country: z
      .string()
      .optional()
      .describe(
        "Creator country code. Only set if user explicitly requests a specific country.",
      ),
    language: z
      .string()
      .optional()
      .describe("Primary spoken language (e.g. Tamil, Hindi, English)"),
    min_cpi: z
      .number()
      .optional()
      .describe("Minimum CPI (Creator Performance Index) score"),
    platform: z
      .enum(["instagram", "youtube"])
      .optional()
      .describe(
        "Filter to creators active on a specific platform. Omit to search across both.",
      ),
    /* New (migration 050) */
    estimated_region: z
      .string()
      .optional()
      .describe(
        "Region inferred from on-camera audio — e.g. 'North India', 'South India', 'Maharashtra'. Partial match.",
      ),
    audience_country: z
      .string()
      .optional()
      .describe(
        "Primary country of the AUDIENCE (different from the creator's country). Use country name as it appears in audience analysis.",
      ),
    audience_language: z
      .string()
      .optional()
      .describe(
        "A language the creator's audience speaks (e.g. 'Hindi', 'English'). Matches creators whose audience-language map contains this key.",
      ),
    mentions_brand: z
      .string()
      .optional()
      .describe(
        "Find creators who already mention a specific brand or competitor organically (no payment). Use the brand's exact name as it would appear in captions, e.g. 'NCERT', 'CBSE'.",
      ),
    min_hook_quality: z
      .number()
      .optional()
      .describe(
        "Minimum hook quality score (0–1, from transcript analysis). 0.7+ = strong hooks. Useful for short-form heavy creators.",
      ),
    max_engagement_bait: z
      .number()
      .optional()
      .describe(
        "Maximum engagement-bait score (0–1, lower is better). 0.3 keeps creators who avoid 'tag 5 friends' / fake giveaways.",
      ),
    min_authenticity_score: z
      .number()
      .optional()
      .describe(
        "Minimum audience authenticity score (0–1, higher = more genuine engagement). 0.8+ filters out bot-heavy audiences.",
      ),
    dominant_cta_style: z
      .string()
      .optional()
      .describe(
        "CTA style the creator uses most: 'link_in_bio', 'swipe_up', 'comment_below', 'dm_for_info', 'follow_for_more', 'none'.",
      ),
    is_conversion_oriented: z
      .boolean()
      .optional()
      .describe(
        "True = creator's content pushes specific actions (purchase, signup, link clicks). False = primarily awareness / entertainment.",
      ),
    min_upload_cadence_days: z
      .number()
      .optional()
      .describe(
        "YouTube only: minimum average days between uploads (e.g. 7 = at most once a week). Set this to find slower-cadence creators.",
      ),
    max_upload_cadence_days: z
      .number()
      .optional()
      .describe(
        "YouTube only: maximum average days between uploads (e.g. 1 = posts daily or more often). Set this to find prolific creators.",
      ),
    min_avg_engagement_rate: z
      .number()
      .optional()
      .describe(
        "Minimum average engagement rate (0–1, e.g. 0.03 = 3%). Useful as a quality floor.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .default(10)
      .describe(
        "Max results to return (1–25). Past 25, refine the filters — the agent shouldn't paginate.",
      ),
  });
}

/* ─── Brief renderer ─────────────────────────────────────────── */

function fmtPct(v: number | null | undefined, digits = 1): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  const pct = v <= 1 ? v * 100 : v;
  return `${pct.toFixed(digits)}%`;
}

function fmtScore(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

/**
 * Templated one-line summary. No LLM call. Cheap, deterministic.
 * Example: "Education · Hindi+English · North India · 0.86 hook · mentions NCERT, CBSE"
 */
function buildSummary(c: RpcCreatorRow): string {
  const parts: string[] = [];
  if (c.primary_niche) parts.push(capitalize(c.primary_niche));
  if (c.primary_spoken_language) parts.push(c.primary_spoken_language);
  if (c.spoken_region) parts.push(c.spoken_region);
  if (c.avg_hook_quality != null) {
    parts.push(`${(c.avg_hook_quality <= 1 ? c.avg_hook_quality : c.avg_hook_quality / 100).toFixed(2)} hook`);
  }
  if (c.organic_brand_mentions && c.organic_brand_mentions.length > 0) {
    parts.push(`mentions ${c.organic_brand_mentions.slice(0, 3).join(", ")}`);
  }
  return parts.join(" · ");
}

/**
 * Top reasons this creator satisfied the active filters. Empty when no
 * filters are set. Helps the LLM (and the UI) explain *why* a creator
 * was returned.
 */
function buildWhy(c: RpcCreatorRow, p: SearchParams): string {
  const reasons: string[] = [];
  if (
    p.mentions_brand &&
    c.organic_brand_mentions?.some(
      (b) => b.toLowerCase() === p.mentions_brand!.toLowerCase(),
    )
  ) {
    reasons.push(`mentions ${p.mentions_brand} organically`);
  }
  if (
    p.estimated_region &&
    c.spoken_region?.toLowerCase().includes(p.estimated_region.toLowerCase())
  ) {
    reasons.push(`based in ${c.spoken_region}`);
  }
  if (
    p.min_hook_quality != null &&
    c.avg_hook_quality != null &&
    c.avg_hook_quality >= p.min_hook_quality
  ) {
    reasons.push(`hook ${fmtScore(c.avg_hook_quality)}/100`);
  }
  if (p.is_conversion_oriented === true && c.is_conversion_oriented === true) {
    reasons.push(
      `conversion-led${c.dominant_cta_style ? ` (${c.dominant_cta_style.replace(/_/g, " ")})` : ""}`,
    );
  }
  if (p.dominant_cta_style && c.dominant_cta_style === p.dominant_cta_style) {
    reasons.push(`CTA: ${p.dominant_cta_style.replace(/_/g, " ")}`);
  }
  if (p.audience_country && c.audience_country === p.audience_country) {
    reasons.push(`${p.audience_country} audience`);
  }
  if (
    p.min_authenticity_score != null &&
    c.audience_authenticity_score != null &&
    c.audience_authenticity_score >= p.min_authenticity_score
  ) {
    reasons.push(`audience auth ${fmtScore(c.audience_authenticity_score)}/100`);
  }
  if (
    p.min_upload_cadence_days != null &&
    c.upload_cadence_days != null &&
    c.upload_cadence_days >= p.min_upload_cadence_days
  ) {
    reasons.push(`cadence ${c.upload_cadence_days.toFixed(1)}d`);
  }
  if (
    p.max_upload_cadence_days != null &&
    c.upload_cadence_days != null &&
    c.upload_cadence_days <= p.max_upload_cadence_days
  ) {
    reasons.push(`cadence ${c.upload_cadence_days.toFixed(1)}d`);
  }
  if (
    p.min_avg_engagement_rate != null &&
    c.avg_engagement_rate != null &&
    c.avg_engagement_rate >= p.min_avg_engagement_rate
  ) {
    reasons.push(`ER ${fmtPct(c.avg_engagement_rate)}`);
  }
  if (p.audience_language) {
    // Couldn't easily check the audience_languages JSONB on the client side,
    // but the SQL filter already enforced the match — assert it.
    reasons.push(`audience speaks ${p.audience_language}`);
  }
  return reasons.slice(0, 3).join(" · ");
}

function buildHits(c: RpcCreatorRow, p: SearchParams): Record<string, boolean | string | number> {
  const hits: Record<string, boolean | string | number> = {};
  if (p.niche && c.primary_niche) hits.niche = c.primary_niche;
  if (p.tier && c.tier) hits.tier = c.tier;
  if (p.estimated_region && c.spoken_region) hits.region = c.spoken_region;
  if (p.audience_country && c.audience_country) hits.audience_country = c.audience_country;
  if (p.audience_language) hits.audience_language = p.audience_language;
  if (p.mentions_brand) hits.mentions_brand = p.mentions_brand;
  if (p.min_hook_quality != null && c.avg_hook_quality != null) {
    hits.hook_quality = fmtScore(c.avg_hook_quality) ?? 0;
  }
  return hits;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── Tool ───────────────────────────────────────────────────── */

export function creatorSearchTool(brandId: string, supabase: SupabaseClient) {
  const inputSchema = buildInputSchema();
  return tool({
    description:
      "Search the database for creators/influencers. This is the ONLY way to find real creator data — never invent profiles. Two-stage workflow: (1) call this tool to discover creators using filters; (2) once you've shortlisted finalists from the results, call `get_creator_details` for each to get their full intelligence bundle before recommending or drafting outreach. Don't call `get_creator_details` on raw queries — search first.",
    inputSchema,
    execute: async (params: SearchParams) => {
      const { data, error } = await supabase.rpc("fn_search_creators", {
        p_query: params.query || null,
        p_niche: params.niche || null,
        p_min_followers: params.min_followers ?? null,
        p_max_followers: params.max_followers ?? null,
        p_min_cpi: params.min_cpi ?? null,
        p_tier: params.tier || null,
        p_city: params.city || null,
        p_country: params.country || null,
        p_language: params.language || null,
        p_limit: Math.min(params.limit ?? 10, 25),
        p_offset: 0,
        p_platform: params.platform || null,
        /* migration 050 filters */
        p_estimated_region: params.estimated_region || null,
        p_audience_country: params.audience_country || null,
        p_audience_language: params.audience_language || null,
        p_mentions_brand: params.mentions_brand || null,
        p_min_hook_quality: params.min_hook_quality ?? null,
        p_max_engagement_bait: params.max_engagement_bait ?? null,
        p_min_authenticity_score: params.min_authenticity_score ?? null,
        p_dominant_cta_style: params.dominant_cta_style || null,
        p_is_conversion_oriented:
          params.is_conversion_oriented === undefined
            ? null
            : params.is_conversion_oriented,
        p_min_upload_cadence_days: params.min_upload_cadence_days ?? null,
        p_max_upload_cadence_days: params.max_upload_cadence_days ?? null,
        p_min_avg_engagement_rate: params.min_avg_engagement_rate ?? null,
      });
      const creators = (data || []) as RpcCreatorRow[];

      if (error) {
        return {
          results: [],
          count: 0,
          error: `Search failed: ${error.message}`,
        };
      }

      if (!creators?.length) {
        return {
          results: [],
          count: 0,
          message:
            "No creators found matching these criteria. Try broadening your filters (larger follower range, different niche, or remove the strictest filter).",
        };
      }

      // Brand-specific match scores in one query.
      const creatorIds = creators.map((c) => c.id);
      const { data: matchesRaw } = await supabase
        .from("creator_brand_matches")
        .select("creator_id, match_score, niche_fit_score, audience_geo_score, match_reasoning")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds);
      const matchMap = new Map(
        ((matchesRaw || []) as Array<{
          creator_id: string;
          match_score: number | null;
          match_reasoning: string | null;
        }>).map((m) => [m.creator_id, m]),
      );

      const briefs: CreatorBrief[] = creators.map((c) => {
        const match = matchMap.get(c.id);
        return {
          id: c.id,
          handle: c.handle,
          display_name: c.display_name,
          platform: c.platform,
          avatar_url: c.avatar_url,
          followers: c.followers,
          tier: c.tier,
          is_verified: c.is_verified,
          summary: buildSummary(c),
          why: buildWhy(c, params),
          scores: {
            cpi: c.cpi != null ? Math.round(c.cpi) : null,
            er: c.avg_engagement_rate ?? null,
            hook_quality: c.avg_hook_quality ?? null,
            audience_authenticity: c.audience_authenticity_score ?? null,
            brand_match: match?.match_score ?? null,
          },
          hits: buildHits(c, params),
        };
      });

      // Brand-aware sort: brand_match preferred when present, else CPI.
      // brand_match is 0–1, CPI is 0–100 — normalize to a single 0–100
      // ranking score so a creator with brand_match=0.5 doesn't outrank
      // one with no match but CPI=80. Ties break on followers.
      const rankScore = (b: CreatorBrief): number => {
        if (b.scores.brand_match != null) {
          return b.scores.brand_match * 100;
        }
        return b.scores.cpi ?? 0;
      };
      briefs.sort((a, b) => {
        const diff = rankScore(b) - rankScore(a);
        if (diff !== 0) return diff;
        return (b.followers ?? 0) - (a.followers ?? 0);
      });

      // Filter recap so the UI can show "Region: North India · Min hook 0.7"
      const filterRecap = buildFilterRecap(params);

      return {
        results: briefs,
        count: briefs.length,
        filters: filterRecap,
        total_in_database: creators[0]?.total_count ?? briefs.length,
      };
    },
  });
}

/**
 * Compact dictionary of the active filters, used by the UI to show a
 * "filters applied" recap above the result cards. The LLM also reads this
 * to remember what it asked for.
 */
function buildFilterRecap(p: SearchParams): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (p.query) r.query = p.query;
  if (p.niche) r.niche = p.niche;
  if (p.tier) r.tier = p.tier;
  if (p.platform) r.platform = p.platform;
  if (p.country) r.country = p.country;
  if (p.city) r.city = p.city;
  if (p.language) r.language = p.language;
  if (p.estimated_region) r.region = p.estimated_region;
  if (p.audience_country) r.audience_country = p.audience_country;
  if (p.audience_language) r.audience_language = p.audience_language;
  if (p.mentions_brand) r.mentions_brand = p.mentions_brand;
  if (p.dominant_cta_style) r.cta_style = p.dominant_cta_style;
  if (p.is_conversion_oriented !== undefined) r.is_conversion_oriented = p.is_conversion_oriented;
  if (p.min_followers != null) r.min_followers = p.min_followers;
  if (p.max_followers != null) r.max_followers = p.max_followers;
  if (p.min_cpi != null) r.min_cpi = p.min_cpi;
  if (p.min_hook_quality != null) r.min_hook_quality = p.min_hook_quality;
  if (p.max_engagement_bait != null) r.max_engagement_bait = p.max_engagement_bait;
  if (p.min_authenticity_score != null) r.min_authenticity_score = p.min_authenticity_score;
  if (p.min_upload_cadence_days != null) r.min_upload_cadence_days = p.min_upload_cadence_days;
  if (p.max_upload_cadence_days != null) r.max_upload_cadence_days = p.max_upload_cadence_days;
  if (p.min_avg_engagement_rate != null) r.min_avg_engagement_rate = p.min_avg_engagement_rate;
  return r;
}
