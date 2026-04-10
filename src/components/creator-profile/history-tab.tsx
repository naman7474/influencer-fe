"use client";

import { Handshake, CalendarDays } from "lucide-react";

import type { Campaign, CampaignCreator } from "@/lib/types/database";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Prop types                                                         */
/* ------------------------------------------------------------------ */

export interface CollaborationEntry {
  campaign: Campaign;
  assignment: CampaignCreator;
}

export interface HistoryTabProps {
  collaborations: CollaborationEntry[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusBadge(status: string): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  label: string;
} {
  const s = status.toLowerCase();
  if (s === "completed")
    return {
      variant: "secondary",
      className: "badge-active",
      label: "Completed",
    };
  if (s === "active" || s === "confirmed")
    return {
      variant: "default",
      className: "",
      label: s.charAt(0).toUpperCase() + s.slice(1),
    };
  if (s === "pending")
    return {
      variant: "secondary",
      className: "badge-pending",
      label: "Pending",
    };
  if (s === "declined" || s === "cancelled")
    return { variant: "destructive", className: "", label: status };
  return {
    variant: "outline",
    className: "",
    label: status.charAt(0).toUpperCase() + status.slice(1),
  };
}

function formatDateRange(start: string | null, end: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const startStr = start
    ? new Date(start).toLocaleDateString("en-IN", opts)
    : "TBD";
  const endStr = end
    ? new Date(end).toLocaleDateString("en-IN", opts)
    : "Ongoing";
  return `${startStr} - ${endStr}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HistoryTab({ collaborations }: HistoryTabProps) {
  if (collaborations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Handshake className="mb-3 size-10 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">
          No previous collaborations
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This creator has not been part of any campaigns with your brand yet.
          Add them to a campaign to start collaborating.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {collaborations.map(({ campaign, assignment }) => {
        const statusBadge = getStatusBadge(assignment.status);

        return (
          <Card key={assignment.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="truncate">{campaign.name}</span>
                <Badge
                  variant={statusBadge.variant}
                  className={statusBadge.className}
                >
                  {statusBadge.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {/* Dates */}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {formatDateRange(campaign.start_date, campaign.end_date)}
                </div>

                {/* Goal */}
                {campaign.goal && (
                  <div className="text-muted-foreground">
                    Goal:{" "}
                    <span className="font-medium text-foreground capitalize">
                      {campaign.goal.replace(/_/g, " ")}
                    </span>
                  </div>
                )}

                {/* Agreed rate */}
                {assignment.agreed_rate != null && (
                  <div className="text-muted-foreground">
                    Rate:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(
                        assignment.agreed_rate,
                        campaign.currency ?? "INR"
                      )}
                    </span>
                  </div>
                )}

                {/* Posts delivered */}
                {assignment.posts_delivered != null &&
                  assignment.posts_delivered > 0 && (
                    <div className="text-muted-foreground">
                      Posts delivered:{" "}
                      <span className="font-medium text-foreground">
                        {assignment.posts_delivered}
                      </span>
                    </div>
                  )}

                {/* Deliverables */}
                {assignment.content_deliverables &&
                  assignment.content_deliverables.length > 0 && (
                    <div className="flex items-center gap-1">
                      {assignment.content_deliverables.map((d) => (
                        <Badge
                          key={d}
                          variant="secondary"
                          className="text-[11px] font-normal"
                        >
                          {d}
                        </Badge>
                      ))}
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
