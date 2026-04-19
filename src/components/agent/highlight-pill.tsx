"use client";

import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  Users,
  UserCircle,
  Target,
  Mail,
  Clock,
  Gauge,
  Handshake,
  FileText,
  Wallet,
  TrendingUp,
  Eye,
  Heart,
  Sparkles,
} from "lucide-react";
import type { HighlightKind } from "@/lib/agent/highlights";
import { useHighlightFocus } from "./highlight-focus-context";

const KIND_ICON: Record<HighlightKind, LucideIcon> = {
  creators_found: Users,
  creator_profile: UserCircle,
  campaign_created: Target,
  campaign_overview: Target,
  outreach_drafted: Mail,
  approval_pending: Clock,
  rate_benchmark: Gauge,
  negotiation: Handshake,
  deal_memo: FileText,
  budget: Wallet,
  roi: TrendingUp,
  content_tracked: Eye,
  brief_generated: FileText,
  relationship_insight: Heart,
  generic: Sparkles,
};

const KIND_LABEL: Record<string, string> = {
  creators_found: "Creator list",
  creator_profile: "Creator profile",
  outreach_drafted: "Email draft",
  rate_benchmark: "Rate benchmark",
  negotiation: "Counter-offer",
  deal_memo: "Deal memo",
  campaign_created: "Campaign spec",
  campaign_overview: "Campaign overview",
  budget: "Budget analysis",
  roi: "ROI report",
  content_tracked: "Content tracker",
  brief_generated: "Brief",
  relationship_insight: "Insight",
  approval_pending: "Approval",
  generic: "Document",
};

interface Props {
  id: string;
  kind: HighlightKind;
  title: string;
  subtitle?: string;
}

/**
 * Artifact reference card used inline in the chat stream.
 * Clicking opens the artifact in the right-side canvas.
 */
export function HighlightPill({ id, kind, title, subtitle }: Props) {
  const { focusHighlight } = useHighlightFocus();
  const Icon = KIND_ICON[kind];
  const kindLabel = KIND_LABEL[kind] ?? "Document";

  return (
    <button
      type="button"
      onClick={() => focusHighlight(id)}
      className="group flex items-center gap-3 text-left transition-all w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-lg"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div
        className="h-9 w-9 rounded-md grid place-items-center shrink-0"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--muted-foreground)",
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </span>
        </div>
        <div
          className="text-[11.5px] font-mono mt-0.5"
          style={{ color: "var(--fg-faint)" }}
        >
          {kindLabel} · open in canvas
        </div>
      </div>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: "var(--fg-faint)" }}
      />
    </button>
  );
}
