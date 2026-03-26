"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CampaignOption = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

const INACTIVE_STATUSES = new Set(["completed", "cancelled", "archived"]);

export function AddToCampaignDialog({
  open,
  onOpenChange,
  creatorId,
  creatorLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorLabel: string;
}) {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;

    const loadCampaigns = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await fetch("/api/v1/campaigns");
      const payload = await response.json();

      if (!response.ok) {
        if (!isCancelled) {
          setLoadError(payload.error?.message ?? "Unable to load campaigns.");
        }
        setIsLoading(false);
        return;
      }

      const nextCampaigns = (payload.data?.campaigns ?? []) as CampaignOption[];
      if (isCancelled) {
        return;
      }

      setCampaigns(nextCampaigns);
      setIsLoading(false);

      const preferredCampaigns = nextCampaigns.filter(
        (campaign) => !INACTIVE_STATUSES.has(String(campaign.status ?? "").toLowerCase())
      );
      const initialCampaign = preferredCampaigns[0] ?? nextCampaigns[0];
      setSelectedCampaignId(initialCampaign?.id ?? "");
    };

    void loadCampaigns();

    return () => {
      isCancelled = true;
    };
  }, [open]);

  const visibleCampaigns = useMemo(() => {
    const activeCampaigns = campaigns.filter(
      (campaign) => !INACTIVE_STATUSES.has(String(campaign.status ?? "").toLowerCase())
    );
    return activeCampaigns.length > 0 ? activeCampaigns : campaigns;
  }, [campaigns]);

  const handleSubmit = () => {
    if (!selectedCampaignId) {
      toast.error("Choose a campaign first.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/v1/campaigns/${selectedCampaignId}/creators`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creator_id: creatorId,
          status: "shortlisted",
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error?.message ?? "Unable to add creator to campaign.");
        return;
      }

      const selectedCampaign = visibleCampaigns.find(
        (campaign) => campaign.id === selectedCampaignId
      );
      onOpenChange(false);
      toast.success(
        `Added ${creatorLabel} to ${selectedCampaign?.name ?? "campaign"}.`
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add to campaign</DialogTitle>
          <DialogDescription>
            Choose an active campaign for {creatorLabel}.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Loading campaigns...
          </div>
        ) : visibleCampaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No campaigns yet. Create a campaign first, then assign creators from
            here.
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleCampaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedCampaignId(campaign.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selectedCampaignId === campaign.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{campaign.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaign.status ?? "draft"}
                      {campaign.start_date ? ` · Starts ${campaign.start_date}` : ""}
                      {campaign.end_date ? ` · Ends ${campaign.end_date}` : ""}
                    </p>
                  </div>
                  <input
                    type="radio"
                    checked={selectedCampaignId === campaign.id}
                    onChange={() => setSelectedCampaignId(campaign.id)}
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={isPending || isLoading || !visibleCampaigns.length}
          >
            Add creator
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
