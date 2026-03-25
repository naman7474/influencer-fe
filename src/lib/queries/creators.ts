import { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorDiscoveryCard } from "@/types/api";

export interface CreatorFilters {
  search?: string;
  niche?: string;
  tone?: string;
  tier?: string;
  audienceCountry?: string;
  geoRegion?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minCPI?: number;
  maxCPI?: number;
  minEngagement?: number;
  maxEngagement?: number;
  minAuthenticity?: number;
  maxAuthenticity?: number;
  trend?: string;
  verified?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  view?: "grid" | "list";
  brandId?: string;
}

function mapLeaderboardRow(
  row: Record<string, unknown>,
  matchScore: number | null,
  shortlistItemId: string | null
): CreatorDiscoveryCard {
  return {
    creator_id: String(row.creator_id),
    handle: (row.handle as string) ?? "",
    display_name: (row.display_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    is_verified: Boolean(row.is_verified),
    tier: (row.tier as CreatorDiscoveryCard["tier"]) ?? null,
    followers: (row.followers as number | null) ?? null,
    posts_count: (row.posts_count as number | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    cpi: (row.cpi as number | null) ?? null,
    avg_engagement_rate: (row.avg_engagement_rate as number | null) ?? null,
    engagement_trend:
      (row.engagement_trend as CreatorDiscoveryCard["engagement_trend"]) ??
      "insufficient_data",
    audience_authenticity_score:
      (row.audience_authenticity_score as number | null) ?? null,
    primary_niche: (row.primary_niche as string | null) ?? null,
    secondary_niche: (row.secondary_niche as string | null) ?? null,
    primary_tone: (row.primary_tone as string | null) ?? null,
    audience_country: (row.audience_country as string | null) ?? null,
    match_score: matchScore,
    shortlist_state: {
      is_shortlisted: Boolean(shortlistItemId),
      shortlist_item_id: shortlistItemId,
    },
  };
}

export async function searchCreators(
  supabase: SupabaseClient,
  filters: CreatorFilters
) {
  const {
    search,
    niche,
    tone,
    tier,
    audienceCountry,
    geoRegion,
    minFollowers,
    maxFollowers,
    minCPI,
    maxCPI,
    minEngagement,
    maxEngagement,
    minAuthenticity,
    maxAuthenticity,
    trend,
    verified,
    sortBy = "cpi",
    sortDir = "desc",
    page = 1,
    pageSize = 24,
    brandId,
  } = filters;

  let rows: Record<string, unknown>[] = [];
  let total = 0;

  if (brandId && sortBy === "match_score") {
    const { data: matches, error: matchError } = await supabase
      .from("creator_brand_matches")
      .select("creator_id, match_score, geo_match_regions")
      .eq("brand_id", brandId)
      .order("match_score", {
        ascending: sortDir === "asc",
        nullsFirst: false,
      });

    if (matchError) {
      throw matchError;
    }

    const filteredMatches = (matches ?? []).filter((match) => {
      if (!geoRegion) {
        return true;
      }

      const target = String(geoRegion).toLowerCase();
      return Array.isArray(match.geo_match_regions)
        ? match.geo_match_regions.some((region) =>
            String((region as { region?: string }).region ?? "")
              .toLowerCase()
              .includes(target)
          )
        : false;
    });

    total = filteredMatches.length;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const pagedMatches = filteredMatches.slice(from, to);
    const creatorIds = pagedMatches.map((match) => String(match.creator_id));

    if (creatorIds.length > 0) {
      const { data, error } = await supabase
        .from("mv_creator_leaderboard")
        .select("*")
        .in("creator_id", creatorIds);

      if (error) {
        throw error;
      }

      const rowMap = new Map(
        (data ?? []).map((row) => [String(row.creator_id), row as Record<string, unknown>])
      );
      rows = creatorIds
        .map((creatorId) => rowMap.get(creatorId))
        .filter((row): row is Record<string, unknown> => Boolean(row));
    }
  } else {
    let query = supabase
      .from("mv_creator_leaderboard")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(
        `handle.ilike.%${search}%,display_name.ilike.%${search}%`
      );
    }

    if (niche) query = query.eq("primary_niche", niche);
    if (tone) query = query.eq("primary_tone", tone);
    if (tier) query = query.eq("tier", tier);
    if (verified) query = query.eq("is_verified", true);
    if (trend) query = query.eq("engagement_trend", trend);
    if (audienceCountry) {
      query = query.ilike("audience_country", `%${audienceCountry}%`);
    }

    if (minFollowers != null) query = query.gte("followers", minFollowers);
    if (maxFollowers != null) query = query.lte("followers", maxFollowers);
    if (minCPI != null) query = query.gte("cpi", minCPI);
    if (maxCPI != null) query = query.lte("cpi", maxCPI);
    if (minEngagement != null) {
      query = query.gte("avg_engagement_rate", minEngagement);
    }
    if (maxEngagement != null) {
      query = query.lte("avg_engagement_rate", maxEngagement);
    }
    if (minAuthenticity != null) {
      query = query.gte("audience_authenticity_score", minAuthenticity);
    }
    if (maxAuthenticity != null) {
      query = query.lte("audience_authenticity_score", maxAuthenticity);
    }

    const sortColumn =
      sortBy === "engagement"
        ? "avg_engagement_rate"
        : sortBy === "followers"
          ? "followers"
          : sortBy === "authenticity"
            ? "audience_authenticity_score"
            : "cpi";

    query = query.order(sortColumn, {
      ascending: sortDir === "asc",
      nullsFirst: false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;
    rows = (data ?? []) as Record<string, unknown>[];
    total = count ?? 0;

    if (brandId && geoRegion && rows.length > 0) {
      const creatorIds = rows.map((row) => String(row.creator_id));
      const matchesRes = await supabase
        .from("creator_brand_matches")
        .select("creator_id, geo_match_regions")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds);

      if (matchesRes.error) {
        throw matchesRes.error;
      }

      const target = String(geoRegion).toLowerCase();
      const allowedCreatorIds = new Set(
        (matchesRes.data ?? [])
          .filter((match) =>
            Array.isArray(match.geo_match_regions)
              ? match.geo_match_regions.some((region) =>
                  String((region as { region?: string }).region ?? "")
                    .toLowerCase()
                    .includes(target)
                )
              : false
          )
          .map((match) => String(match.creator_id))
      );

      rows = rows.filter((row) => allowedCreatorIds.has(String(row.creator_id)));
      total = rows.length;
    }
  }

  const creatorIds = rows.map((row) => String(row.creator_id));
  const matchMap = new Map<string, number | null>();
  const shortlistMap = new Map<string, string | null>();

  if (brandId && creatorIds.length > 0) {
    const [matchesRes, shortlistRes] = await Promise.all([
      supabase
        .from("creator_brand_matches")
        .select("creator_id, match_score")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds),
      supabase
        .from("brand_shortlist_items")
        .select("id, creator_id")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds),
    ]);

    if (matchesRes.error) {
      throw matchesRes.error;
    }

    if (shortlistRes.error) {
      throw shortlistRes.error;
    }

    for (const match of matchesRes.data ?? []) {
      matchMap.set(String(match.creator_id), match.match_score ?? null);
    }

    for (const item of shortlistRes.data ?? []) {
      shortlistMap.set(String(item.creator_id), item.id);
    }
  }

  return {
    creators: rows.map((row) =>
      mapLeaderboardRow(
        row,
        matchMap.get(String(row.creator_id)) ?? null,
        shortlistMap.get(String(row.creator_id)) ?? null
      )
    ),
    total,
  };
}
