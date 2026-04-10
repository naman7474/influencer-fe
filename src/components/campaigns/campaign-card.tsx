"use client";

import Link from "next/link";
import { Calendar, Target, DollarSign, Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Campaign } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CampaignCardProps {
  campaign: Campaign;
  creatorCount?: number;
  statusCounts?: Record<string, number>;
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CampaignCard({
  campaign,
  creatorCount = 0,
  statusCounts = {},
}: CampaignCardProps) {
  const shortlisted = statusCounts["shortlisted"] ?? 0;
  const confirmed =
    (statusCounts["confirmed"] ?? 0) +
    (statusCounts["content_live"] ?? 0) +
    (statusCounts["completed"] ?? 0);
  const live = statusCounts["content_live"] ?? 0;

  return (
    <Card
      className={cn(
        "group/campaign-card border-l-3 border-l-transparent transition-all duration-200",
        "hover:border-l-primary hover:shadow-md",
      )}
    >
      <CardContent className="space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {campaign.name}
            </h3>
            {campaign.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {campaign.description}
              </p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn("shrink-0 capitalize", statusBadgeClass(campaign.status))}
          >
            {campaign.status}
          </Badge>
        </div>

        {/* Goal + Dates */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Target className="size-3.5" />
            {goalLabel(campaign.goal)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(campaign.start_date)}
            {campaign.end_date ? ` - ${formatDate(campaign.end_date)}` : ""}
          </span>
        </div>

        {/* Budget + Creators */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {campaign.total_budget != null && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <DollarSign className="size-3.5" />
              <span className="font-semibold text-foreground">
                {formatCurrency(campaign.total_budget, campaign.currency ?? "INR")}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="size-3.5" />
            <span className="font-semibold text-foreground">
              {creatorCount}
            </span>{" "}
            creators
          </span>
        </div>

        {/* Status breakdown */}
        {creatorCount > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {shortlisted > 0 && (
              <span>
                {shortlisted} shortlisted
              </span>
            )}
            {confirmed > 0 && (
              <span className="text-success">
                {confirmed} confirmed
              </span>
            )}
            {live > 0 && (
              <span className="text-info">
                {live} live
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/campaigns/${campaign.id}`} />}
        >
          View Campaign
          <ArrowRight className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
