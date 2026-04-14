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
import { cn } from "@/lib/utils";

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

const KIND_ACCENT: Record<HighlightKind, string> = {
  creators_found: "text-blue-600 dark:text-blue-400",
  creator_profile: "text-blue-600 dark:text-blue-400",
  campaign_created: "text-rose-600 dark:text-rose-400",
  campaign_overview: "text-rose-600 dark:text-rose-400",
  outreach_drafted: "text-violet-600 dark:text-violet-400",
  approval_pending: "text-amber-600 dark:text-amber-400",
  rate_benchmark: "text-amber-600 dark:text-amber-400",
  negotiation: "text-amber-600 dark:text-amber-400",
  deal_memo: "text-green-600 dark:text-green-400",
  budget: "text-emerald-600 dark:text-emerald-400",
  roi: "text-emerald-600 dark:text-emerald-400",
  content_tracked: "text-cyan-600 dark:text-cyan-400",
  brief_generated: "text-violet-600 dark:text-violet-400",
  relationship_insight: "text-pink-600 dark:text-pink-400",
  generic: "text-muted-foreground",
};

interface Props {
  id: string;
  kind: HighlightKind;
  title: string;
  subtitle?: string;
}

/**
 * Breadcrumb pill used inline in the chat stream to point at a
 * highlight card in the side panel. Clicking scrolls + flashes it.
 */
export function HighlightPill({ id, kind, title, subtitle }: Props) {
  const { focusHighlight } = useHighlightFocus();
  const Icon = KIND_ICON[kind];
  const accent = KIND_ACCENT[kind];

  return (
    <button
      type="button"
      onClick={() => focusHighlight(id)}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-lg border bg-muted/40",
        "px-2.5 py-1.5 text-xs hover:bg-muted hover:border-primary/30 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", accent)} />
      <span className="min-w-0 flex items-baseline gap-1.5">
        <span className="font-medium truncate">{title}</span>
        {subtitle && (
          <span className="text-muted-foreground truncate hidden sm:inline">
            · {subtitle}
          </span>
        )}
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}
