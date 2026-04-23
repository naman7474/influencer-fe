"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Target,
  Calendar,
  Send,
  Gift,
  FileText,
  TrendingUp,
  LayoutGrid,
  LayoutList,
  Pencil,
  Megaphone,
  Video,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatFollowers } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreatorStatusDropdown } from "@/components/campaigns/creator-status-dropdown";
import { PerformanceTab } from "@/components/campaigns/performance-tab";
import { GeographicLiftWidget } from "@/components/campaigns/geographic-lift-widget";
import { GiftingDialog } from "@/components/campaigns/gifting-dialog";
import { ContentTab } from "@/components/campaigns/content-tab";
import { TrackingTab } from "@/components/campaigns/tracking-tab";
import { PipelineFunnel } from "@/components/campaigns/pipeline-funnel";
import { PipelineKanban } from "@/components/campaigns/pipeline-kanban";
import { InlineRateEditor } from "@/components/campaigns/inline-rate-editor";
import { createClient } from "@/lib/supabase/client";
import { updateCampaignCreatorStatus } from "@/lib/queries/campaigns";
import type { Campaign, CampaignUtmLink } from "@/lib/types/database";
import type { CampaignCreatorWithDetails } from "@/lib/queries/campaigns";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "badge-active";
  if (s === "draft") return "badge-draft";
  if (s === "completed") return "bg-muted text-muted-foreground";
  if (s === "paused") return "bg-warning/10 text-warning";
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
    label: "UGC Generation",
    icon: Video,
    cls: "bg-[rgba(180,120,220,0.15)] text-[#c9a0e8]",
  },
};

const STAGE_LEGEND: { key: string; label: string; dot: string }[] = [
  { key: "shortlisted", label: "Shortlisted", dot: "bg-muted-foreground/50" },
  { key: "outreach_sent", label: "Outreach Sent", dot: "bg-info" },
  { key: "negotiating", label: "Negotiating", dot: "bg-warning" },
  { key: "confirmed", label: "Confirmed", dot: "bg-success" },
  { key: "content_live", label: "Content Live", dot: "bg-primary" },
  { key: "completed", label: "Completed", dot: "bg-success/70" },
  { key: "declined", label: "Declined", dot: "bg-destructive/60" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DiscountCode {
  id: string;
  campaign_id: string;
  campaign_creator_id: string;
  creator_id: string;
  code: string;
  shopify_discount_id: string | null;
  discount_percentage: number;
  usage_count: number;
  revenue_attributed: number;
  is_active: boolean;
  created_at: string;
  creator?: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CampaignDetailClientProps {
  campaign: Campaign;
  creators: CampaignCreatorWithDetails[];
  utmLinks: CampaignUtmLink[];
  discountCodes?: DiscountCode[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CampaignDetailClient({
  campaign,
  creators: initialCreators,
  utmLinks,
  discountCodes: initialDiscountCodes = [],
}: CampaignDetailClientProps) {
  const [creators, setCreators] = useState(initialCreators);
  const [pipelineView, setPipelineView] = useState<"kanban" | "table">("kanban");
  const supabase = createClient();
  const [giftingCreator, setGiftingCreator] =
    useState<CampaignCreatorWithDetails | null>(null);

  const handleSaveRate = useCallback(
    async (ccId: string, rateStr: string) => {
      const rate = rateStr.trim() === "" ? null : parseFloat(rateStr);
      if (rateStr.trim() !== "" && (isNaN(rate!) || rate! < 0)) return;
      try {
        const cc = creators.find((c) => c.id === ccId);
        if (!cc) return;
        await updateCampaignCreatorStatus(supabase, ccId, cc.status, rate);
        setCreators((prev) =>
          prev.map((c) => (c.id === ccId ? { ...c, agreed_rate: rate } : c)),
        );
      } catch (err) {
        console.error("Failed to save rate:", err);
      }
    },
    [creators, supabase],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of creators) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [creators]);

  const budget = campaign.total_budget ?? 0;
  const totalSpent = creators.reduce(
    (sum, c) => sum + (c.agreed_rate ?? 0),
    0,
  );
  const budgetPct =
    budget > 0 ? Math.min(Math.round((totalSpent / budget) * 100), 100) : 0;

  const confirmedCount =
    (statusCounts["confirmed"] ?? 0) +
    (statusCounts["content_live"] ?? 0) +
    (statusCounts["completed"] ?? 0);
  const creatorPct =
    creators.length > 0
      ? Math.round((confirmedCount / creators.length) * 100)
      : 0;

  const deliveredCount = creators.reduce(
    (sum, c) => sum + (c.posts_delivered ?? 0),
    0,
  );
  const expectedCount = creators.reduce(
    (sum, c) => sum + (c.content_deliverables?.length ?? 0),
    0,
  );
  const contentPct =
    expectedCount > 0
      ? Math.round((deliveredCount / expectedCount) * 100)
      : 0;

  const confirmedCreators = creators.filter(
    (c) =>
      c.status === "confirmed" ||
      c.status === "content_live" ||
      c.status === "completed",
  );

  const shortlistedCount = statusCounts["shortlisted"] ?? 0;

  const goalMeta = GOAL_META[campaign.goal ?? ""] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/campaigns" />}
          className="mt-1"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {campaign.name}
            </h1>
            <Badge
              variant="secondary"
              className={cn("capitalize", statusBadgeClass(campaign.status))}
            >
              {campaign.status}
            </Badge>
            {goalMeta && (
              <Badge
                variant="secondary"
                className={cn("gap-1 text-[10px]", goalMeta.cls)}
              >
                <goalMeta.icon className="size-3" />
                {goalMeta.label}
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {formatDate(campaign.start_date)}
              {campaign.end_date
                ? ` – ${formatDate(campaign.end_date)}`
                : ""}
            </span>
            {campaign.total_budget != null && (
              <span className="inline-flex items-center gap-1.5">
                <DollarSign className="size-3.5" />
                {formatCurrency(
                  campaign.total_budget,
                  campaign.currency ?? "INR",
                )}{" "}
                budget
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {creators.length} creator{creators.length === 1 ? "" : "s"}
            </span>
          </div>
          {campaign.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {campaign.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {shortlistedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = `/outreach?campaign=${campaign.id}&action=bulk`;
              }}
            >
              <Send className="size-3.5" />
              Start Outreach ({shortlistedCount})
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href={`/campaigns/${campaign.id}/edit`} />}
            aria-label="Edit campaign"
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs: Overview | Pipeline | Tracking | Performance */}
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">
            Pipeline ({creators.length})
          </TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          {/* 4 smart KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Budget */}
            <Card size="sm">
              <CardContent className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
                    <DollarSign className="size-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Budget Used
                  </p>
                </div>
                <p className="text-xl font-semibold tracking-tight leading-none">
                  {budget > 0 ? (
                    <>
                      {formatCurrency(totalSpent, campaign.currency ?? "INR")}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        / {formatCurrency(budget, campaign.currency ?? "INR")}
                      </span>
                    </>
                  ) : (
                    "--"
                  )}
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      budget > 0 && budgetPct > 80
                        ? "bg-destructive"
                        : "bg-primary",
                    )}
                    style={{ width: `${budget > 0 ? budgetPct : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {budget > 0
                    ? `${budgetPct}% of budget committed`
                    : "No budget set"}
                </p>
              </CardContent>
            </Card>

            {/* Creators */}
            <Card size="sm">
              <CardContent className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-success/15">
                    <Users className="size-4 text-success" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Creators
                  </p>
                </div>
                <p className="text-xl font-semibold tracking-tight leading-none">
                  {confirmedCount}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / {creators.length} confirmed
                  </span>
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-300"
                    style={{
                      width: `${creators.length > 0 ? creatorPct : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {creators.length > 0
                    ? `${creatorPct}% confirmation rate`
                    : "No creators yet"}
                </p>
              </CardContent>
            </Card>

            {/* Content */}
            <Card size="sm">
              <CardContent className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-info/15">
                    <FileText className="size-4 text-info" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Content
                  </p>
                </div>
                <p className="text-xl font-semibold tracking-tight leading-none">
                  {deliveredCount}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / {expectedCount || "--"} delivered
                  </span>
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-info transition-all duration-300"
                    style={{ width: `${expectedCount > 0 ? contentPct : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {expectedCount > 0
                    ? `${contentPct}% content rate`
                    : "No deliverables defined"}
                </p>
              </CardContent>
            </Card>

            {/* ROI */}
            <Card size="sm">
              <CardContent className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-warning/15">
                    <TrendingUp className="size-4 text-warning" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    ROI
                  </p>
                </div>
                <p className="text-xl font-semibold tracking-tight leading-none text-muted-foreground">
                  --
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted" />
                <p className="text-[10px] text-muted-foreground">
                  Available after performance data
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Two-column: Funnel + Quick Actions */}
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card size="sm">
              <CardContent className="space-y-3">
                <h3 className="text-sm font-semibold">Creator Pipeline</h3>
                {creators.length > 0 ? (
                  <PipelineFunnel
                    statusCounts={statusCounts}
                    total={creators.length}
                  />
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Add creators to see pipeline breakdown.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card size="sm">
              <CardContent className="space-y-3">
                <h3 className="text-sm font-semibold">Quick Actions</h3>
                <div className="flex flex-col gap-2">
                  {shortlistedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start w-full"
                      onClick={() => {
                        window.location.href = `/outreach?campaign=${campaign.id}&action=bulk`;
                      }}
                    >
                      <Send className="size-3.5" />
                      Start Outreach ({shortlistedCount} creator
                      {shortlistedCount !== 1 ? "s" : ""})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start w-full"
                    onClick={() => {
                      const el = document.querySelector(
                        '[data-value="tracking"]',
                      );
                      if (el instanceof HTMLElement) el.click();
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    Generate Tracking Links
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start w-full"
                    onClick={() => {
                      const el = document.querySelector(
                        '[data-value="pipeline"]',
                      );
                      if (el instanceof HTMLElement) el.click();
                    }}
                  >
                    <Users className="size-3.5" />
                    View Pipeline
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start w-full"
                    onClick={() => {
                      const el = document.querySelector(
                        '[data-value="performance"]',
                      );
                      if (el instanceof HTMLElement) el.click();
                    }}
                  >
                    <BarChart3 className="size-3.5" />
                    View Performance
                  </Button>
                </div>

                {/* Stage breakdown */}
                {creators.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Stage Breakdown
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {STAGE_LEGEND.map((stage) => {
                        const n = statusCounts[stage.key] ?? 0;
                        if (!n) return null;
                        return (
                          <div
                            key={stage.key}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  stage.dot,
                                )}
                              />
                              <span className="text-[11px] text-muted-foreground">
                                {stage.label}
                              </span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-foreground">
                              {n}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Pipeline Tab (replaces Creators + Content) ── */}
        <TabsContent value="pipeline" className="space-y-4 pt-4">
          {/* View toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-0.5 rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setPipelineView("kanban")}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  pipelineView === "kanban"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPipelineView("table")}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  pipelineView === "table"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutList className="size-3.5" />
              </button>
            </div>

            {shortlistedCount > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = `/outreach?campaign=${campaign.id}&action=bulk`;
                }}
              >
                <Send className="size-3.5" />
                Start Outreach
              </Button>
            )}
          </div>

          {creators.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <Users className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                No creators added yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add creators when editing this campaign.
              </p>
            </div>
          ) : pipelineView === "kanban" ? (
            <PipelineKanban
              creators={creators}
              currency={campaign.currency ?? "INR"}
              onSaveRate={handleSaveRate}
              onGift={setGiftingCreator}
            />
          ) : (
            /* Table view */
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creators.map((cc) => (
                      <TableRow key={cc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              {cc.creator.avatar_url && (
                                <AvatarImage
                                  src={cc.creator.avatar_url}
                                  alt={cc.creator.handle}
                                />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {cc.creator.handle
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link
                                href={`/creator/${cc.creator.handle}`}
                                className="font-handle text-foreground hover:text-primary"
                              >
                                @{cc.creator.handle}
                              </Link>
                              {cc.creator.display_name && (
                                <p className="text-xs text-muted-foreground">
                                  {cc.creator.display_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="capitalize text-[10px]"
                          >
                            {cc.creator.tier ?? "--"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {cc.match_score_at_assignment != null
                            ? `${cc.match_score_at_assignment}%`
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <InlineRateEditor
                            value={cc.agreed_rate}
                            currency={campaign.currency ?? "INR"}
                            onSave={(val) => handleSaveRate(cc.id, val)}
                          />
                        </TableCell>
                        <TableCell>
                          <CreatorStatusDropdown
                            campaignCreatorId={cc.id}
                            currentStatus={cc.status}
                          />
                        </TableCell>
                        <TableCell>
                          {["confirmed", "content_live", "completed"].includes(
                            cc.status,
                          ) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setGiftingCreator(cc)}
                              className="size-7"
                            >
                              <Gift className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Content section — merged from old Content tab */}
          {creators.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-3">Content Submissions</h3>
              <ContentTab
                campaignId={campaign.id}
                creators={creators.map((c) => ({
                  id: c.id,
                  creator_id: c.creator_id,
                  creator: {
                    handle: c.creator.handle,
                    display_name: c.creator.display_name,
                  },
                }))}
              />
            </div>
          )}
        </TabsContent>

        {/* ── Tracking Tab (replaces Assets) ── */}
        <TabsContent value="tracking" className="space-y-6 pt-4">
          <TrackingTab
            campaignId={campaign.id}
            currency={campaign.currency ?? "INR"}
            initialUtmLinks={utmLinks}
            initialDiscountCodes={initialDiscountCodes}
            defaultDiscountPercentage={
              (
                campaign as Campaign & {
                  default_discount_percentage?: number;
                }
              ).default_discount_percentage ?? 15
            }
            creators={creators.map((c) => ({
              creator_id: c.creator_id,
              creator: { handle: c.creator.handle },
            }))}
            hasConfirmedCreators={confirmedCreators.length > 0}
          />
        </TabsContent>

        {/* ── Performance Tab ── */}
        <TabsContent value="performance" className="space-y-6 pt-4">
          <PerformanceTab
            campaignId={campaign.id}
            currency={campaign.currency ?? "INR"}
          />
          <GeographicLiftWidget
            campaignId={campaign.id}
            campaignStatus={campaign.status}
            currency={campaign.currency ?? "INR"}
          />
        </TabsContent>
      </Tabs>

      {/* Gifting Dialog */}
      {giftingCreator && (
        <GiftingDialog
          campaignId={campaign.id}
          campaignCreatorId={giftingCreator.id}
          creatorId={giftingCreator.creator_id}
          creatorHandle={giftingCreator.creator.handle}
          creatorName={giftingCreator.creator.display_name}
          brandId={campaign.brand_id}
          currency={campaign.currency ?? "INR"}
          onClose={() => setGiftingCreator(null)}
          onSuccess={() => {
            setGiftingCreator(null);
          }}
        />
      )}
    </div>
  );
}
