"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SearchX } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  DEFAULT_FILTERS,
  type DiscoveryFilters,
  type SortOption,
} from "@/lib/queries/creators";
import {
  fetchCreatorExtras,
  type CreatorExtras,
} from "@/lib/queries/discovery-extras";
import type { CreatorLeaderboard } from "@/lib/types/database";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBar } from "@/components/discovery/filter-bar";
import { CreatorCard } from "@/components/creators/creator-card";
import type { CreatorCardCreator } from "@/components/creators/creator-card";

const PAGE_SIZE = 20;

// `mv_creator_leaderboard` (per-platform variant) carries a platform column
// that's not yet reflected in the generated TS type. Cast through this shape
// to read it without losing safety on the documented columns.
type LeaderboardWithPlatform = CreatorLeaderboard & {
  platform?: "instagram" | "youtube" | null;
};

interface DiscoverSearchResponse {
  data: LeaderboardWithPlatform[];
  count: number;
  mode?: "filters_only" | "filters_only_fallback" | "hybrid";
  warning?: string;
}

/**
 * Calls the /api/discover/search route. Single source of truth for
 * Discover's data fetching — handles both filters-only and hybrid
 * (BM25 + vector) paths server-side. Embedding generation lives on the
 * server so the OpenAI key never touches the browser.
 */
async function fetchDiscoverPage(
  filters: DiscoveryFilters,
  sort: SortOption,
  page: number,
): Promise<DiscoverSearchResponse> {
  const res = await fetch("/api/discover/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters, sort, page, pageSize: PAGE_SIZE }),
  });
  if (!res.ok) {
    console.error("[discover] search failed:", res.status, await res.text());
    return { data: [], count: 0 };
  }
  return (await res.json()) as DiscoverSearchResponse;
}

function toCardCreator(row: LeaderboardWithPlatform): CreatorCardCreator {
  return {
    creator_id: row.creator_id ?? "",
    handle: row.handle ?? "",
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
    followers: row.followers ?? 0,
    tier: row.tier ?? "nano",
    is_verified: row.is_verified ?? false,
    city: row.city ?? null,
    country: row.country ?? null,
    cpi: row.cpi ?? null,
    avg_engagement_rate: row.avg_engagement_rate ?? null,
    engagement_trend: row.engagement_trend ?? null,
    primary_niche: row.primary_niche ?? null,
    primary_tone: row.primary_tone ?? null,
    primary_spoken_language: row.primary_language ?? null,
    audience_authenticity_score: row.authenticity_score ?? null,
    platform:
      row.platform === "youtube" || row.platform === "instagram"
        ? row.platform
        : undefined,
  };
}

export default function DiscoverPage() {
  const [filters, setFilters] = useState<DiscoveryFilters>({
    ...DEFAULT_FILTERS,
  });
  const [sort, setSort] = useState<SortOption>("brand_match");
  const [creators, setCreators] = useState<LeaderboardWithPlatform[]>([]);
  const [extras, setExtras] = useState<Map<string, CreatorExtras>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const debouncedSearch = useDebounce(filters.search, 300);

  const enrich = useCallback(
    async (rows: LeaderboardWithPlatform[]) => {
      const ids = rows.map((r) => r.creator_id ?? "").filter(Boolean);
      if (ids.length === 0) return new Map<string, CreatorExtras>();
      try {
        return await fetchCreatorExtras(supabase, ids);
      } catch (err) {
        console.error("fetchCreatorExtras failed:", err);
        return new Map<string, CreatorExtras>();
      }
    },
    [supabase],
  );

  const [warning, setWarning] = useState<string | null>(null);

  const fetchCreators = useCallback(async () => {
    setLoading(true);
    setPage(0);

    const filtersWithDebouncedSearch = {
      ...filters,
      search: debouncedSearch,
    };

    const result = await fetchDiscoverPage(filtersWithDebouncedSearch, sort, 0);
    setCreators(result.data);
    setHasMore(result.data.length >= PAGE_SIZE);
    setWarning(result.warning ?? null);
    setLoading(false);
    setExtras(await enrich(result.data));
  }, [filters, debouncedSearch, sort, enrich]);

  useEffect(() => {
    fetchCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    filters.minFollowers,
    filters.maxFollowers,
    filters.tiers,
    filters.minCpi,
    filters.niches,
    filters.location,
    filters.audienceLanguages,
    filters.minEngagementRate,
    filters.minAuthenticity,
    filters.contentFormats,
    filters.verifiedOnly,
    filters.hasContact,
    filters.platform,
    // Migration-050 filters that affect the result set:
    filters.estimatedRegion,
    filters.audienceCountry,
    filters.mentionsBrand,
    filters.minHookQuality,
    filters.maxEngagementBait,
    filters.isConversionOriented,
    filters.dominantCtaStyle,
    sort,
  ]);

  const handleLoadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);

    const filtersWithDebouncedSearch = {
      ...filters,
      search: debouncedSearch,
    };

    const result = await fetchDiscoverPage(
      filtersWithDebouncedSearch,
      sort,
      nextPage,
    );
    setCreators((prev) => [...prev, ...result.data]);
    setPage(nextPage);
    setHasMore(result.data.length >= PAGE_SIZE);
    setLoadingMore(false);
    const newExtras = await enrich(result.data);
    setExtras((prev) => {
      const merged = new Map(prev);
      for (const [k, v] of newExtras) merged.set(k, v);
      return merged;
    });
  }, [filters, debouncedSearch, sort, page, enrich]);


  // Reach-out: jump to the outreach Compose flow with the creator pre-selected.
  // The card's "Add to campaign" button opens the in-card dialog by default
  // (no onAddToCampaign override needed here).
  const handleReachOut = useCallback(
    (creatorId: string) => {
      router.push(`/outreach?compose=1&creator_id=${creatorId}`);
    },
    [router],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0 space-y-1">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
          Discover Creators
        </h1>
        <p className="text-sm text-muted-foreground">
          Filter and shortlist creators across Instagram and YouTube.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
      />

      {warning && (
        <div
          className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          role="status"
        >
          {warning}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pt-2">
        {loading ? (
          <LoadingSkeleton />
        ) : creators.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {creators.map((creator, idx) => {
                const ex = extras.get(creator.creator_id ?? "");
                return (
                  <CreatorCard
                    key={creator.creator_id ?? `creator-${idx}`}
                    creator={toCardCreator(creator)}
                    matchScore={ex?.matchScore ?? null}
                    matchReasons={ex?.matchReasoning ?? null}
                    avgViews={ex?.avgViews ?? null}
                    onReachOut={handleReachOut}
                  />
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center py-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `Load more (${creators.length} loaded)`
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[280px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-canva-purple-soft">
        <SearchX className="size-7 text-canva-purple" />
      </div>
      <h3 className="font-heading text-lg font-extrabold text-foreground">
        No creators found
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Try widening your filters — drop a tier or platform constraint to broaden the pool.
      </p>
    </div>
  );
}
