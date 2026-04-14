"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  X,
  Sparkles,
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
  type LucideIcon,
} from "lucide-react";
import type { Highlight, HighlightKind } from "@/lib/agent/highlights";
import { useHighlightFocus } from "./highlight-focus-context";
import {
  CreatorSearchCard,
  RateBenchmarkCard,
  BudgetCard,
  DealMemoCard,
  ROICard,
  CampaignOverviewCard,
  ContentTrackerCard,
} from "./tool-cards";
import { NegotiationCard } from "./negotiation-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Check, ExternalLink, Loader2 } from "lucide-react";

/* ── icon + color per kind (matches HighlightPill) ──────── */

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
  creators_found: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/40",
  creator_profile: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/40",
  campaign_created: "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/40",
  campaign_overview: "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/40",
  outreach_drafted: "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-950/40",
  approval_pending: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40",
  rate_benchmark: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40",
  negotiation: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40",
  deal_memo: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/40",
  budget: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40",
  roi: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40",
  content_tracked: "text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-950/40",
  brief_generated: "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-950/40",
  relationship_insight: "text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-950/40",
  generic: "text-muted-foreground bg-muted",
};

/* ── Detail renderer dispatcher ─────────────────────────── */

function HighlightDetail({ highlight }: { highlight: Highlight }) {
  const out = highlight.toolOutput;

  // If the tool returned an error, show it immediately regardless of kind.
  // This catches cases where e.g. outreach_drafter returns { error: "..." }
  // without draft_id, and the kind-specific guard would skip rendering.
  if (typeof out.error === "string") {
    return <ToolErrorDetail error={out.error} toolName={highlight.toolName} />;
  }

  switch (highlight.kind) {
    case "creators_found":
      if (out.results) return <CreatorSearchCard result={out} compact={false} />;
      break;
    case "creator_profile":
      return <CreatorProfileDetail output={out} />;
    case "campaign_created":
      return <CampaignCreatedDetail output={out} />;
    case "campaign_overview":
      if (out.campaigns)
        return <CampaignOverviewCard result={out} compact={false} />;
      break;
    case "outreach_drafted":
      if (out.draft_id) return <OutreachDraftDetail output={out} />;
      break;
    case "approval_pending":
      return <ApprovalActionDetail output={out} />;
    case "rate_benchmark":
      if (out.market_rate) return <RateBenchmarkCard result={out} />;
      break;
    case "negotiation":
      if (out.negotiation)
        return <NegotiationCard data={out as never} />;
      break;
    case "deal_memo":
      if (out.deal_memo) return <DealMemoCard result={out} />;
      break;
    case "budget":
      if (out.budget_summary) return <BudgetCard result={out} />;
      break;
    case "roi":
      if (out.kpis) return <ROICard result={out} />;
      break;
    case "content_tracked":
      if (out.posts)
        return <ContentTrackerCard result={out} compact={false} />;
      break;
    case "brief_generated":
      return <BriefDetail output={out} />;
    case "relationship_insight":
      return <RelationshipDetail output={out} />;
    case "generic":
    default:
      break;
  }
  // Fallback — dump message text if present
  const msg =
    typeof out.message === "string" ? out.message : null;
  if (msg) {
    return (
      <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
        {msg}
      </div>
    );
  }
  return null;
}

/* ── Tool error display ────────────────────────────────────── */

function ToolErrorDetail({
  error,
  toolName,
}: {
  error: string;
  toolName: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3 text-xs space-y-1">
      <p className="font-semibold text-red-700 dark:text-red-400">
        {toolName.replace(/_/g, " ")} failed
      </p>
      <p className="text-red-600/80 dark:text-red-400/80 leading-relaxed">
        {error}
      </p>
    </div>
  );
}

/* ── Approval action card with inline approve + deep-link ── */

function ApprovalActionDetail({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const approvalId =
    typeof output.approval_id === "string" ? output.approval_id : null;
  const message =
    typeof output.message === "string"
      ? output.message
      : "Awaiting your approval";
  const actionType =
    typeof output.action_type === "string" ? output.action_type : null;

  const [state, setState] = useState<
    "idle" | "approving" | "approved" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onApprove = async () => {
    if (!approvalId || state === "approving" || state === "approved") return;
    setState("approving");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/agent/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      setState("approved");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to approve");
      setState("error");
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 text-xs space-y-2">
      <div>
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          Awaiting your approval
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {message}
          {actionType && (
            <>
              {" "}
              <span className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-px font-mono text-[10px] uppercase tracking-wide">
                {actionType.replace(/_/g, " ")}
              </span>
            </>
          )}
        </p>
      </div>
      {state === "error" && errorMsg && (
        <p className="text-[11px] text-red-600 dark:text-red-400">
          {errorMsg}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white"
          onClick={onApprove}
          disabled={!approvalId || state === "approving" || state === "approved"}
        >
          {state === "approving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Approving…
            </>
          ) : state === "approved" ? (
            <>
              <Check className="h-3 w-3" /> Approved
            </>
          ) : (
            <>
              <Check className="h-3 w-3" /> Approve
            </>
          )}
        </Button>
        <Link
          href={approvalId ? `/approvals?id=${approvalId}` : "/approvals"}
          className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-400 hover:bg-background transition-colors"
        >
          View in Approvals
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/* ── Outreach draft with approve & send ─────────────────── */

function OutreachDraftDetail({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const draftId =
    typeof output.draft_id === "string" ? output.draft_id : null;
  const handle =
    typeof output.creator_handle === "string"
      ? output.creator_handle
      : typeof output.handle === "string"
        ? output.handle
        : null;
  const email =
    typeof output.creator_email === "string" ? output.creator_email : null;
  const subject =
    typeof output.subject === "string" ? output.subject : null;
  const body =
    typeof output.body === "string" ? output.body : null;

  const [state, setState] = useState<
    "draft" | "sending" | "sent" | "error"
  >("draft");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onApproveAndSend = async () => {
    if (!draftId || state === "sending" || state === "sent") return;
    setState("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/agent/outreach/approve-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_id: draftId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      setState("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
      setState("error");
    }
  };

  return (
    <div className="rounded-lg border bg-background p-3 text-xs space-y-2">
      <div className="space-y-1">
        {handle && (
          <p className="text-muted-foreground">
            To: <span className="font-mono font-medium text-foreground">@{handle}</span>
            {email && <span className="ml-1 text-muted-foreground">({email})</span>}
          </p>
        )}
        {subject && <p className="font-semibold">{subject}</p>}
        {body && (
          <p className="text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
            {body.substring(0, 300)}
            {body.length > 300 && "…"}
          </p>
        )}
      </div>
      {state === "error" && errorMsg && (
        <p className="text-[11px] text-red-600 dark:text-red-400">
          {errorMsg}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={onApproveAndSend}
          disabled={!draftId || state === "sending" || state === "sent"}
        >
          {state === "sending" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Sending…
            </>
          ) : state === "sent" ? (
            <>
              <Check className="h-3 w-3" /> Sent
            </>
          ) : (
            <>
              <Mail className="h-3 w-3" /> Approve & Send
            </>
          )}
        </Button>
        <Link
          href="/outreach"
          className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
        >
          View in Outreach
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/* ── Lightweight extra detail cards (new) ───────────────── */

function CreatorProfileDetail({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const creator =
    (output.creator as Record<string, unknown>) ?? output;
  const handle = String(creator.handle ?? "");
  const name = creator.display_name ? String(creator.display_name) : null;
  const tier = creator.tier ? String(creator.tier) : null;
  const followers =
    typeof creator.followers === "number"
      ? (creator.followers as number)
      : null;
  const niche = creator.niche ? String(creator.niche) : null;
  const bio = creator.bio ? String(creator.bio) : null;
  return (
    <div className="rounded-lg border bg-background p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {handle[0]?.toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="font-mono font-semibold truncate">@{handle}</p>
          {name && (
            <p className="text-[11px] text-muted-foreground truncate">{name}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-muted-foreground">
        {tier && (
          <span className="rounded-full bg-muted px-2 py-0.5">{tier}</span>
        )}
        {followers != null && (
          <span>{(followers / 1000).toFixed(1)}K followers</span>
        )}
        {niche && <span>· {niche}</span>}
      </div>
      {bio && <p className="text-muted-foreground leading-relaxed">{bio}</p>}
    </div>
  );
}

function CampaignCreatedDetail({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const campaign =
    (output.campaign as Record<string, unknown>) ?? output;
  const name = String(campaign.name ?? output.name ?? "Untitled");
  const goal = campaign.goal ? String(campaign.goal) : null;
  const budget =
    typeof campaign.total_budget === "number"
      ? (campaign.total_budget as number)
      : typeof output.total_budget === "number"
        ? (output.total_budget as number)
        : null;
  const status = String(campaign.status ?? output.status ?? "draft");
  return (
    <div className="rounded-lg border bg-background p-3 text-xs space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm truncate">{name}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">
          {status}
        </span>
      </div>
      {goal && (
        <p className="text-muted-foreground leading-relaxed">{goal}</p>
      )}
      {budget != null && (
        <p>
          <span className="text-muted-foreground">Budget: </span>
          <span className="font-medium">
            {"\u20B9"}
            {budget.toLocaleString("en-IN")}
          </span>
        </p>
      )}
    </div>
  );
}

function BriefDetail({ output }: { output: Record<string, unknown> }) {
  const title = output.title ? String(output.title) : "Campaign brief";
  const body =
    (output.brief as string | undefined) ??
    (output.body as string | undefined) ??
    (output.content as string | undefined);
  return (
    <div className="rounded-lg border bg-background p-3 text-xs space-y-1.5">
      <p className="font-semibold">{title}</p>
      {body && (
        <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
          {body.length > 400 ? `${body.slice(0, 400)}…` : body}
        </p>
      )}
    </div>
  );
}

function RelationshipDetail({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const items =
    (output.creators as Array<Record<string, unknown>> | undefined) ??
    (output.candidates as Array<Record<string, unknown>> | undefined);
  if (!items || items.length === 0) {
    const msg = output.message ? String(output.message) : null;
    return (
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        {msg ?? "No insights to display"}
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-background p-3 text-xs">
      <div className="space-y-1.5">
        {items.slice(0, 8).map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b pb-1.5 last:border-0 last:pb-0"
          >
            <span className="font-mono truncate">
              @{String(item.handle ?? "unknown")}
            </span>
            <span className="text-muted-foreground shrink-0">
              {item.score != null
                ? `score ${Number(item.score).toFixed(1)}`
                : item.risk != null
                  ? `risk ${String(item.risk)}`
                  : ""}
            </span>
          </div>
        ))}
      </div>
      {items.length > 8 && (
        <p className="mt-2 text-center text-muted-foreground">
          +{items.length - 8} more
        </p>
      )}
    </div>
  );
}

/* ── Single highlight card ──────────────────────────────── */

interface CardProps {
  highlight: Highlight;
  pinned: boolean;
  onTogglePin: () => void;
  onDismiss: () => void;
  /** non-null while this card should flash (focused) */
  flashing: boolean;
}

function HighlightCard({
  highlight,
  pinned,
  onTogglePin,
  onDismiss,
  flashing,
}: CardProps) {
  // `userCollapsed` is user-toggled state; flashing forces the card open
  // so the focused highlight is always visible when scrolled to.
  const [userCollapsed, setUserCollapsed] = useState(false);
  const expanded = flashing ? true : !userCollapsed;
  const cardRef = useRef<HTMLDivElement>(null);
  const Icon = KIND_ICON[highlight.kind];
  const accent = KIND_ACCENT[highlight.kind];

  useEffect(() => {
    if (flashing && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [flashing]);

  return (
    <div
      ref={cardRef}
      id={`highlight-${highlight.id}`}
      className={cn(
        "group rounded-lg border bg-card transition-all",
        flashing && "ring-2 ring-primary/50 shadow-md"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={() => setUserCollapsed((c) => !c)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <div
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              accent
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight truncate">
              {highlight.title}
            </p>
            {highlight.subtitle && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {highlight.subtitle}
              </p>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={pinned ? "Unpin" : "Pin"}
          >
            {pinned ? (
              <PinOff className="h-3 w-3" />
            ) : (
              <Pin className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Detail */}
      {expanded && (
        <div className="border-t bg-muted/20 px-2.5 pb-2.5 pt-2">
          <HighlightDetail highlight={highlight} />
        </div>
      )}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────── */

interface PanelProps {
  highlights: Highlight[];
  /** header close button — hides panel (parent controls open state) */
  onClose?: () => void;
  /** optional extra header content (e.g., label in mobile sheet) */
  header?: ReactNode;
}

export function HighlightsPanel({ highlights, onClose, header }: PanelProps) {
  const { focusId, clearFocus } = useHighlightFocus();
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Clear focus after a short flash
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => clearFocus(), 1400);
    return () => clearTimeout(t);
  }, [focusId, clearFocus]);

  // Build final ordered list: pinned first (newest within pinned first),
  // then rest in original order (newest first, as returned by extractHighlights).
  const ordered = useMemo(() => {
    const visible = highlights.filter((h) => !dismissed.has(h.id));
    const pinnedItems = visible.filter((h) => pinned.has(h.id));
    const rest = visible.filter((h) => !pinned.has(h.id));
    return [...pinnedItems, ...rest];
  }, [highlights, pinned, dismissed]);

  const togglePin = (id: string) =>
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dismiss = (id: string) =>
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background/80 backdrop-blur-sm px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <h2 className="text-xs font-semibold truncate">
            {header ?? "Actions"}
          </h2>
          {ordered.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {ordered.length}
            </span>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
            title="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {ordered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground px-6">
            <Sparkles className="h-8 w-8 opacity-20" />
            <p className="text-xs font-medium">No actions yet</p>
            <p className="text-[11px] leading-relaxed max-w-[240px]">
              As the agent works, actions it takes (creators, campaigns,
              drafts, deals) will appear here for you to review.
            </p>
          </div>
        ) : (
          ordered.map((h) => (
            <HighlightCard
              key={h.id}
              highlight={h}
              pinned={pinned.has(h.id)}
              onTogglePin={() => togglePin(h.id)}
              onDismiss={() => dismiss(h.id)}
              flashing={focusId === h.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
