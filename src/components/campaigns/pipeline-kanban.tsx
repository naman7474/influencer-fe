"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatFollowers } from "@/lib/format";
import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreatorStatusDropdown } from "@/components/campaigns/creator-status-dropdown";
import { InlineRateEditor } from "@/components/campaigns/inline-rate-editor";
import type { CampaignCreatorWithDetails } from "@/lib/queries/campaigns";

/* ------------------------------------------------------------------ */
/*  Stage config                                                       */
/* ------------------------------------------------------------------ */

const KANBAN_STAGES: {
  key: string;
  label: string;
  dotColor: string;
}[] = [
  { key: "shortlisted", label: "Shortlisted", dotColor: "bg-muted-foreground" },
  { key: "outreach_sent", label: "Outreach Sent", dotColor: "bg-info" },
  { key: "negotiating", label: "Negotiating", dotColor: "bg-warning" },
  { key: "confirmed", label: "Confirmed", dotColor: "bg-success" },
  { key: "content_live", label: "Content Live", dotColor: "bg-primary" },
  { key: "completed", label: "Completed", dotColor: "bg-success/70" },
  { key: "declined", label: "Declined", dotColor: "bg-destructive" },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface PipelineKanbanProps {
  creators: CampaignCreatorWithDetails[];
  currency: string;
  onSaveRate: (ccId: string, rateStr: string) => void;
  onGift: (cc: CampaignCreatorWithDetails) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PipelineKanban({
  creators,
  currency,
  onSaveRate,
  onGift,
}: PipelineKanbanProps) {
  const grouped = new Map<string, CampaignCreatorWithDetails[]>();
  for (const cc of creators) {
    const list = grouped.get(cc.status) ?? [];
    list.push(cc);
    grouped.set(cc.status, list);
  }

  // Only show stages that have creators, plus always show shortlisted, confirmed
  const activeStages = KANBAN_STAGES.filter(
    (s) =>
      (grouped.get(s.key)?.length ?? 0) > 0 ||
      s.key === "shortlisted" ||
      s.key === "confirmed",
  );

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4 min-w-max">
        {activeStages.map((stage) => {
          const items = grouped.get(stage.key) ?? [];
          return (
            <div
              key={stage.key}
              className="w-[260px] shrink-0 rounded-lg border bg-muted/30"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b">
                <span className={cn("size-2 rounded-full", stage.dotColor)} />
                <span className="text-xs font-semibold text-foreground">
                  {stage.label}
                </span>
                <Badge
                  variant="secondary"
                  className="ml-auto text-[10px] px-1.5 py-0"
                >
                  {items.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="space-y-2 p-2 max-h-[calc(100vh-380px)] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-6">
                    No creators
                  </p>
                ) : (
                  items.map((cc) => (
                    <KanbanCard
                      key={cc.id}
                      cc={cc}
                      currency={currency}
                      onSaveRate={onSaveRate}
                      onGift={onGift}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban card                                                        */
/* ------------------------------------------------------------------ */

function KanbanCard({
  cc,
  currency,
  onSaveRate,
  onGift,
}: {
  cc: CampaignCreatorWithDetails;
  currency: string;
  onSaveRate: (ccId: string, rateStr: string) => void;
  onGift: (cc: CampaignCreatorWithDetails) => void;
}) {
  const c = cc.creator;
  const isGiftable = ["confirmed", "content_live", "completed"].includes(
    cc.status,
  );

  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-2 shadow-sm">
      {/* Identity row */}
      <div className="flex items-center gap-2">
        <Avatar className="size-7 shrink-0">
          {c.avatar_url && (
            <AvatarImage src={c.avatar_url} alt={c.handle} />
          )}
          <AvatarFallback className="text-[9px]">
            {c.handle.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Link
            href={`/creator/${c.handle}`}
            className="font-handle text-xs text-foreground hover:text-primary truncate block"
          >
            @{c.handle}
          </Link>
          {c.display_name && (
            <p className="text-[10px] text-muted-foreground truncate">
              {c.display_name}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {c.followers != null && (
            <span>{formatFollowers(c.followers)}</span>
          )}
          {c.tier && (
            <Badge
              variant="secondary"
              className="capitalize text-[9px] px-1 py-0"
            >
              {c.tier}
            </Badge>
          )}
        </div>
        {cc.match_score_at_assignment != null && (
          <span className="font-medium text-foreground">
            {cc.match_score_at_assignment}% match
          </span>
        )}
      </div>

      {/* Rate + actions row */}
      <div className="flex items-center justify-between">
        <InlineRateEditor
          value={cc.agreed_rate}
          currency={currency}
          onSave={(val) => onSaveRate(cc.id, val)}
        />
        <div className="flex items-center gap-1">
          {isGiftable && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onGift(cc)}
              className="size-6"
            >
              <Gift className="size-3" />
            </Button>
          )}
          <CreatorStatusDropdown
            campaignCreatorId={cc.id}
            currentStatus={cc.status}
          />
        </div>
      </div>
    </div>
  );
}
