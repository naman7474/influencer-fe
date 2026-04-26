"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  getCampaigns,
  addCreatorToCampaign,
} from "@/lib/queries/campaigns";
import type { Campaign } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AddToCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorHandle: string;
  matchScore?: number | null;
}

export function AddToCampaignDialog({
  open,
  onOpenChange,
  creatorId,
  creatorHandle,
  matchScore,
}: AddToCampaignDialogProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const [campaigns, setCampaigns] = React.useState<Campaign[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set());

  // Fetch campaigns when the dialog opens; reset state when it closes.
  React.useEffect(() => {
    if (!open) {
      setAddedIds(new Set());
      setPendingId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setCampaigns([]);
          return;
        }
        const { data: brandRow } = await supabase
          .from("brands")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();
        const brandId = (brandRow as { id: string } | null)?.id;
        if (!brandId) {
          if (!cancelled) setCampaigns([]);
          return;
        }
        const list = await getCampaigns(supabase, brandId);
        if (!cancelled) setCampaigns(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  const handlePick = async (campaignId: string, campaignName: string) => {
    setPendingId(campaignId);
    try {
      await addCreatorToCampaign(
        supabase,
        campaignId,
        creatorId,
        matchScore ?? null,
      );
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.add(campaignId);
        return next;
      });
      toast.success(`Added @${creatorHandle} to ${campaignName}`);
    } catch (err) {
      console.error("addCreatorToCampaign failed:", err);
      toast.error("Couldn't add creator. Please try again.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Add @{creatorHandle} to a campaign
          </DialogTitle>
          <DialogDescription>
            Pick one of your campaigns to shortlist this creator.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading campaigns…
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto pr-1">
              {campaigns.map((c) => {
                const added = addedIds.has(c.id);
                const pending = pendingId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={added || pending}
                      onClick={() => handlePick(c.id, c.name)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors",
                        "hover:border-canva-purple/40 hover:bg-canva-purple-soft",
                        added && "cursor-default border-canva-purple bg-canva-purple-soft",
                        pending && "cursor-wait opacity-70",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-heading text-sm font-extrabold text-foreground">
                          {c.name}
                        </div>
                        <div className="text-[11px] capitalize text-muted-foreground">
                          {c.status}
                          {c.goal ? ` · ${c.goal}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0">
                        {added ? (
                          <Check className="size-4 text-canva-purple" />
                        ) : pending ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Plus className="size-4 text-canva-purple" />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-canva-purple-soft/40 px-4 py-8 text-center">
              <div className="font-heading text-sm font-extrabold text-foreground">
                No campaigns yet
              </div>
              <p className="max-w-xs text-xs text-muted-foreground">
                Create a campaign first, then come back to shortlist this creator.
              </p>
              <Button
                size="sm"
                render={<Link href="/campaigns/new" />}
                className="mt-1"
              >
                <Plus className="size-3.5" />
                Create a campaign
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
