"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaigns/campaign-card";
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
    { count: number; statusCounts: Record<string, number> }
  >;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CampaignsPageClient({
  brandId,
  initialCampaigns,
  campaignMeta,
}: CampaignsPageClientProps) {
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered =
    statusFilter === "all"
      ? initialCampaigns
      : initialCampaigns.filter((c) => c.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
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

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.value === "all" && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({initialCampaigns.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <Megaphone className="mb-4 size-12 text-muted-foreground/50" />
          {statusFilter === "all" ? (
            <>
              <p className="text-base font-medium text-foreground">
                Create your first campaign
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Set up an influencer campaign to manage creator outreach,
                track progress, and measure results.
              </p>
              <Button className="mt-4" render={<Link href="/campaigns/new" />}>
                <Plus className="size-4" />
                Create Campaign
              </Button>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-foreground">
                No {statusFilter} campaigns
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                No campaigns match the selected filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((campaign) => {
            const meta = campaignMeta[campaign.id];
            return (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                creatorCount={meta?.count ?? 0}
                statusCounts={meta?.statusCounts ?? {}}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
