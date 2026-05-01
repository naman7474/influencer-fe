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

export type SortOption = "cpi" | "avg_engagement_rate" | "followers" | "audience_authenticity";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
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
): Promise<{ data: CreatorLeaderboard[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

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

  // Sort
  const sortColumn =
    sort === "audience_authenticity" ? "authenticity_score" : sort;
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
