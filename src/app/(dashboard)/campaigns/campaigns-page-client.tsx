"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Megaphone,
  Search,
  LayoutGrid,
  LayoutList,
  Target,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CampaignsPageClientProps {
  brandId: string;
  initialCampaigns: Campaign[];
  campaignMeta: Record<
    string,
    {
      count: number;
      statusCounts: Record<string, number>;
      avatars: { handle: string; avatar_url: string | null }[];
    }
  >;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
] as const;

type SortOption = "updated" | "newest" | "name" | "budget";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "updated", label: "Recently Updated" },
  { value: "newest", label: "Newest First" },
  { value: "name", label: "Name A-Z" },
  { value: "budget", label: "Budget High-Low" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "badge-active";
  if (s === "draft") return "badge-draft";
  if (s === "completed") return "bg-muted text-muted-foreground";
  return "badge-draft";
}

const GOAL_META: Record<
  string,
  { label: string; icon: typeof Target; cls: string }
> = {
  awareness: {
    label: "Awareness",
    icon: Megaphone,
    cls: "bg-info/15 text-info",
  },
  conversion: {
    label: "Conversion",
    icon: Target,
    cls: "bg-primary/15 text-primary",
  },
  ugc_generation: {
    label: "UGC",
    icon: Video,
    cls: "bg-[rgba(180,120,220,0.15)] text-[#c9a0e8]",
  },
};

function formatDateCompact(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CampaignsPageClient({
  brandId,
  initialCampaigns,
  campaignMeta,
}: CampaignsPageClientProps) {

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const debouncedSearch = useDebounce(searchQuery, 200);

  const filtered = useMemo(() => {
    let result = initialCampaigns;

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false),
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "updated":
          return (
            new Date(b.updated_at ?? b.created_at).getTime() -
            new Date(a.updated_at ?? a.created_at).getTime()
          );
        case "newest":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "name":
          return a.name.localeCompare(b.name);
        case "budget":
          return (b.total_budget ?? 0) - (a.total_budget ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [initialCampaigns, statusFilter, debouncedSearch, sortBy]);

  /* Summary stats (across all campaigns, not just filtered) */
  const activeCampaigns = initialCampaigns.filter((c) => c.status === "active");
  const activeCount = activeCampaigns.length;
  const activeBudget = activeCampaigns.reduce(
    (sum, c) => sum + (c.total_budget ?? 0),
    0,
  );
  const totalCreators = Object.values(campaignMeta).reduce(
    (sum, m) => sum + m.count,
    0,
  );
  const activeCurrency = activeCampaigns[0]?.currency ?? "INR";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif italic text-2xl tracking-tight text-foreground">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage your influencer marketing campaigns.
          </p>
        </div>
        <Button render={<Link href="/campaigns/new" />}>
          <Plus className="size-4" />
          New Campaign
        </Button>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10">
        <SummaryStat label="Active Campaigns" value={String(activeCount)} />
        <span className="hidden h-7 w-px bg-border sm:block" />
        <SummaryStat
          label="Active Budget"
          value={
            activeBudget > 0
              ? formatCurrency(activeBudget, activeCurrency)
              : "--"
          }
        />
        <span className="hidden h-7 w-px bg-border sm:block" />
        <SummaryStat label="Total Creators" value={String(totalCreators)} />
        <span className="hidden h-7 w-px bg-border sm:block" />
        <SummaryStat
          label="All Campaigns"
          value={String(initialCampaigns.length)}
        />
      </div>

      {/* Toolbar: Search + Status Tabs + Sort + View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <Select
          value={sortBy}
          onValueChange={(val) => {
            if (val) setSortBy(val as SortOption);
          }}
        >
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex gap-0.5 rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "grid"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="List view"
          >
            <LayoutList className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <Megaphone className="mb-4 size-12 text-muted-foreground/50" />
          {statusFilter === "all" && !debouncedSearch ? (
            <>
              <p className="text-base font-medium text-foreground">
                Create your first campaign
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Set up an influencer campaign to manage creator outreach, track
                progress, and measure results.
              </p>
              <Button className="mt-4" render={<Link href="/campaigns/new" />}>
                <Plus className="size-4" />
                Create Campaign
              </Button>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-foreground">
                No campaigns found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search or filter.
              </p>
            </>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((campaign) => {
            const meta = campaignMeta[campaign.id];
            return (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                creatorCount={meta?.count ?? 0}
                statusCounts={meta?.statusCounts ?? {}}
                avatars={meta?.avatars ?? []}
              />
            );
          })}
        </div>
      ) : (
        /* List / Table view */
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Creators</TableHead>
                <TableHead className="text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign) => {
                const meta = campaignMeta[campaign.id];
                const count = meta?.count ?? 0;
                const sc = meta?.statusCounts ?? {};
                const confirmed =
                  (sc.confirmed ?? 0) +
                  (sc.content_live ?? 0) +
                  (sc.completed ?? 0);
                const pct =
                  count > 0 ? Math.round((confirmed / count) * 100) : 0;
                const goalMeta = GOAL_META[campaign.goal ?? ""] ?? null;
                return (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="max-w-[320px]">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="block"
                      >
                        <p className="truncate font-medium text-foreground hover:text-primary">
                          {campaign.name}
                        </p>
                        {campaign.description && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {campaign.description}
                          </p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "capitalize text-[10px]",
                          statusBadgeClass(campaign.status),
                        )}
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {goalMeta ? (
                        <Badge
                          variant="secondary"
                          className={cn("gap-1 text-[10px]", goalMeta.cls)}
                        >
                          <goalMeta.icon className="size-3" />
                          {goalMeta.label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateCompact(campaign.start_date)}
                      {campaign.end_date
                        ? ` – ${formatDateCompact(campaign.end_date)}`
                        : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {campaign.total_budget != null
                        ? formatCurrency(
                            campaign.total_budget,
                            campaign.currency ?? "INR",
                          )
                        : "--"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {count}
                    </TableCell>
                    <TableCell className="text-right">
                      {count > 0 ? (
                        <div className="inline-flex items-center gap-2">
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                pct === 100 ? "bg-success" : "bg-primary",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">
                            {pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
