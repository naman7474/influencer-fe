"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Target,
  Calendar,
  Send,
  Pencil,
  Megaphone,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignBoard } from "@/components/campaigns/campaign-board";
import { CampaignAnalyticsStrip } from "@/components/campaigns/campaign-analytics-strip";
import { CreatorPanel } from "@/components/campaigns/creator-panel";
import { GiftingDialog } from "@/components/campaigns/gifting-dialog";
import type { Campaign, CampaignUtmLink } from "@/lib/types/database";
import type { CampaignCreatorWithDetails } from "@/lib/queries/campaigns";

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
    cls: "bg-canva-purple/15 text-canva-purple",
  },
  ugc_generation: {
    label: "UGC",
    icon: Video,
    cls: "bg-canva-pink/15 text-canva-pink",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface CampaignDetailClientProps {
  campaign: Campaign;
  creators: CampaignCreatorWithDetails[];
  /** Pre-fetched links — kept for parity; the board reads them lazily per creator. */
  utmLinks: CampaignUtmLink[];
  /** Pre-fetched discount codes — accepted to keep the page-level prop shape stable. */
  discountCodes?: unknown[];
}

export function CampaignDetailClient({
  campaign,
  creators: initialCreators,
}: CampaignDetailClientProps) {
  const [creators, setCreators] = useState(initialCreators);
  const [panelCcId, setPanelCcId] = useState<string | null>(null);
  const [giftingCreator, setGiftingCreator] =
    useState<CampaignCreatorWithDetails | null>(null);

  const goalMeta = GOAL_META[campaign.goal ?? ""] ?? null;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of creators) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [creators]);

  const shortlistedCount = statusCounts["shortlisted"] ?? 0;

  const funnel = {
    shortlisted: statusCounts["shortlisted"] ?? 0,
    outreach_sent: statusCounts["outreach_sent"] ?? 0,
    negotiating: statusCounts["negotiating"] ?? 0,
    confirmed: statusCounts["confirmed"] ?? 0,
    content_live: statusCounts["content_live"] ?? 0,
    completed: statusCounts["completed"] ?? 0,
    declined: statusCounts["declined"] ?? 0,
  };

  const handleCreatorClick = (cc: CampaignCreatorWithDetails) => {
    setPanelCcId(cc.id);
  };

  const handleCcUpdate = (next: CampaignCreatorWithDetails) => {
    setCreators((prev) =>
      prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)),
    );
  };

  const panelCc = panelCcId ? creators.find((c) => c.id === panelCcId) ?? null : null;

  return (
    <div className="flex h-full flex-col gap-5">
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
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
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
              {campaign.end_date ? ` – ${formatDate(campaign.end_date)}` : ""}
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
              render={
                <Link
                  href={`/outreach?campaign=${campaign.id}&action=bulk`}
                />
              }
            >
              <Send className="size-3.5" />
              Start outreach ({shortlistedCount})
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

      {/* Analytics strip */}
      <CampaignAnalyticsStrip
        campaignId={campaign.id}
        currency={campaign.currency ?? "INR"}
        budget={campaign.total_budget ?? null}
        funnel={funnel}
        totalCreators={creators.length}
      />

      {/* Hint strip */}
      <div className="flex items-center gap-2 rounded-2xl border border-canva-purple/20 bg-canva-purple-soft px-4 py-2.5 text-xs text-canva-purple">
        <span className="font-bold">Drag a card</span>
        <span className="text-canva-purple/80">
          to change status. Click a card to open the creator panel — outreach,
          submission link, tracking, content review, all in one place.
        </span>
      </div>

      {/* Board */}
      <div className="min-h-0 flex-1">
        {creators.length === 0 ? (
          <EmptyBoard campaignId={campaign.id} />
        ) : (
          <CampaignBoard
            campaignId={campaign.id}
            creators={creators}
            onCreatorsChange={setCreators}
            onCreatorClick={handleCreatorClick}
            onGift={setGiftingCreator}
          />
        )}
      </div>

      <CreatorPanel
        open={panelCc != null}
        onOpenChange={(o) => {
          if (!o) setPanelCcId(null);
        }}
        campaignId={campaign.id}
        campaignName={campaign.name}
        campaignCurrency={campaign.currency ?? "INR"}
        cc={panelCc}
        onUpdated={handleCcUpdate}
      />

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
          onSuccess={() => setGiftingCreator(null)}
        />
      )}
    </div>
  );
}

function EmptyBoard({ campaignId }: { campaignId: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
      <Users className="size-10 text-muted-foreground" />
      <h3 className="font-heading text-lg font-extrabold text-foreground">
        No creators on this campaign yet
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Shortlist creators from Discover and add them to this campaign — they’ll
        show up in the Shortlisted column here.
      </p>
      <Button render={<Link href={`/discover?campaign=${campaignId}`} />}>
        Find creators
      </Button>
    </div>
  );
}
