"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  LayoutGrid,
  List,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  CreatorCard,
  type DiscoveryCreator,
} from "@/components/creators/creator-card";
import { FilterPanel } from "@/components/discovery/filter-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CreatorFilters } from "@/lib/queries/creators";
import {
  formatNumber,
  formatPercent,
  humanize,
  normalizePercentValue,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Props {
  initialCreators: DiscoveryCreator[];
  initialTotal: number;
  initialFilters: CreatorFilters;
}

const COMPARE_STORAGE_KEY = "dashboard-compare";

export function DiscoverClient({
  initialCreators,
  initialTotal,
  initialFilters,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<CreatorFilters>(initialFilters);
  const [shortlist, setShortlist] = useState<DiscoveryCreator[]>(
    initialCreators.filter((creator) => creator.shortlist_state?.is_shortlisted)
  );
  const [compare, setCompare] = useState<DiscoveryCreator[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    void loadShortlist().then(setShortlist);
    setCompare(readStoredCreators(COMPARE_STORAGE_KEY));
  }, []);

  useEffect(() => {
    writeStoredCreators(COMPARE_STORAGE_KEY, compare);
  }, [compare]);

  const totalPages = Math.max(1, Math.ceil(initialTotal / (filters.pageSize ?? 24)));
  const currentPage = filters.page ?? 1;
  const view = filters.view ?? "grid";

  const pushFilters = (newFilters: CreatorFilters) => {
    const params = new URLSearchParams();

    Object.entries(newFilters).forEach(([key, value]) => {
      if (
        key !== "brandId" &&
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        params.set(key, String(value));
      }
    });

    startTransition(() => {
      router.push(`/discover${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  const handleFilterChange = (partial: Partial<CreatorFilters>) => {
    const updated = { ...filters, ...partial, page: 1 };
    setFilters(updated);
    pushFilters(updated);
  };

  const handleReset = () => {
    const reset: CreatorFilters = {
      sortBy: "cpi",
      sortDir: "desc",
      page: 1,
      pageSize: filters.pageSize ?? 24,
      view: "grid",
    };
    setFilters(reset);
    pushFilters(reset);
  };

  const handlePageChange = (page: number) => {
    const updated = { ...filters, page };
    setFilters(updated);
    pushFilters(updated);
  };

  const toggleShortlist = (creator: DiscoveryCreator) => {
    startTransition(async () => {
      try {
        const shortlistItemId = shortlist.find(
          (item) => item.creator_id === creator.creator_id
        )?.shortlist_state?.shortlist_item_id;

        if (shortlistItemId) {
          const response = await fetch(
            `/api/v1/brands/current/shortlist/items/${shortlistItemId}`,
            {
              method: "DELETE",
            }
          );

          if (!response.ok) {
            throw new Error("Unable to remove shortlist item.");
          }

          setShortlist((current) =>
            current.filter((item) => item.creator_id !== creator.creator_id)
          );
          return;
        }

        const response = await fetch("/api/v1/brands/current/shortlist/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creator_id: creator.creator_id,
            source: "discover",
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message || "Unable to shortlist creator.");
        }

        setShortlist((current) => {
          if (current.some((item) => item.creator_id === creator.creator_id)) {
            return current;
          }

          return [
            ...current,
            {
              ...creator,
              shortlist_state: {
                is_shortlisted: true,
                shortlist_item_id: payload.data.shortlist_item_id,
              },
            },
          ];
        });
      } catch (error) {
        console.error(error);
      }
    });
  };

  const toggleCompare = (creator: DiscoveryCreator) => {
    setCompare((current) => {
      const exists = current.some((item) => item.handle === creator.handle);
      if (exists) {
        return current.filter((item) => item.handle !== creator.handle);
      }
      if (current.length >= 4) {
        return [...current.slice(1), creator];
      }
      return [...current, creator];
    });
  };

  const activeFilters = buildActiveFilters(filters);

  return (
    <>
      <div className="space-y-6">
        <section>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Creator Discovery
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Find the right creators quickly
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Search and filter across your entire creator network.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <HeroMetric
                label="Results"
                value={initialTotal.toLocaleString()}
                icon={<Users className="h-4 w-4" />}
              />
              <HeroMetric
                label="Shortlist"
                value={shortlist.length.toString()}
                icon={<Bookmark className="h-4 w-4" />}
              />
              <HeroMetric
                label="Compare"
                value={compare.length.toString()}
                icon={<LayoutGrid className="h-4 w-4" />}
              />
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant={view === "grid" ? "default" : "outline"}
                  className={view === "grid" ? "" : "border-slate-300 bg-white"}
                  onClick={() => handleFilterChange({ view: "grid" })}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid
                </Button>
                <Button
                  variant={view === "list" ? "default" : "outline"}
                  className={view === "list" ? "" : "border-slate-300 bg-white"}
                  onClick={() => handleFilterChange({ view: "list" })}
                >
                  <List className="h-4 w-4" />
                  List
                </Button>
              </div>
            </div>
          </div>
        </section>

        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
        />

        <section className="rounded-lg border bg-card px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Results
              </p>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
                {initialTotal.toLocaleString()} creators available
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeFilters.length === 0 ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  No filters applied
                </Badge>
              ) : (
                activeFilters.map((filter) => (
                  <Badge
                    key={filter}
                    variant="secondary"
                    className="rounded-full px-3 py-1"
                  >
                    {filter}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </section>

        {isPending ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-[300px] rounded-lg border"
              />
            ))}
          </div>
        ) : initialCreators.length === 0 ? (
          <div className="rounded-lg border bg-card px-8 py-12 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border bg-muted text-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-lg font-semibold text-foreground">
              No creators matched this combination
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Broaden the follower, CPI, or authenticity ranges and try again.
            </p>
            <Button
              variant="outline"
              className="mt-6 border-slate-300 bg-white"
              onClick={handleReset}
            >
              Reset filters
            </Button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {initialCreators.map((creator) => (
              <CreatorCard
                key={creator.handle}
                creator={creator}
                isShortlisted={shortlist.some(
                  (item) => item.creator_id === creator.creator_id
                )}
                isCompared={compare.some(
                  (item) => item.handle === creator.handle
                )}
                onToggleShortlist={toggleShortlist}
                onToggleCompare={toggleCompare}
              />
            ))}
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>CPI</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Authenticity</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialCreators.map((creator) => (
                  <TableRow key={creator.handle}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/creators/${creator.handle}`}
                          className="font-semibold text-slate-950 hover:text-primary"
                        >
                          @{creator.handle}
                        </Link>
                        <span className="text-sm text-slate-500">
                          {creator.display_name || "Unnamed creator"}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {creator.primary_niche && (
                            <Badge variant="secondary">
                              {humanize(creator.primary_niche)}
                            </Badge>
                          )}
                          {creator.primary_tone && (
                            <Badge variant="outline">
                              {humanize(creator.primary_tone)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{creator.cpi ?? 0}</TableCell>
                    <TableCell>{formatNumber(creator.followers)}</TableCell>
                    <TableCell>
                      {creator.avg_engagement_rate
                        ? formatPercent(creator.avg_engagement_rate)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {Math.round(
                        normalizePercentValue(
                          creator.audience_authenticity_score
                        )
                      )}
                      %
                    </TableCell>
                    <TableCell>{creator.audience_country || "N/A"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className={
                            shortlist.some(
                              (item) => item.creator_id === creator.creator_id
                            )
                              ? ""
                              : "border-slate-300 bg-white"
                          }
                          variant={
                            shortlist.some(
                              (item) => item.creator_id === creator.creator_id
                            )
                              ? "default"
                              : "outline"
                          }
                          onClick={() => toggleShortlist(creator)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          className="border-slate-300 bg-white"
                          variant={
                            compare.some(
                              (item) => item.handle === creator.handle
                            )
                              ? "secondary"
                              : "outline"
                          }
                          onClick={() => toggleCompare(creator)}
                        >
                          Compare
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-slate-300 bg-white"
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 bg-white"
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {compare.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-4xl">
          <div className="flex flex-col gap-4 rounded-lg border bg-card px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Compare Tray
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                {compare.length} creator{compare.length > 1 ? "s" : ""} selected
              </p>
            </div>

            <div className="flex flex-1 flex-wrap gap-2">
              {compare.map((creator) => (
                <Badge
                  key={creator.handle}
                  variant="secondary"
                  className="rounded-full px-3 py-1"
                >
                  @{creator.handle}
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setCompare([])}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
              <Button
                disabled={compare.length < 2}
                onClick={() => setIsCompareOpen(true)}
              >
                <Users className="h-4 w-4" />
                Compare
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Creator comparison</DialogTitle>
            <DialogDescription>
              Side-by-side decision view for the creators currently in the compare tray.
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                {compare.map((creator) => (
                  <TableHead key={creator.handle}>@{creator.handle}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                {
                  label: "CPI",
                  render: (creator: DiscoveryCreator) => creator.cpi ?? 0,
                },
                {
                  label: "Followers",
                  render: (creator: DiscoveryCreator) =>
                    formatNumber(creator.followers),
                },
                {
                  label: "Engagement rate",
                  render: (creator: DiscoveryCreator) =>
                    creator.avg_engagement_rate
                      ? formatPercent(creator.avg_engagement_rate)
                      : "N/A",
                },
                {
                  label: "Audience authenticity",
                  render: (creator: DiscoveryCreator) =>
                    `${Math.round(
                      normalizePercentValue(creator.audience_authenticity_score)
                    )}%`,
                },
                {
                  label: "Primary niche",
                  render: (creator: DiscoveryCreator) =>
                    humanize(creator.primary_niche),
                },
                {
                  label: "Tone",
                  render: (creator: DiscoveryCreator) =>
                    humanize(creator.primary_tone),
                },
                {
                  label: "Audience country",
                  render: (creator: DiscoveryCreator) =>
                    creator.audience_country || "N/A",
                },
                {
                  label: "Momentum",
                  render: (creator: DiscoveryCreator) => (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        creator.engagement_trend === "growing"
                          ? "bg-emerald-100 text-emerald-800"
                          : creator.engagement_trend === "declining"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {humanize(creator.engagement_trend)}
                    </span>
                  ),
                },
              ].map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium text-slate-700">
                    {row.label}
                  </TableCell>
                  {compare.map((creator) => (
                    <TableCell key={`${row.label}-${creator.handle}`}>
                      {row.render(creator)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HeroMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-xs font-medium">
          {label}
        </p>
      </div>
      <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function buildActiveFilters(filters: CreatorFilters) {
  const items: string[] = [];

  if (filters.search) items.push(`Search: ${filters.search}`);
  if (filters.niche) items.push(`Niche: ${humanize(filters.niche)}`);
  if (filters.tone) items.push(`Tone: ${humanize(filters.tone)}`);
  if (filters.tier) items.push(`Tier: ${humanize(filters.tier)}`);
  if (filters.audienceCountry) {
    items.push(`Audience: ${filters.audienceCountry}`);
  }
  if (filters.trend) items.push(`Trend: ${humanize(filters.trend)}`);
  if (filters.verified) items.push("Verified only");
  if (filters.minCPI != null || filters.maxCPI != null) {
    items.push(
      `CPI: ${filters.minCPI ?? 0}-${filters.maxCPI ?? 100}`
    );
  }
  if (filters.minFollowers != null || filters.maxFollowers != null) {
    items.push(
      `Followers: ${formatNumber(filters.minFollowers ?? 0)}-${formatNumber(filters.maxFollowers ?? 1_500_000)}`
    );
  }

  return items;
}

async function loadShortlist(): Promise<DiscoveryCreator[]> {
  const response = await fetch("/api/v1/brands/current/shortlist/items", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return (payload.data?.items as DiscoveryCreator[]) ?? [];
}

function readStoredCreators(key: string): DiscoveryCreator[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredCreators(key: string, creators: DiscoveryCreator[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(creators));
}
