"use client";

import Link from "next/link";
import { Target, Megaphone, Video, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Campaign } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CampaignCardProps {
  campaign: Campaign;
  creatorCount?: number;
  statusCounts?: Record<string, number>;
  avatars?: { handle: string; avatar_url: string | null }[];
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "badge-active";
  if (s === "draft") return "badge-draft";
  if (s === "completed") return "bg-muted text-muted-foreground";
  if (s === "paused") return "bg-warning/10 text-warning";
  return "badge-draft";
}

function statusBorderClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "before:bg-success";
  if (s === "paused") return "before:bg-warning";
  if (s === "completed") return "before:bg-muted-foreground/60";
  return "before:bg-border"; // draft
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
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CampaignCard({
  campaign,
  creatorCount = 0,
  statusCounts = {},
  avatars = [],
}: CampaignCardProps) {
  const confirmed =
    (statusCounts["confirmed"] ?? 0) +
    (statusCounts["content_live"] ?? 0) +
    (statusCounts["completed"] ?? 0);

  const progressPct =
    creatorCount > 0 ? Math.round((confirmed / creatorCount) * 100) : 0;

  const goalMeta = GOAL_META[campaign.goal ?? ""] ?? null;

  const dateRange = [
    formatDateCompact(campaign.start_date),
    formatDateCompact(campaign.end_date),
  ]
    .filter(Boolean)
    .join(" – ");

  const VISIBLE_AVATARS = 4;
  const visible = avatars.slice(0, VISIBLE_AVATARS);
  const overflow = Math.max(0, creatorCount - visible.length);

  return (
    <Link href={`/campaigns/${campaign.id}`} className="block">
      <Card
        size="sm"
        className={cn(
          "group/campaign-card relative cursor-pointer transition-all duration-200",
          // Left status rail (always on), flips to primary on hover
          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-l-xl before:transition-colors",
          statusBorderClass(campaign.status),
          "hover:before:bg-primary hover:shadow-md hover:-translate-y-0.5",
        )}
      >
        <CardContent className="space-y-3">
          {/* Row 1: Name + description  ·  Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
                {campaign.name}
              </h3>
              {campaign.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {campaign.description}
                </p>
              )}
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "shrink-0 capitalize",
                statusBadgeClass(campaign.status),
              )}
            >
              {campaign.status}
            </Badge>
          </div>

          {/* Row 2: Goal badge + date range */}
          <div className="flex flex-wrap items-center gap-2">
            {goalMeta && (
              <Badge
                variant="secondary"
                className={cn("gap-1 text-[10px]", goalMeta.cls)}
              >
                <goalMeta.icon className="size-3" />
                {goalMeta.label}
              </Badge>
            )}
            {dateRange && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3" />
                {dateRange}
              </span>
            )}
          </div>

          {/* Row 3: Progress */}
          {creatorCount > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">
                    {confirmed}
                  </span>{" "}
                  / {creatorCount} confirmed
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    progressPct === 100 ? "bg-success" : "bg-primary",
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="py-0.5 text-[11px] text-muted-foreground">
              No creators added yet
            </p>
          )}

          {/* Row 4: Budget  ·  Avatar stack */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-xs font-semibold",
                campaign.total_budget != null
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {campaign.total_budget != null
                ? formatCurrency(
                    campaign.total_budget,
                    campaign.currency ?? "INR",
                  )
                : "No budget"}
            </span>
            {visible.length > 0 && (
              <div className="flex items-center">
                <div className="flex -space-x-1.5">
                  {visible.map((a) => (
                    <Avatar
                      key={a.handle}
                      className="size-6 ring-2 ring-card"
                      title={`@${a.handle}`}
                    >
                      {a.avatar_url && (
                        <AvatarImage src={a.avatar_url} alt={a.handle} />
                      )}
                      <AvatarFallback className="text-[9px] font-medium">
                        {a.handle.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                {overflow > 0 && (
                  <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                    +{overflow}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
