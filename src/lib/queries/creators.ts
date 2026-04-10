import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CreatorLeaderboard } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Filter shape shared between sidebar + query                        */
/* ------------------------------------------------------------------ */

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

  let query = supabase
    .from("mv_creator_leaderboard")
    .select("*", { count: "exact" });

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

  // Minimum engagement rate
  if (filters.minEngagementRate > 0) {
    query = query.gte("avg_engagement_rate", filters.minEngagementRate);
  }

  // Minimum authenticity score
  if (filters.minAuthenticity > 0) {
    query = query.gte("authenticity_score", filters.minAuthenticity);
  }

  // Verified only
  if (filters.verifiedOnly) {
    query = query.eq("is_verified", true);
  }

  // Has contact — we cannot check "not null" on a view column directly,
  // so we filter by is_active as a proxy or skip. The view does not have
  // contact_email, so we skip this filter at the query level.
  // (Contact filtering would need a join or a different view.)

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
