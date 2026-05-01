import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/embed-cache";
import {
  searchCreators,
  type DiscoveryFilters,
  type SortOption,
} from "@/lib/queries/creators";

/**
 * POST /api/discover/search
 *
 * Two-mode hybrid retrieval for the Discover page:
 *
 *   1. **Search non-empty** → embed the query with OpenAI
 *      `text-embedding-3-small` and call `fn_hybrid_search_creators`
 *      (BM25 + vector + RRF), with structured filters layered on top.
 *      Same engine the agent's `creator_semantic_search` tool uses.
 *
 *   2. **Search empty** → bypass the embedding cost and run the existing
 *      filters-only leaderboard query via `searchCreators` from
 *      `lib/queries/creators.ts`. Cheap, indexed.
 *
 * Auth: requires a logged-in user. We don't otherwise scope by brand
 * because creator discovery is read-only and shared across brands.
 *
 * Response shape matches the client's existing expectations:
 *   { data: CreatorRow[], count: number }
 */

interface SearchRequestBody {
  filters: DiscoveryFilters;
  sort: SortOption;
  page: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_HYBRID_LIMIT = 100;

export async function POST(request: NextRequest) {
  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { filters, sort, page } = body;
  const pageSize = body.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!filters || typeof filters !== "object") {
    return NextResponse.json(
      { error: "Missing filters" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  // Light auth check — endpoint is read-only but not public.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchText = (filters.search ?? "").trim();

  // ── Path A: filters-only (no semantic search) ───────────────
  // The existing query builder already supports the migration-050
  // filter columns we just added — no need to reimplement.
  if (searchText.length === 0) {
    const result = await searchCreators(supabase, filters, sort, page, pageSize);
    return NextResponse.json(
      {
        data: result.data,
        count: result.count,
        mode: "filters_only" as const,
      },
      { headers: cacheHeaders() },
    );
  }

  // ── Path B: hybrid search ──────────────────────────────────
  // Embed the query (LRU-cached per process) and call
  // fn_hybrid_search_creators with structured filters in a JSONB blob.
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(searchText);
  } catch (err) {
    console.error("[discover/search] embed failed:", err);
    // Fail open: fall back to filters-only with the search dropped so the
    // user still gets results, rather than an empty page.
    const result = await searchCreators(
      supabase,
      { ...filters, search: "" },
      sort,
      page,
      pageSize,
    );
    return NextResponse.json({
      data: result.data,
      count: result.count,
      mode: "filters_only_fallback" as const,
      warning: "Smart search unavailable — showing filter-only results",
    });
  }

  // Translate filters → JSONB shape that fn_hybrid_search_creators expects.
  const filtersJson: Record<string, unknown> = {};
  if (filters.platform !== "all") filtersJson.platform = filters.platform;
  if (filters.tiers.length === 1) filtersJson.tier = filters.tiers[0];
  if (filters.niches.length === 1) filtersJson.niche = filters.niches[0];
  if (filters.minFollowers > 0) filtersJson.min_followers = filters.minFollowers;
  if (filters.maxFollowers < 1_000_000)
    filtersJson.max_followers = filters.maxFollowers;
  if (filters.minCpi > 0) filtersJson.min_cpi = filters.minCpi;
  if (filters.location.trim()) filtersJson.country = filters.location.trim();
  if (filters.estimatedRegion.trim())
    filtersJson.estimated_region = filters.estimatedRegion.trim();
  if (filters.audienceCountry.trim())
    filtersJson.audience_country = filters.audienceCountry.trim();
  if (filters.audienceLanguages.length === 1)
    filtersJson.audience_language = filters.audienceLanguages[0];
  if (filters.mentionsBrand.trim())
    filtersJson.mentions_brand = filters.mentionsBrand.trim();
  if (filters.minHookQuality > 0)
    filtersJson.min_hook_quality = filters.minHookQuality;
  if (filters.maxEngagementBait < 1)
    filtersJson.max_engagement_bait = filters.maxEngagementBait;
  // The Discover UI's authenticity / ER sliders are PERCENT units. The
  // database columns and the RPC's filter parameters expect 0–1 decimals.
  if (filters.minAuthenticity > 0)
    filtersJson.min_authenticity_score = filters.minAuthenticity / 100;
  if (filters.minEngagementRate > 0)
    filtersJson.min_avg_engagement_rate = filters.minEngagementRate / 100;
  if (filters.isConversionOriented !== null)
    filtersJson.is_conversion_oriented = filters.isConversionOriented;
  if (filters.dominantCtaStyle.trim())
    filtersJson.dominant_cta_style = filters.dominantCtaStyle.trim();

  // The hybrid RPC doesn't paginate as cheaply as the leaderboard view,
  // so we pull a hard cap and slice client-side. For Discover's UX
  // (≤100 results visible at once) this is fine.
  const hardLimit = Math.min(MAX_HYBRID_LIMIT, (page + 1) * pageSize);
  // The hybrid RPC isn't in the generated DB types yet — cast through
  // `unknown` to satisfy the typed `rpc` overloads. Keeps the call site
  // typed enough for runtime safety while avoiding a regen of database.ts.
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )("fn_hybrid_search_creators", {
    p_query_text: searchText,
    p_query_embedding: queryEmbedding,
    p_filters: filtersJson,
    p_limit: hardLimit,
  });

  if (error) {
    console.error("[discover/search] hybrid RPC failed:", error);
    return NextResponse.json(
      { data: [], count: 0, error: error.message },
      { status: 500 },
    );
  }

  const allRows = (data || []) as Array<Record<string, unknown>>;
  // Slice for the requested page — RPC already returned RRF-sorted rows.
  const from = page * pageSize;
  const pageRows = allRows.slice(from, from + pageSize);

  return NextResponse.json(
    {
      data: pageRows,
      count: allRows.length,
      mode: "hybrid" as const,
      /** RRF score is on each row as `rrf_score`; the client can show it. */
    },
    { headers: cacheHeaders() },
  );
}

/**
 * Cache-Control headers for Discover responses.
 *   - `private`              → only this user's browser caches it (results
 *                              embed brand-specific match scores, so a CDN
 *                              must NOT cache and share across brands).
 *   - `max-age=30`           → fresh for 30 s (back/forward nav is instant).
 *   - `stale-while-revalidate=60` → if fetched 30–90 s ago, browser returns
 *                              the stale copy and refreshes in the background.
 *
 * Discover is read-only and the underlying MV refreshes nightly, so a tight
 * 30-s freshness window is fine. Quick filter tweaks won't repeatedly hit
 * the DB for the same filter set.
 */
function cacheHeaders(): HeadersInit {
  return {
    "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
  };
}
