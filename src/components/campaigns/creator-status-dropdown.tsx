"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateCampaignCreatorStatus } from "@/lib/queries/campaigns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS = [
  { value: "shortlisted", label: "Shortlisted", color: "text-muted-foreground" },
  { value: "outreach_sent", label: "Outreach Sent", color: "text-info" },
  { value: "negotiating", label: "Negotiating", color: "text-warning" },
  { value: "confirmed", label: "Confirmed", color: "text-success" },
  { value: "content_live", label: "Content Live", color: "text-primary" },
  { value: "completed", label: "Completed", color: "text-success" },
  { value: "declined", label: "Declined", color: "text-destructive" },
] as const;

function getStatusOption(value: string) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];
}

interface CreatorStatusDropdownProps {
  campaignCreatorId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CreatorStatusDropdown({
  campaignCreatorId,
  currentStatus,
  onStatusChange,
}: CreatorStatusDropdownProps) {
  const supabase = createClient();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  const current = getStatusOption(status);

  async function handleChange(newStatus: string) {
    if (newStatus === status) return;
    setSaving(true);
    try {
      await updateCampaignCreatorStatus(supabase, campaignCreatorId, newStatus);
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="xs" disabled={saving} />}
      >
        {saving ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <>
            <span className={cn("capitalize", current.color)}>
              {current.label}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={cn(
              opt.value === status && "bg-accent font-medium",
            )}
          >
            <span className={cn("capitalize", opt.color)}>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
