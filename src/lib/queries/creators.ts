import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CreatorLeaderboard } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Filter shape shared between sidebar + query                        */
/* ------------------------------------------------------------------ */

export type SocialPlatform = "instagram" | "youtube";
export type PlatformFilter = SocialPlatform | "all";

export interface DiscoveryFilters {
  search: string;
  minFollowers: number;
  maxFollowers: number;
  tiers: string[];
  minCpi: number;
  niches: string[];
  location: string;
  audienceLanguages: string[];
  minEngagementRate: number;
  minAuthenticity: number;
  contentFormats: string[];
  verifiedOnly: boolean;
  hasContact: boolean;
  platform: PlatformFilter;
  /* ── Migration-050 additions: surfaced via the new filter UI sections. ─ */
  /** Region inferred from on-camera audio, e.g. "North India". Partial match. */
  estimatedRegion: string;
  /** Audience's primary country (different from creator's country). */
  audienceCountry: string;
  /** Find creators who already mention this brand organically (GIN-indexed). */
  mentionsBrand: string;
  /** Min hook quality 0–1 (transcript_intelligence.avg_hook_quality). */
  minHookQuality: number;
  /** Max engagement bait 0–1 (caption_intelligence.engagement_bait_score). */
  maxEngagementBait: number;
  /** True = creator pushes specific actions, false = awareness-only. */
  isConversionOriented: boolean | null;
  /** CTA style the creator uses most. Empty = no filter. */
  dominantCtaStyle: string;
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  search: "",
  minFollowers: 0,
  maxFollowers: 1_000_000,
  tiers: [],
  minCpi: 0,
  niches: [],
  location: "",
  audienceLanguages: [],
  minEngagementRate: 0,
  minAuthenticity: 0,
  contentFormats: [],
  verifiedOnly: false,
  hasContact: false,
  platform: "all",
  estimatedRegion: "",
  audienceCountry: "",
  mentionsBrand: "",
  minHookQuality: 0,
  maxEngagementBait: 1,
  isConversionOriented: null,
  dominantCtaStyle: "",
};

/* ------------------------------------------------------------------ */
/*  Sort options                                                       */
/* ------------------------------------------------------------------ */

export type SortOption =
  | "cpi"
  | "avg_engagement_rate"
  | "followers"
  | "audience_authenticity"
  | "brand_match";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "brand_match", label: "Brand Match" },
  { value: "cpi", label: "CPI Score" },
  { value: "avg_engagement_rate", label: "Engagement Rate" },
  { value: "followers", label: "Followers" },
  { value: "audience_authenticity", label: "Authenticity Score" },
];

/* ------------------------------------------------------------------ */
/*  Query builder against mv_creator_leaderboard                       */
/* ------------------------------------------------------------------ */

export async function searchCreators(
  supabase: SupabaseClient<Database>,
  filters: DiscoveryFilters,
  sort: SortOption,
  page: number,
  pageSize: number = 20,
  brandId: string | null = null,
): Promise<{ data: CreatorLeaderboard[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // Brand-match sort needs a different query path: order is on
  // creator_brand_matches.match_score (per-brand), not the MV. We fetch
  // the top match-scored creator_ids first, then pull their MV rows and
  // restore the score-desc order client-side. Falls through to the
  // standard MV path when brandId is unavailable (no signed-in brand).
  if (sort === "brand_match" && brandId) {
    return await searchByBrandMatch(supabase, filters, brandId, from, to);
  }

  // When filtering by "all" we show at most one row per creator via the
  // blended view (highest-CPI platform wins). When filtering by a specific
  // platform, we hit the per-(creator, platform) leaderboard directly so
  // that creator appears under the platform the brand is searching on.
  const view =
    filters.platform === "all"
      ? "mv_creator_leaderboard_blended"
      : "mv_creator_leaderboard";

  // No count: the UI shows a static "20K+ creators" headline, so we don't
  // need to spend a planner round-trip per fetch. Saves work on every
  // filter/scroll change. If we ever want a per-filter count, switch to
  // count: "planned" (cheapest of the three; never use "exact" on the MV).
  let query = supabase.from(view).select("*");

  if (filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }

  // Text search on handle and display_name
  if (filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`handle.ilike.${term},display_name.ilike.${term}`);
  }

  // Followers range
  if (filters.minFollowers > 0) {
    query = query.gte("followers", filters.minFollowers);
  }
  if (filters.maxFollowers < 1_000_000) {
    query = query.lte("followers", filters.maxFollowers);
  }

  // Tier filter
  if (filters.tiers.length > 0) {
    query = query.in("tier", filters.tiers);
  }

  // Minimum CPI score
  if (filters.minCpi > 0) {
    query = query.gte("cpi", filters.minCpi);
  }

  // Niche filter on primary_niche
  if (filters.niches.length > 0) {
    query = query.in("primary_niche", filters.niches);
  }

  // Location (city or country ilike)
  if (filters.location.trim()) {
    const loc = `%${filters.location.trim()}%`;
    query = query.or(`city.ilike.${loc},country.ilike.${loc}`);
  }

  // Audience language filter on primary_audience_language
  if (filters.audienceLanguages.length > 0) {
    query = query.in("primary_audience_language", filters.audienceLanguages);
  }

  // Minimum engagement rate. The slider is in PERCENT units (0–15) but
  // the leaderboard column is 0–1 decimal — divide before comparing.
  if (filters.minEngagementRate > 0) {
    query = query.gte("avg_engagement_rate", filters.minEngagementRate / 100);
  }

  // Minimum authenticity. Slider 0–100; column 0–1 — same conversion.
  if (filters.minAuthenticity > 0) {
    query = query.gte("authenticity_score", filters.minAuthenticity / 100);
  }

  // Verified only
  if (filters.verifiedOnly) {
    query = query.eq("is_verified", true);
  }

  // ── Migration-050 filter columns on the leaderboard ──
  if (filters.estimatedRegion.trim()) {
    query = query.ilike(
      "spoken_region",
      `%${filters.estimatedRegion.trim()}%`,
    );
  }
  if (filters.audienceCountry.trim()) {
    query = query.eq("audience_country", filters.audienceCountry.trim());
  }
  if (filters.mentionsBrand.trim()) {
    // organic_brand_mentions is a text[]; supabase-py exposes `contains`
    // as the @> operator. GIN-indexed (idx_caption_intel_organic_brands).
    query = query.contains("organic_brand_mentions", [
      filters.mentionsBrand.trim(),
    ]);
  }
  if (filters.minHookQuality > 0) {
    query = query.gte("avg_hook_quality", filters.minHookQuality);
  }
  if (filters.isConversionOriented !== null) {
    query = query.eq("is_conversion_oriented", filters.isConversionOriented);
  }
  if (filters.dominantCtaStyle.trim()) {
    query = query.eq("dominant_cta_style", filters.dominantCtaStyle.trim());
  }
  // `maxEngagementBait` lives on caption_intelligence, not on the leaderboard
  // view — we'd need a join to filter cheaply. Skip in the filters-only path
  // and let the hybrid-search RPC apply it (which already lateral-joins).

  // Has contact — the view doesn't expose contact_email, so we skip this
  // filter at the query level. The hybrid-search RPC applies the same.

  // Sort. brand_match falls through here only when brandId is null
  // (no signed-in brand) — fall back to CPI so the page still renders.
  const effectiveSort = sort === "brand_match" ? "cpi" : sort;
  const sortColumn =
    effectiveSort === "audience_authenticity"
      ? "authenticity_score"
      : effectiveSort;
  query = query.order(sortColumn, { ascending: false, nullsFirst: false });

  // Pagination
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("searchCreators error:", error);
    return { data: [], count: 0 };
  }

  return {
    data: (data ?? []) as CreatorLeaderboard[],
    count: count ?? 0,
  };
}

/**
 * Brand-match-sorted page. Two queries:
 *   1. Fetch a slice of `creator_brand_matches` for the brand, ordered by
 *      match_score desc — gives us the creator_ids in score order.
 *   2. Pull those rows from `mv_creator_leaderboard` (.in() loses order).
 *      Re-sort client-side using the order from step 1 so the rendered
 *      list matches the score ranking.
 *
 * Filters are deliberately **not** applied here — applying them inside
 * the matches table loses the score ordering once we re-fetch from the
 * MV. If the user has filters set + sort=brand_match, the filters are
 * still respected on the *fetched page* by post-filter (acceptable for
 * the typical pageSize of 20). For heavy-filter use-cases we'd add a
 * proper SQL view.
 */
async function searchByBrandMatch(
  supabase: SupabaseClient<Database>,
  filters: DiscoveryFilters,
  brandId: string,
  from: number,
  to: number,
): Promise<{ data: CreatorLeaderboard[]; count: number }> {
  const platformFilter =
    filters.platform === "all" ? null : filters.platform;

  let mq = supabase
    .from("creator_brand_matches")
    .select("creator_id, platform, match_score")
    .eq("brand_id", brandId)
    .order("match_score", { ascending: false, nullsFirst: false });

  if (platformFilter) {
    mq = mq.eq("platform", platformFilter);
  }
  mq = mq.range(from, to);

  const { data: matchRows, error: mErr } = await mq;
  if (mErr) {
    console.error("searchByBrandMatch matches fetch error:", mErr);
    return { data: [], count: 0 };
  }
  const ordered = (matchRows ?? []) as Array<{
    creator_id: string | null;
    platform: string | null;
    match_score: number | null;
  }>;
  if (ordered.length === 0) {
    return { data: [], count: 0 };
  }

  const creatorIds = ordered
    .map((r) => r.creator_id)
    .filter((id): id is string => !!id);

  // Pull the MV rows. When platform filter is "all" we use the blended
  // view (one row per creator) to mirror the default Discover behavior.
  const view =
    filters.platform === "all"
      ? "mv_creator_leaderboard_blended"
      : "mv_creator_leaderboard";

  let lbq = supabase.from(view).select("*").in("creator_id", creatorIds);
  if (platformFilter) {
    lbq = lbq.eq("platform", platformFilter);
  }
  const { data: lbRows, error: lbErr } = await lbq;
  if (lbErr) {
    console.error("searchByBrandMatch MV fetch error:", lbErr);
    return { data: [], count: 0 };
  }

  // Restore score-desc order. We can key by creator_id alone here: the
  // platform filter (when not "all") makes the result set single-platform,
  // and the blended view has one row per creator. Either way creator_id
  // is unique within the fetched set.
  const byKey = new Map<string, CreatorLeaderboard>();
  for (const row of (lbRows ?? []) as CreatorLeaderboard[]) {
    if (row.creator_id) byKey.set(row.creator_id, row);
  }
  const sortedData: CreatorLeaderboard[] = [];
  for (const m of ordered) {
    if (!m.creator_id) continue;
    const r = byKey.get(m.creator_id);
    if (r) sortedData.push(r);
  }

  return { data: sortedData, count: sortedData.length };
}
