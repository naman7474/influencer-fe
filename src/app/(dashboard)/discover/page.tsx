"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  LayoutGrid,
  List,
  Loader2,
  SearchX,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  searchCreators,
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  type DiscoveryFilters,
  type SortOption,
} from "@/lib/queries/creators";
import type { CreatorLeaderboard } from "@/lib/types/database";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterSidebar } from "@/components/discovery/filter-sidebar";
import { CreatorCard } from "@/components/creators/creator-card";
import type { CreatorCardCreator } from "@/components/creators/creator-card";

/* ------------------------------------------------------------------ */
/*  Page size                                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  Map leaderboard row -> CreatorCardCreator                          */
/* ------------------------------------------------------------------ */

function toCardCreator(row: CreatorLeaderboard): CreatorCardCreator {
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
  };
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function DiscoverPage() {
  /* ---- state ---- */
  const [filters, setFilters] = useState<DiscoveryFilters>({
    ...DEFAULT_FILTERS,
  });
  const [sort, setSort] = useState<SortOption>("cpi");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [creators, setCreators] = useState<CreatorLeaderboard[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* ---- supabase client ---- */
  const supabase = useMemo(() => createClient(), []);

  /* ---- debounced search ---- */
  const debouncedSearch = useDebounce(filters.search, 300);

  /* ---- fetch creators (initial / filter change) ---- */
  const fetchCreators = useCallback(async () => {
    setLoading(true);
    setPage(0);

    const filtersWithDebouncedSearch = {
      ...filters,
      search: debouncedSearch,
    };

    const result = await searchCreators(
      supabase,
      filtersWithDebouncedSearch,
      sort,
      0,
      PAGE_SIZE,
    );

    setCreators(result.data);
    setTotalCount(result.count);
    setLoading(false);
  }, [supabase, filters, debouncedSearch, sort]);

  // Re-fetch when debounced search, filters (except search), or sort changes
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
    sort,
  ]);

  /* ---- load more ---- */
  const handleLoadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);

    const filtersWithDebouncedSearch = {
      ...filters,
      search: debouncedSearch,
    };

    const result = await searchCreators(
      supabase,
      filtersWithDebouncedSearch,
      sort,
      nextPage,
      PAGE_SIZE,
    );

    setCreators((prev) => [...prev, ...result.data]);
    setPage(nextPage);
    setLoadingMore(false);
  }, [supabase, filters, debouncedSearch, sort, page]);

  const hasMore = creators.length < totalCount;

  /* ---- render ---- */
  return (
    <div className="flex h-full flex-col">
      {/* ── Page header ── */}
      <div className="shrink-0 space-y-1 pb-4">
        <h1 className="font-serif text-2xl tracking-tight text-foreground">
          Discover Creators
        </h1>
        <p className="text-sm text-muted-foreground">
          Search and filter creators to find the perfect match for your brand.
        </p>
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-4 shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search creators by name, niche, location..."
          className="h-10 pl-9"
          value={filters.search}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
        />
      </div>

      {/* ── Main content area ── */}
      <div className="flex min-h-0 flex-1 gap-0">
        {/* Sidebar (desktop) */}
        {sidebarOpen && (
          <FilterSidebar filters={filters} onChange={setFilters} />
        )}

        {/* Results area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 pl-4">
            <div className="flex items-center gap-3">
              {/* Toggle sidebar */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="text-xs"
              >
                {sidebarOpen ? "Hide Filters" : "Show Filters"}
              </Button>

              {/* Result count */}
              <span className="text-sm text-muted-foreground">
                {loading ? (
                  "Searching..."
                ) : (
                  <>
                    <span className="font-semibold text-foreground">
                      {totalCount.toLocaleString()}
                    </span>{" "}
                    creators found
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <Select
                value={sort}
                onValueChange={(val) => setSort(val as SortOption)}
              >
                <SelectTrigger size="sm" className="w-[180px]">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Grid / List toggle */}
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button
                  className={`flex items-center justify-center px-2 py-1.5 transition-colors ${
                    viewMode === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  className={`flex items-center justify-center px-2 py-1.5 transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Results grid / list ── */}
          <div className="flex-1 overflow-y-auto px-4 pt-4">
            {loading ? (
              <LoadingSkeleton viewMode={viewMode} />
            ) : creators.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                      : "flex flex-col gap-3"
                  }
                >
                  {creators.map((creator, idx) => (
                    <CreatorCard
                      key={creator.creator_id ?? `creator-${idx}`}
                      creator={toCardCreator(creator)}
                    />
                  ))}
                </div>

                {/* Load More */}
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
                        `Load More (${creators.length} of ${totalCount.toLocaleString()})`
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-56 w-full rounded-xl" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        No creators found
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Try adjusting your search query or filters to discover more creators.
      </p>
    </div>
  );
}
