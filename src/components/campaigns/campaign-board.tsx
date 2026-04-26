"use client";

import * as React from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatFollowers } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  updateCampaignCreatorStatus,
  type CampaignCreatorWithDetails,
} from "@/lib/queries/campaigns";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Stage {
  key: string;
  label: string;
  description: string;
  dot: string;
}

const STAGES: Stage[] = [
  {
    key: "shortlisted",
    label: "Shortlisted",
    description: "Identified · awaiting outreach",
    dot: "bg-muted-foreground/50",
  },
  {
    key: "outreach_sent",
    label: "Outreach sent",
    description: "Email/DM out · waiting on reply",
    dot: "bg-info",
  },
  {
    key: "negotiating",
    label: "Negotiating",
    description: "Mid-discussion on rate or scope",
    dot: "bg-warning",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    description: "Booked · tracking link generated",
    dot: "bg-success",
  },
  {
    key: "content_live",
    label: "Content live",
    description: "Post is up · pending review",
    dot: "bg-canva-purple",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Approved & paid",
    dot: "bg-success/70",
  },
  {
    key: "declined",
    label: "Declined",
    description: "Won't move forward",
    dot: "bg-destructive/60",
  },
];

interface CampaignBoardProps {
  campaignId: string;
  creators: CampaignCreatorWithDetails[];
  onCreatorsChange: (next: CampaignCreatorWithDetails[]) => void;
  onCreatorClick: (cc: CampaignCreatorWithDetails) => void;
  onGift?: (cc: CampaignCreatorWithDetails) => void;
}

export function CampaignBoard({
  campaignId,
  creators,
  onCreatorsChange,
  onCreatorClick,
  onGift,
}: CampaignBoardProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map = new Map<string, CampaignCreatorWithDetails[]>();
    for (const cc of creators) {
      const list = map.get(cc.status) ?? [];
      list.push(cc);
      map.set(cc.status, list);
    }
    return map;
  }, [creators]);

  const moveStatus = async (ccId: string, nextStatus: string) => {
    const cc = creators.find((c) => c.id === ccId);
    if (!cc || cc.status === nextStatus) return;
    const optimistic = creators.map((c) =>
      c.id === ccId
        ? {
            ...c,
            status: nextStatus,
            confirmed_at:
              nextStatus === "confirmed" && !c.confirmed_at
                ? new Date().toISOString()
                : c.confirmed_at,
            completed_at:
              nextStatus === "completed" && !c.completed_at
                ? new Date().toISOString()
                : c.completed_at,
          }
        : c,
    );
    onCreatorsChange(optimistic);
    try {
      await updateCampaignCreatorStatus(supabase, ccId, nextStatus);
      // Trigger tracking-link generation in the background when moving to confirmed.
      if (nextStatus === "confirmed") {
        try {
          await fetch(
            `/api/campaigns/${campaignId}/creators/${cc.creator_id}/tracking-link`,
            { method: "POST" },
          );
        } catch (err) {
          console.error("auto tracking-link:", err);
        }
      }
      const stage = STAGES.find((s) => s.key === nextStatus);
      toast.success(`Moved to ${stage?.label ?? nextStatus}`);
    } catch (err) {
      console.error("status move:", err);
      toast.error("Couldn't update status");
      onCreatorsChange(creators);
    }
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4 min-w-max">
        {STAGES.map((stage) => {
          const items = grouped.get(stage.key) ?? [];
          const isDropTarget = dragOverStage === stage.key && draggingId != null;
          return (
            <div
              key={stage.key}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverStage !== stage.key) setDragOverStage(stage.key);
              }}
              onDragLeave={() => {
                if (dragOverStage === stage.key) setDragOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/cc-id");
                setDragOverStage(null);
                setDraggingId(null);
                if (id) moveStatus(id, stage.key);
              }}
              className={cn(
                "w-[280px] shrink-0 rounded-2xl border bg-muted/30 transition-colors",
                isDropTarget && "border-canva-purple bg-canva-purple-soft",
              )}
            >
              <header className="flex items-start gap-2 px-4 py-3 border-b border-border">
                <span className={cn("mt-1 size-2 rounded-full", stage.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-extrabold text-foreground">
                      {stage.label}
                    </span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    {stage.description}
                  </div>
                </div>
              </header>

              <div className="flex flex-col gap-2 p-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-border text-[10px] text-muted-foreground">
                    Drop here
                  </div>
                ) : (
                  items.map((cc) => (
                    <BoardCard
                      key={cc.id}
                      cc={cc}
                      dragging={draggingId === cc.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/cc-id", cc.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(cc.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStage(null);
                      }}
                      onClick={() => onCreatorClick(cc)}
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

interface BoardCardProps {
  cc: CampaignCreatorWithDetails;
  dragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onGift?: (cc: CampaignCreatorWithDetails) => void;
}

const CONTENT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "bg-info/15 text-info" },
  approved: { label: "Approved", cls: "bg-success/15 text-success" },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
  revision_requested: { label: "Revision", cls: "bg-warning/15 text-warning" },
};

function BoardCard({ cc, dragging, onDragStart, onDragEnd, onClick, onGift }: BoardCardProps) {
  const c = cc.creator;
  const isGiftable = ["confirmed", "content_live", "completed"].includes(cc.status);
  const contentBadge =
    cc.status === "content_live" || cc.status === "completed"
      ? CONTENT_STATUS_BADGE["approved"]
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-2.5 text-left shadow-sm transition-all",
        "hover:border-canva-purple/40 hover:shadow-[0_4px_12px_rgba(125,42,232,0.10)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canva-purple",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="size-7 shrink-0">
          {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.handle} />}
          <AvatarFallback className="bg-canva-purple-soft text-[9px] text-canva-purple">
            {c.handle.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-handle truncate text-xs text-foreground">
            @{c.handle}
          </div>
          {c.display_name && (
            <div className="truncate text-[10px] text-muted-foreground">
              {c.display_name}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {c.followers != null && <span>{formatFollowers(c.followers)}</span>}
          {c.tier && (
            <span className="rounded-full bg-muted px-1.5 py-0 capitalize">
              {c.tier}
            </span>
          )}
        </div>
        {cc.match_score_at_assignment != null && (
          <span className="font-bold text-foreground">
            {Math.round(cc.match_score_at_assignment)}%
          </span>
        )}
      </div>

      {(contentBadge || cc.agreed_rate != null || isGiftable) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {contentBadge && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  contentBadge.cls,
                )}
              >
                {contentBadge.label}
              </span>
            )}
            {cc.agreed_rate != null && (
              <span className="text-[10px] text-foreground">
                ₹{cc.agreed_rate.toLocaleString()}
              </span>
            )}
          </div>
          {isGiftable && onGift && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Send gift"
              onClick={(e) => {
                e.stopPropagation();
                onGift(cc);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onGift(cc);
                }
              }}
              className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-canva-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canva-purple"
            >
              <Gift className="size-3" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
