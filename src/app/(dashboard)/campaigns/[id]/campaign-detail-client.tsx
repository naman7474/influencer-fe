"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Target,
  Calendar,
  Copy,
  Check,
  Link2,
  Tag,
  Loader2,
  Wand2,
  Send,
  Trash2,
  Gift,
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

function goalLabel(goal: string | null): string {
  if (!goal) return "Not set";
  const map: Record<string, string> = {
    awareness: "Awareness",
    conversion: "Conversion",
    ugc_generation: "UGC Generation",
  };
  return map[goal] ?? goal;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function creatorStatusColor(status: string): string {
  const map: Record<string, string> = {
    shortlisted: "text-muted-foreground",
    outreach_sent: "text-info",
    negotiating: "text-warning",
    confirmed: "text-success",
    content_live: "text-primary",
    completed: "text-success",
    declined: "text-destructive",
  };
  return map[status] ?? "text-muted-foreground";
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
  const supabase = createClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState(utmLinks);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(initialDiscountCodes);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [codeGenError, setCodeGenError] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(
    (campaign as Campaign & { default_discount_percentage?: number }).default_discount_percentage ?? 15
  );
  const [giftingCreator, setGiftingCreator] = useState<CampaignCreatorWithDetails | null>(null);

  const handleSaveRate = useCallback(
    async (ccId: string, rateStr: string) => {
      const rate = rateStr.trim() === "" ? null : parseFloat(rateStr);
      if (rateStr.trim() !== "" && (isNaN(rate!) || rate! < 0)) return;
      try {
        // Find current status to pass through
        const cc = creators.find((c) => c.id === ccId);
        if (!cc) return;
        await updateCampaignCreatorStatus(supabase, ccId, cc.status, rate);
        setCreators((prev) =>
          prev.map((c) => (c.id === ccId ? { ...c, agreed_rate: rate } : c))
        );
      } catch (err) {
        console.error("Failed to save rate:", err);
      }
    },
    [creators, supabase],
  );

  const handleGenerateUTMs = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/utm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Failed to generate UTM links");
      } else {
        // Refresh the page to get updated links
        window.location.reload();
      }
    } catch {
      setGenError("Failed to generate UTM links. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [campaign.id]);

  const handleGenerateDiscountCodes = useCallback(async () => {
    setGeneratingCodes(true);
    setCodeGenError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/discount-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPercent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeGenError(data.error ?? "Failed to generate discount codes");
      } else {
        // Refresh codes
        const codesRes = await fetch(
          `/api/campaigns/${campaign.id}/discount-codes`
        );
        const codesData = await codesRes.json();
        if (codesRes.ok) {
          setDiscountCodes(codesData.codes ?? []);
        }
      }
    } catch {
      setCodeGenError("Failed to generate discount codes. Please try again.");
    } finally {
      setGeneratingCodes(false);
    }
  }, [campaign.id, discountPercent]);

  const handleDeactivateCode = useCallback(
    async (codeId: string) => {
      try {
        const res = await fetch(`/api/discount-codes/${codeId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setDiscountCodes((prev) =>
            prev.map((c) =>
              c.id === codeId ? { ...c, is_active: false } : c
            )
          );
        }
      } catch {
        // Silently fail — user can retry
      }
    },
    []
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of creators) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [creators]);

  const totalSpent = creators.reduce((sum, c) => sum + (c.agreed_rate ?? 0), 0);
  const budget = campaign.total_budget ?? 0;
  const remaining = budget - totalSpent;

  const confirmedCreators = creators.filter(
    (c) =>
      c.status === "confirmed" ||
      c.status === "content_live" ||
      c.status === "completed",
  );

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/campaigns" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {campaign.name}
            </h1>
            <Badge
              variant="secondary"
              className={cn("capitalize", statusBadgeClass(campaign.status))}
            >
              {campaign.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Target className="size-3.5" />
              {goalLabel(campaign.goal)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formatDate(campaign.start_date)}
              {campaign.end_date
                ? ` - ${formatDate(campaign.end_date)}`
                : ""}
            </span>
          </div>
          {campaign.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {campaign.description}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="creators">
            Creators ({creators.length})
          </TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Budget</p>
                  <p className="text-lg font-semibold">
                    {budget > 0
                      ? formatCurrency(budget, campaign.currency ?? "INR")
                      : "--"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                  <DollarSign className="size-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Spent</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(totalSpent, campaign.currency ?? "INR")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-info/10">
                  <DollarSign className="size-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-lg font-semibold">
                    {budget > 0
                      ? formatCurrency(
                          Math.max(remaining, 0),
                          campaign.currency ?? "INR",
                        )
                      : "--"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
                  <Users className="size-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Creators</p>
                  <p className="text-lg font-semibold">{creators.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status breakdown */}
          {Object.keys(statusCounts).length > 0 && (
            <Card>
              <CardContent>
                <h3 className="mb-3 text-sm font-medium">
                  Creator Status Breakdown
                </h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      <span
                        className={cn(
                          "text-sm font-medium capitalize",
                          creatorStatusColor(status),
                        )}
                      >
                        {status.replace("_", " ")}
                      </span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Creator status table */}
          {creators.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="mb-3 text-sm font-medium">
                  Campaign Creators
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Match %</TableHead>
                      <TableHead>Agreed Rate</TableHead>
                      <TableHead>Status</TableHead>
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
                          <input
                            type="number"
                            min={0}
                            defaultValue={cc.agreed_rate ?? ""}
                            placeholder="--"
                            className="w-20 rounded border bg-background px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            onBlur={(e) => {
                              const orig = cc.agreed_rate?.toString() ?? "";
                              if (e.target.value !== orig) {
                                handleSaveRate(cc.id, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <CreatorStatusDropdown
                            campaignCreatorId={cc.id}
                            currentStatus={cc.status}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Creators Tab ── */}
        <TabsContent value="creators" className="space-y-4 pt-4">
          {/* Start Outreach button */}
          {creators.filter((cc) => cc.status === "shortlisted").length > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">
                  {creators.filter((cc) => cc.status === "shortlisted").length}{" "}
                  shortlisted creator{creators.filter((cc) => cc.status === "shortlisted").length !== 1 ? "s" : ""}{" "}
                  ready for outreach
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send personalized outreach emails to start collaborations.
                </p>
              </div>
              <Button
                onClick={() => {
                  window.location.href = `/outreach?campaign=${campaign.id}&action=bulk`;
                }}
              >
                <Send className="size-4 mr-2" />
                Start Outreach
              </Button>
            </div>
          )}

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
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {creators.map((cc) => {
                const c = cc.creator;
                const initials = c.display_name
                  ? c.display_name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : c.handle.slice(0, 2).toUpperCase();
                const location = [c.city, c.country]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <Card
                    key={cc.id}
                    className={cn(
                      "border-l-3 border-l-transparent transition-all duration-200",
                      "hover:border-l-primary hover:shadow-md",
                    )}
                  >
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-10">
                            {c.avatar_url && (
                              <AvatarImage
                                src={c.avatar_url}
                                alt={c.handle}
                              />
                            )}
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link
                              href={`/creator/${c.handle}`}
                              className="font-handle truncate text-foreground hover:text-primary"
                            >
                              @{c.handle}
                            </Link>
                            {c.display_name && (
                              <p className="truncate text-sm text-muted-foreground">
                                {c.display_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <CreatorStatusDropdown
                          campaignCreatorId={cc.id}
                          currentStatus={cc.status}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {c.followers != null && (
                          <span>
                            <span className="font-semibold text-foreground">
                              {formatFollowers(c.followers)}
                            </span>{" "}
                            followers
                          </span>
                        )}
                        {c.tier && (
                          <Badge variant="secondary" className="capitalize">
                            {c.tier}
                          </Badge>
                        )}
                      </div>

                      {location && (
                        <p className="text-xs text-muted-foreground">
                          {location}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {cc.match_score_at_assignment != null && (
                          <span>
                            Match:{" "}
                            <span className="font-semibold text-foreground">
                              {cc.match_score_at_assignment}%
                            </span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          Rate:
                          <input
                            type="number"
                            min={0}
                            defaultValue={cc.agreed_rate ?? ""}
                            placeholder="--"
                            className="w-16 rounded border bg-background px-1.5 py-0.5 text-xs text-right font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            onBlur={(e) => {
                              const orig = cc.agreed_rate?.toString() ?? "";
                              if (e.target.value !== orig) {
                                handleSaveRate(cc.id, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </span>
                      </div>

                      {/* Gift button for confirmed+ creators */}
                      {["confirmed", "content_live", "completed"].includes(
                        cc.status
                      ) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-1"
                          onClick={() => setGiftingCreator(cc)}
                        >
                          <Gift className="size-3.5 mr-1" />
                          Send Gift
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Assets Tab ── */}
        <TabsContent value="assets" className="space-y-6 pt-4">
          {confirmedCreators.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <Link2 className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                No confirmed creators yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                UTM links and discount codes will appear here once creators
                are confirmed.
              </p>
            </div>
          ) : (
            <>
              {/* UTM Links */}
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">UTM Links</h3>
                    <Button
                      size="sm"
                      onClick={handleGenerateUTMs}
                      disabled={generating}
                    >
                      {generating ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="size-3.5" />
                      )}
                      {generating
                        ? "Generating..."
                        : generatedLinks.length > 0
                          ? "Regenerate UTMs"
                          : "Generate UTM Links"}
                    </Button>
                  </div>
                  {genError && (
                    <p className="text-sm text-destructive">{genError}</p>
                  )}
                  {generatedLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No UTM links generated yet. Click the button above to generate unique tracking links for each confirmed creator.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {generatedLinks.map((link) => {
                        const creator = creators.find(
                          (c) => c.creator_id === link.creator_id,
                        );
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const linkAny = link as any;
                        const shortUrl = linkAny.short_url as string | undefined;
                        const clickCount = (linkAny.click_count ?? 0) as number;
                        return (
                          <div
                            key={link.id}
                            className="flex items-center gap-3 rounded-lg border px-3 py-2"
                          >
                            <Link2 className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                {creator
                                  ? `@${creator.creator.handle}`
                                  : "General"}
                                {clickCount > 0 && (
                                  <span className="ml-2 text-[10px] text-info">
                                    {clickCount} click{clickCount !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </p>
                              {shortUrl ? (
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-xs font-semibold text-primary">
                                    {shortUrl}
                                  </p>
                                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                                    {link.full_url}
                                  </p>
                                </div>
                              ) : (
                                <p className="truncate font-mono text-xs text-foreground">
                                  {link.full_url}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                copyToClipboard(
                                  shortUrl ?? link.full_url ?? "",
                                  link.id,
                                )
                              }
                            >
                              {copiedId === link.id ? (
                                <Check className="size-3 text-success" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Discount Codes — real management UI */}
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Discount Codes</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Default discount:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={discountPercent}
                        onChange={(e) =>
                          setDiscountPercent(Number(e.target.value))
                        }
                        className="w-14 rounded border bg-background px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">
                        % off
                      </span>
                      <Button
                        size="sm"
                        onClick={handleGenerateDiscountCodes}
                        disabled={generatingCodes}
                      >
                        {generatingCodes ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="size-3.5" />
                        )}
                        {generatingCodes
                          ? "Generating..."
                          : discountCodes.length > 0
                            ? "Generate Missing Codes"
                            : "Generate Codes"}
                      </Button>
                    </div>
                  </div>
                  {codeGenError && (
                    <p className="text-sm text-destructive">{codeGenError}</p>
                  )}
                  {discountCodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No discount codes generated yet. Click the button above
                      to auto-generate Shopify discount codes for each
                      confirmed creator.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Creator</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-right">Uses</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-16" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {discountCodes.map((dc) => (
                          <TableRow key={dc.id}>
                            <TableCell>
                              <span className="font-handle text-sm">
                                @{dc.creator?.handle ?? "unknown"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                                  {dc.code}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() =>
                                    copyToClipboard(dc.code, `disc-${dc.id}`)
                                  }
                                >
                                  {copiedId === `disc-${dc.id}` ? (
                                    <Check className="size-3 text-success" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {dc.usage_count}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(
                                dc.revenue_attributed,
                                campaign.currency ?? "INR"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px]",
                                  dc.is_active
                                    ? "badge-active"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {dc.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {dc.is_active && (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => handleDeactivateCode(dc.id)}
                                  title="Deactivate code"
                                >
                                  <Trash2 className="size-3 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Content Tab ── */}
        <TabsContent value="content" className="pt-4">
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
