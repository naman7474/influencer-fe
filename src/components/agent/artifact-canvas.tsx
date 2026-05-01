"use client";

import type { LucideIcon } from "lucide-react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  X,
  Mail,
  Plus,
  Megaphone,
  Users,
  UserCircle,
  Target,
  Gauge,
  Handshake,
  FileText,
  Wallet,
  TrendingUp,
  Eye,
  Heart,
  Sparkles,
  Clock,
  Edit3,
} from "lucide-react";
import { useState, useCallback } from "react";
import type { Highlight, HighlightKind } from "@/lib/agent/highlights";
import { ToolResultCard } from "@/components/agent/tool-cards";

/* ── Approval helper ──────────────────────────────────── */

type ApprovalAction = "approve" | "reject";
type ApprovalStatus = "idle" | "loading" | "approved" | "rejected" | "error";

async function submitApproval(
  approvalId: string,
  action: ApprovalAction,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/agent/approvals/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error || "Request failed" };
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

function useApprovalAction(approvalId?: string) {
  const [status, setStatus] = useState<ApprovalStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleAction = useCallback(
    async (action: ApprovalAction, reason?: string) => {
      if (!approvalId || status === "loading") return;
      setStatus("loading");
      setError(null);
      const result = await submitApproval(approvalId, action, reason);
      if (result.success) {
        setStatus(action === "approve" ? "approved" : "rejected");
      } else {
        setError(result.error || "Failed");
        setStatus("error");
      }
    },
    [approvalId, status]
  );

  return { status, error, handleAction };
}

/* ── Kind → icon ───────────────────────────────────────── */

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
  creators_found: "shortlist",
  creator_profile: "profile",
  outreach_drafted: "email",
  rate_benchmark: "rates",
  negotiation: "deal",
  deal_memo: "deal",
  campaign_created: "campaign",
  campaign_overview: "campaign",
  budget: "budget",
  roi: "roi",
  content_tracked: "content",
  brief_generated: "brief",
  relationship_insight: "insight",
  approval_pending: "approval",
  generic: "document",
};

/* ── Props ─────────────────────────────────────────────── */

interface ArtifactCanvasProps {
  highlight: Highlight;
  onClose: () => void;
  onSend?: (text: string) => void;
}

/* ── Main component ────────────────────────────────────── */

// Map approval_pending back to the original tool's icon/label for richer headers
const TOOL_TO_KIND_OVERRIDE: Record<string, { icon: LucideIcon; label: string }> = {
  campaign_builder: { icon: Target, label: "campaign" },
  propose_outreach: { icon: Mail, label: "email" },
  outreach_drafter: { icon: Mail, label: "email" },
};

export function ArtifactCanvas({ highlight, onClose, onSend }: ArtifactCanvasProps) {
  const override =
    highlight.kind === "approval_pending"
      ? TOOL_TO_KIND_OVERRIDE[highlight.toolName]
      : undefined;
  const Icon = override?.icon ?? KIND_ICON[highlight.kind] ?? Sparkles;
  const kindLabel = override?.label ?? KIND_LABEL[highlight.kind] ?? "document";

  return (
    <div
      className="canvas-enter flex flex-col"
      style={{
        width: "clamp(420px, 48vw, 620px)",
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        background: "var(--card)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 px-3 pt-3 pb-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-center h-8 w-8 rounded-md shrink-0"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <Icon className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2
              className="font-semibold truncate"
              style={{ fontSize: 15, color: "var(--foreground)" }}
            >
              {highlight.title}
            </h2>
            <span
              className="text-[10.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: "var(--surface-2)",
                color: "var(--fg-dim)",
                border: "1px solid var(--border)",
              }}
            >
              {kindLabel}
            </span>
          </div>
          {highlight.subtitle && (
            <p
              className="text-[12px] mt-0.5 truncate"
              style={{ color: "var(--fg-dim)" }}
            >
              {highlight.subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ToolbarBtn title="Copy link">
            <Copy className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Export">
            <Download className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Open full">
            <ExternalLink className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <span
            className="mx-1 h-4 w-px"
            style={{ background: "var(--border)" }}
          />
          <ToolbarBtn title="Close" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto agent-scroll">
        <ArtifactBody highlight={highlight} onSend={onSend} />
      </div>

      {/* Status bar */}
      <div
        className="h-8 px-4 flex items-center gap-2 text-[10.5px] font-mono shrink-0"
        style={{
          borderTop: "1px solid var(--border)",
          color: "var(--fg-faint)",
          background: "var(--surface-2)",
        }}
      >
        <Check className="h-2.5 w-2.5" style={{ color: "var(--success)" }} />
        <span>saved · edits sync to chat</span>
        <div className="flex-1" />
        <span>⌘S save · ⌘⇧E export</span>
      </div>
    </div>
  );
}

/* ── Toolbar button ────────────────────────────────────── */

function ToolbarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 w-7 grid place-items-center rounded-md transition-colors hover:bg-surface-2"
      style={{ color: "var(--fg-dim)" }}
    >
      {children}
    </button>
  );
}

/* ── Body dispatcher ───────────────────────────────────── */

function ArtifactBody({ highlight, onSend }: { highlight: Highlight; onSend?: (text: string) => void }) {
  const out = highlight.toolOutput;
  const approvalId = (out.approval_id ?? out.approval_request_id) as string | undefined;

  // Unwrap nested campaign objects — campaign_builder nests under campaign_preview,
  // get_campaign_info nests under campaign
  const campaignData = (() => {
    const preview = out.campaign_preview as Record<string, unknown> | undefined;
    const campaign = out.campaign as Record<string, unknown> | undefined;
    if (preview && typeof preview === "object") return { ...out, ...preview };
    if (campaign && typeof campaign === "object") return { ...out, ...campaign };
    return out;
  })();

  switch (highlight.kind) {
    case "creators_found":
      return <CreatorsCanvasView data={out} onSend={onSend} />;
    case "outreach_drafted":
      return <OutreachCanvasView data={out} approvalId={approvalId} onSend={onSend} />;
    case "rate_benchmark":
      return <RatesCanvasView data={out} />;
    case "campaign_created":
    case "campaign_overview":
      return <CampaignCanvasView data={campaignData} approvalId={approvalId} onSend={onSend} />;
    case "approval_pending": {
      // Route approval_pending to the correct canvas based on original tool
      if (highlight.toolName === "campaign_builder") {
        return <CampaignCanvasView data={campaignData} approvalId={approvalId} onSend={onSend} />;
      }
      if (
        highlight.toolName === "propose_outreach" ||
        highlight.toolName === "outreach_drafter"
      ) {
        return <OutreachCanvasView data={out} approvalId={approvalId} onSend={onSend} />;
      }
      return <FallbackView highlight={highlight} />;
    }
    default:
      return <FallbackView highlight={highlight} />;
  }
}

/* ── Summary stat helper ───────────────────────────────── */

function SumStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[10.5px] font-mono uppercase tracking-wider"
        style={{ color: "var(--fg-faint)" }}
      >
        {label}
      </div>
      <div className="mt-1">
        <span
          className="font-semibold"
          style={{
            fontSize: 20,
            color: accent ? "var(--accent-fg)" : "var(--foreground)",
            letterSpacing: -0.2,
          }}
        >
          {value}
        </span>
      </div>
      {hint && (
        <div className="text-[11px] mt-0.5" style={{ color: "var(--fg-dim)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/* ── Filter pill ───────────────────────────────────────── */

function FilterPill({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className="h-7 px-2.5 text-[11.5px] rounded-md transition-colors"
      style={{
        background: active ? "var(--card)" : "transparent",
        border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
        color: active ? "var(--foreground)" : "var(--fg-dim)",
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

/* ── Creators canvas view ──────────────────────────────── */

function CreatorsCanvasView({ data, onSend }: { data: Record<string, unknown>; onSend?: (text: string) => void }) {
  const creators = (data.results as Array<Record<string, unknown>>) ?? [];
  const count = creators.length;

  // Per-row selection. When the set is empty, footer actions act on ALL
  // listed creators (the existing "bulk on all" behavior). When the user
  // checks one or more rows, actions narrow to the selection. This avoids
  // an awkward "select-all-by-default" state — the footer reads naturally
  // as "Email all (10)" until the user opts into a subset.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allIds = creators
    .map((c) => String(c.id ?? c.handle ?? ""))
    .filter((id) => id.length > 0);
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const isAllSelected = selectedCount > 0 && selectedCount === count;

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === count ? new Set() : new Set(allIds),
    );
  };

  /** Creators the footer actions should act on (selection or all). */
  const targetCreators = hasSelection
    ? creators.filter((c) => selectedIds.has(String(c.id ?? c.handle ?? "")))
    : creators;

  const handleDraftOutreach = () => {
    const handles = targetCreators
      .map((c) => `@${String(c.handle ?? "")}`)
      .filter((h) => h.length > 1)
      .slice(0, 10);
    if (handles.length > 0 && onSend) {
      onSend(`Draft outreach emails for ${handles.join(", ")}`);
    }
  };

  const handleExportCSV = () => {
    if (targetCreators.length === 0) return;
    const headers = ["Handle", "Display Name", "Followers", "Tier", "Engagement Rate", "CPI Score", "Niche", "City", "Match Score"];
    const rows = targetCreators.map((c) => [
      String(c.handle ?? ""),
      String(c.display_name ?? c.name ?? ""),
      String(c.followers ?? ""),
      String(c.tier ?? ""),
      String(c.engagement_rate ?? c.er ?? ""),
      String(c.cpi_score ?? c.cpe ?? ""),
      String(c.niche ?? ""),
      String(c.city ?? ""),
      String(c.match_score ?? c.match ?? ""),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "creators.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats computed over `targetCreators` so they reflect the user's
  // current focus: aggregate over the full result set when no selection,
  // narrow to the selection when the user has checked a subset.
  const erValuesPct: number[] = targetCreators
    .map((c) => {
      const scores = (c.scores ?? {}) as Record<string, unknown>;
      const raw = scores.er ?? c.engagement_rate ?? c.er;
      if (raw == null || !Number.isFinite(Number(raw))) return null;
      const n = Number(raw);
      return n <= 1 ? n * 100 : n;
    })
    .filter((v): v is number => v != null);
  const avgER =
    erValuesPct.length > 0
      ? erValuesPct.reduce((a, b) => a + b, 0) / erValuesPct.length
      : null;

  const matchValuesPct: number[] = targetCreators
    .map((c) => {
      const scores = (c.scores ?? {}) as Record<string, unknown>;
      const raw = scores.brand_match ?? c.match_score ?? c.match;
      if (raw == null || !Number.isFinite(Number(raw))) return null;
      const n = Number(raw);
      return n <= 1 ? n * 100 : n;
    })
    .filter((v): v is number => v != null);
  const avgMatch =
    matchValuesPct.length > 0
      ? matchValuesPct.reduce((a, b) => a + b, 0) / matchValuesPct.length
      : null;

  // "Warm leads" = creators who already mention any brand organically.
  // Proxy for "we have a foot in the door" — they've talked about brands
  // unprompted, so a partnership pitch is a smaller ask.
  const warmLeadCount = targetCreators.filter((c) => {
    const mentions = c.organic_brand_mentions;
    return Array.isArray(mentions) && mentions.length > 0;
  }).length;

  const targetCount = targetCreators.length;

  return (
    // Vertical layout pinned to its parent. Summary stats / filter bar /
    // table / footer become a flex column where the table scrolls and
    // the footer is always visible — fixes the previous behavior where
    // bulk-action buttons sat below the fold.
    <div className="flex h-full flex-col">
      {/* Summary stats */}
      <div
        className="shrink-0 px-3 pt-3 pb-2.5 grid grid-cols-4 gap-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <SumStat
          label="Results"
          value={targetCount}
          hint={hasSelection ? `of ${count} selected` : undefined}
        />
        <SumStat
          label="Avg engagement"
          value={avgER != null ? `${avgER.toFixed(1)}%` : "—"}
          hint="from results"
        />
        <SumStat
          label="Audience fit"
          value={avgMatch != null ? Math.round(avgMatch) : "—"}
          hint="avg brand match"
        />
        <SumStat
          label="Warm leads"
          value={warmLeadCount}
          hint="mentions a brand"
          accent={warmLeadCount > 0}
        />
      </div>

      {/* Filter bar */}
      <div
        className="shrink-0 px-3 py-2.5 flex items-center gap-2"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <FilterPill active>All · {count}</FilterPill>
        <div className="flex-1" />
        <span
          className="text-[11px] font-mono"
          style={{ color: "var(--fg-faint)" }}
        >
          sort: match score ↓
        </span>
      </div>

      {/* Table — flex-1 + min-h-0 so it owns the scroll inside the canvas
          column. Without min-h-0 the inner content forces the parent to
          grow and the footer drops below the fold. */}
      <div className="flex-1 min-h-0 overflow-y-auto text-[12.5px]">
        {/* Header */}
        <div
          className="grid px-3 py-2 sticky top-0 z-10"
          style={{
            // Rate dropped (always blank until brands enter rates), and
            // a 32-px column added at the end for the per-row View profile
            // link.
            gridTemplateColumns:
              "28px minmax(180px,1fr) 60px 76px 52px 72px 90px 32px",
            gap: 12,
            background: "var(--background)",
            borderBottom: "1px solid var(--border)",
            color: "var(--fg-faint)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            fontWeight: 600,
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            aria-label={isAllSelected ? "Clear selection" : "Select all"}
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = hasSelection && !isAllSelected;
            }}
            onChange={toggleAll}
            className="h-3.5 w-3.5 cursor-pointer accent-current"
            style={{ color: "var(--foreground)" }}
          />
          <div>Creator</div>
          <div className="text-right">Tier</div>
          <div className="text-right">Followers</div>
          <div className="text-right">ER</div>
          <div className="text-right">CPE</div>
          <div className="text-right">Match</div>
          <div />
        </div>
        {creators.map((c) => {
          const handle = String(c.handle ?? "");
          const initials = handle.slice(0, 2).toUpperCase();
          const followers = Number(c.followers ?? 0);
          // Briefs from creator_search / creator_semantic_search nest scores
          // under `c.scores`. Older flat rows kept for back-compat.
          const scores = (c.scores ?? {}) as Record<string, unknown>;
          // ER may be 0–1 (decimal) on new briefs or 0–100 on old flat rows.
          // Normalize to a percentage string for display.
          const erRaw = scores.er ?? c.engagement_rate ?? c.er;
          const erPct =
            erRaw == null
              ? null
              : Number(erRaw) <= 1
                ? Number(erRaw) * 100
                : Number(erRaw);
          const cpe = scores.cpi ?? c.cpe ?? c.cpi_score;
          const price = Number(c.price ?? c.rate ?? 0);
          const rawMatch = Number(
            (scores.brand_match as number | undefined) ??
              c.match_score ??
              c.match ??
              0,
          );
          // match_score is 0-1; legacy rows may be 0-100. Normalize to 0-100.
          const match = rawMatch > 1 ? Math.round(rawMatch) : Math.round(rawMatch * 100);

          const rowId = String(c.id ?? c.handle ?? "");
          const isSelected = selectedIds.has(rowId);
          return (
            <div
              key={rowId || handle}
              className="grid px-3 py-3 transition-colors"
              style={{
                gridTemplateColumns:
                  "28px minmax(180px,1fr) 60px 76px 52px 72px 90px 32px",
                gap: 12,
                borderBottom: "1px solid var(--border)",
                alignItems: "center",
                background: isSelected ? "var(--indigo-soft)" : undefined,
              }}
            >
              <input
                type="checkbox"
                aria-label={`Select ${handle}`}
                checked={isSelected}
                onChange={() => toggleRow(rowId)}
                className="h-3.5 w-3.5 cursor-pointer accent-current"
                style={{ color: "var(--foreground)" }}
              />
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="h-7 w-7 rounded-full grid place-items-center font-mono text-[10.5px] font-semibold shrink-0"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="font-mono font-medium truncate text-[12.5px]">
                    @{handle}
                  </div>
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--fg-dim)" }}
                  >
                    {String(c.display_name ?? c.name ?? "")}
                    {c.city ? ` · ${String(c.city)}` : ""}
                    {c.niche ? (
                      <span className="font-mono"> · {String(c.niche)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div
                className="text-right text-[11.5px] font-mono"
                style={{ color: "var(--muted-foreground)" }}
              >
                {String(c.tier ?? "")}
              </div>
              <div className="text-right font-mono text-[12px]">
                {(followers / 1000).toFixed(1)}K
              </div>
              <div
                className="text-right font-mono text-[12px]"
                style={{
                  color:
                    erPct != null && erPct >= 5
                      ? "var(--success)"
                      : "var(--foreground)",
                }}
              >
                {erPct != null ? `${erPct.toFixed(1)}%` : "—"}
              </div>
              <div
                className="text-right font-mono text-[12px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                {cpe != null ? Math.round(Number(cpe)) : "—"}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {match > 0 && (
                  <>
                    <div
                      className="w-14 h-1 rounded-full overflow-hidden"
                      style={{ background: "var(--surface-3)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${match}%`,
                          background:
                            match >= 90
                              ? "var(--primary)"
                              : "var(--muted-foreground)",
                        }}
                      />
                    </div>
                    <span
                      className="font-mono text-[11.5px]"
                      style={{
                        color: "var(--muted-foreground)",
                        minWidth: 24,
                      }}
                    >
                      {match}
                    </span>
                  </>
                )}
              </div>
              {/* View profile — opens /creator/[handle] in a new tab.
                  Renders only when there's a usable handle. */}
              <div className="flex items-center justify-end">
                {handle && (
                  <a
                    href={`/creator/${encodeURIComponent(handle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${handle}'s profile in a new tab`}
                    title="View profile"
                    className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-surface-2"
                    style={{ color: "var(--fg-dim)" }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions — shrink-0 so they stay pinned at the bottom of
          the canvas column even when the table grows past the viewport.
          The previous layout let the footer scroll off-screen. */}
      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* Selection state line. Only shown when there's an active subset
            selection — otherwise the buttons read "Email all (N)" and the
            user has the implicit "all" mental model. */}
        {hasSelection && (
          <div
            className="mb-2 flex items-center justify-between text-[11.5px]"
            style={{ color: "var(--fg-dim)" }}
          >
            <span>
              <strong style={{ color: "var(--foreground)" }}>
                {selectedCount}
              </strong>{" "}
              of {count} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[11.5px] underline-offset-2 hover:underline"
              style={{ color: "var(--fg-dim)" }}
            >
              Clear selection
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Primary bulk action — drafts outreach for the targets
              (selection if any, else the full list). The agent's
              outreach_drafter skill picks this up via the chat input. */}
          <button
            onClick={handleDraftOutreach}
            disabled={targetCreators.length === 0}
            className="h-8 px-3 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 transition-colors active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
            }}
          >
            <Mail className="h-3.5 w-3.5" />
            {hasSelection
              ? `Email selected (${selectedCount})`
              : `Email all (${count})`}
          </button>

          {/* Add the targets to a campaign. Routes through the agent so
              it can pick (or create) the right campaign and attach all
              the creator IDs at once. */}
          <button
            onClick={() => {
              if (!onSend || targetCreators.length === 0) return;
              const handles = targetCreators
                .map((c) => `@${String(c.handle ?? "")}`)
                .filter((h) => h.length > 1);
              onSend(
                `Add these ${handles.length} creators to a campaign: ${handles.join(", ")}`,
              );
            }}
            disabled={targetCreators.length === 0}
            className="h-8 px-3 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 border transition-colors active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "var(--foreground)", background: "var(--card)" }}
          >
            <Megaphone className="h-3.5 w-3.5" />
            {hasSelection
              ? `Add ${selectedCount} to campaign`
              : "Add to campaign"}
          </button>

          <button
            onClick={() => {
              if (!onSend || targetCreators.length === 0) return;
              const handles = targetCreators
                .map((c) => `@${String(c.handle ?? "")}`)
                .filter((h) => h.length > 1);
              onSend(`Save these creators as a list: ${handles.join(", ")}`);
            }}
            disabled={targetCreators.length === 0}
            className="h-8 px-3 rounded-md text-[12.5px] flex items-center gap-1.5 border transition-colors active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "var(--foreground)", background: "var(--card)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Save as list
          </button>
          <button
            onClick={handleExportCSV}
            disabled={targetCreators.length === 0}
            className="h-8 px-3 rounded-md text-[12.5px] flex items-center gap-1.5 border transition-colors active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "var(--fg-dim)", background: "var(--card)" }}
          >
            <Download className="h-3.5 w-3.5" />
            {hasSelection ? `Export ${selectedCount}` : "Export CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Outreach canvas view ──────────────────────────────── */

function OutreachCanvasView({
  data,
  approvalId,
  onSend,
}: {
  data: Record<string, unknown>;
  approvalId?: string;
  onSend?: (text: string) => void;
}) {
  const handle = String(data.creator_handle ?? data.handle ?? "creator");
  const email = String(data.creator_email ?? "");
  const [subject, setSubject] = useState(String(data.subject ?? "Outreach email"));
  const [body, setBody] = useState(String(data.body ?? ""));
  const [isEditing, setIsEditing] = useState(false);
  const campaign = String(data.campaign ?? "");
  const { status: approvalStatus, error: approvalError, handleAction } = useApprovalAction(approvalId);

  return (
    <div className="flex flex-col h-full">
      {/* Meta */}
      <div
        className="px-3 py-3 text-[12px]"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <MetaRow label="To" value={`@${handle}${email ? ` · ${email}` : ""}`} mono />
        <div className="flex items-start py-0.5">
          <div
            className="w-20 shrink-0 text-[11px] font-mono uppercase tracking-wider pt-0.5"
            style={{ color: "var(--fg-faint)" }}
          >
            Subject
          </div>
          {isEditing ? (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-[12px] font-medium focus:outline-none"
              style={{
                color: "var(--foreground)",
                borderBottom: "1px solid var(--primary)",
                paddingBottom: 1,
              }}
            />
          ) : (
            <div style={{ color: "var(--foreground)", fontWeight: 500 }}>{subject}</div>
          )}
        </div>
        {campaign && <MetaRow label="Campaign" value={campaign} mono />}
      </div>

      {/* Body — editable */}
      <div className="px-3 py-3 flex-1">
        {isEditing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-full min-h-[200px] bg-transparent font-sans resize-none focus:outline-none"
            style={{
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--foreground)",
              border: "1px solid var(--primary)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
        ) : (
          <pre
            className="whitespace-pre-wrap font-sans"
            style={{
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--foreground)",
            }}
          >
            {body}
          </pre>
        )}
      </div>

      {/* Agent notes */}
      {data.tone_score != null && (
        <div className="px-3 pb-3">
          <div
            className="p-2.5 rounded-lg"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
              <span
                className="text-[11px] font-mono uppercase tracking-wider"
                style={{ color: "var(--fg-dim)" }}
              >
                Agent notes
              </span>
            </div>
            <ul
              className="space-y-1.5 text-[12px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <li className="flex gap-2">
                <span style={{ color: "var(--fg-faint)" }}>●</span>
                Tone classifier: {String(data.tone_score)}
              </li>
              {data.spam_score != null && (
                <li className="flex gap-2">
                  <span style={{ color: "var(--fg-faint)" }}>●</span>
                  Spam score: {String(data.spam_score)}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Sticky approval footer — always visible for outreach */}
      <div
        className="sticky bottom-0 px-3 py-2.5 flex items-center gap-2 shrink-0"
        style={{
          background: "var(--card)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {approvalStatus === "approved" ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--success, #10B981)" }}>
            <Check className="h-3.5 w-3.5" /> Approved & sent
          </div>
        ) : approvalStatus === "rejected" ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--danger)" }}>
            <X className="h-3.5 w-3.5" /> Rejected
          </div>
        ) : isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(false)}
              className="h-7 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1.5"
              style={{ background: "var(--foreground)", color: "var(--background)" }}
            >
              Done editing
            </button>
            <button
              onClick={() => {
                setSubject(String(data.subject ?? "Outreach email"));
                setBody(String(data.body ?? ""));
                setIsEditing(false);
              }}
              className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border"
              style={{ color: "var(--fg-dim)", background: "var(--card)" }}
            >
              Discard changes
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleAction("approve")}
              disabled={approvalStatus === "loading" || !approvalId}
              className="h-7 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "var(--foreground)", color: "var(--background)" }}
            >
              {approvalStatus === "loading" ? "Sending..." : "Approve & send"}
              {approvalStatus !== "loading" && <kbd className="text-[10px] font-mono ml-1 opacity-60">⌘↵</kbd>}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border"
              style={{ color: "var(--foreground)", background: "var(--card)" }}
            >
              <Edit3 className="h-3 w-3" /> Edit
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={approvalStatus === "loading" || !approvalId}
              className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border disabled:opacity-50"
              style={{ color: "var(--danger)", background: "var(--card)" }}
            >
              Reject
            </button>
            {approvalError && (
              <span className="text-[11px] ml-1" style={{ color: "var(--danger)" }}>{approvalError}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start py-0.5">
      <div
        className="w-20 shrink-0 text-[11px] font-mono uppercase tracking-wider"
        style={{ color: "var(--fg-faint)" }}
      >
        {label}
      </div>
      <div
        className={mono ? "font-mono text-[11.5px]" : ""}
        style={{
          color: bold ? "var(--foreground)" : "var(--muted-foreground)",
          fontWeight: bold ? 500 : 400,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Rates canvas view ─────────────────────────────────── */

function RatesCanvasView({ data }: { data: Record<string, unknown> }) {
  const rate = (data.market_rate as Record<string, unknown>) ?? {};
  const tier = String(data.tier ?? "");
  const min = Number(rate.min ?? 0);
  const median = Number(rate.median ?? 0);
  const max = Number(rate.max ?? 0);

  return (
    <div className="px-3 py-3">
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SumStat
          label="Market band"
          value={`₹${(min / 1000).toFixed(0)}k–₹${(max / 1000).toFixed(0)}k`}
          hint={tier ? `${tier} tier` : undefined}
        />
        <SumStat
          label="Median"
          value={`₹${median.toLocaleString("en-IN")}`}
        />
        <SumStat
          label="Sample size"
          value={data.sample_size ? String(data.sample_size) : "—"}
          hint="recent deals"
        />
      </div>

      {/* Rate table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="grid px-4 py-2.5 text-[10.5px] font-mono uppercase tracking-wider"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            background: "var(--surface-2)",
            color: "var(--fg-faint)",
            fontWeight: 600,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>Band</div>
          <div className="text-right">Low</div>
          <div className="text-right">Median</div>
          <div className="text-right">High</div>
        </div>
        <div
          className="grid px-4 py-3 items-center"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            background: "var(--indigo-soft)",
          }}
        >
          <div className="text-[12.5px] font-semibold">
            {tier || "Target band"}
          </div>
          <div className="text-right font-mono text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            ₹{(min / 1000).toFixed(0)}k
          </div>
          <div className="text-right font-mono text-[12.5px] font-semibold">
            ₹{(median / 1000).toFixed(0)}k
          </div>
          <div className="text-right font-mono text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            ₹{(max / 1000).toFixed(0)}k
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Campaign canvas view ──────────────────────────────── */

function CampaignCanvasView({
  data,
  approvalId,
  onSend,
}: {
  data: Record<string, unknown>;
  approvalId?: string;
  onSend?: (text: string) => void;
}) {
  const [campaignName, setCampaignName] = useState(String(data.name ?? data.campaign ?? "New Campaign"));
  const [isEditingName, setIsEditingName] = useState(false);
  const { status: approvalStatus, error: approvalError, handleAction } = useApprovalAction(approvalId);
  const description = String(data.description ?? "");
  const goal = String(data.goal ?? data.objective ?? "");
  const contentFormat = data.content_format ?? data.format;
  // Handle dates — campaign_builder returns "YYYY-MM-DD → YYYY-MM-DD" string
  const datesStr = typeof data.dates === "string" ? data.dates : null;
  const startDate = data.start_date ?? data.startDate ?? (datesStr?.includes("→") ? datesStr.split("→")[0].trim() : null);
  const endDate = data.end_date ?? data.endDate ?? (datesStr?.includes("→") ? datesStr.split("→")[1].trim() : null);
  const budget = Number(data.total_budget ?? data.budget ?? 0);
  const budgetMin = data.budget_per_creator_min ?? data.min_budget ?? data.budget_per_creator;
  const budgetMax = data.budget_per_creator_max ?? data.max_budget;
  const status = String(data.approval_status ?? data.status ?? "draft");
  const kpis = (data.kpis as Array<Record<string, unknown>>) ?? [];
  const budgetSplit = (data.budget_split ?? data.split) as Record<string, number> | undefined;
  const creators = (data.creators ?? data.roster ?? data.results) as Array<Record<string, unknown>> | undefined;
  const creatorsCount = Number(data.creators_count ?? creators?.length ?? 0);
  // brief_requirements from campaign_builder, or deliverables/content_types
  const briefRequirements = (data.brief_requirements ?? data.content_requirements) as string[] | undefined;
  const deliverables = (data.deliverables ?? data.content_types) as Array<Record<string, unknown>> | string[] | undefined;
  const timeline = (data.timeline ?? data.phases) as Array<Record<string, unknown>> | undefined;
  const brief = data.brief as string | Record<string, unknown> | undefined;
  const targetRegions = data.target_regions ?? data.regions;
  const targetNiches = data.target_niches ?? data.niches;
  const creatorTiers = data.creator_tiers ?? data.tiers;
  // Performance data from get_campaign_info
  const perfSummary = data.performance_summary as Record<string, unknown> | undefined;

  const formatTags = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  };

  return (
    <div>
      {/* Hero */}
      <div className="px-3 pt-3 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="text-[10.5px] font-mono uppercase tracking-wider"
            style={{ color: "var(--fg-faint)" }}
          >
            Campaign name
          </div>
          {!isEditingName && (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors hover:bg-surface-2"
              style={{ color: "var(--fg-dim)" }}
            >
              edit
            </button>
          )}
        </div>
        {isEditingName ? (
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
            autoFocus
            className="w-full bg-transparent font-semibold focus:outline-none"
            style={{
              fontSize: 20,
              color: "var(--foreground)",
              letterSpacing: -0.3,
              borderBottom: "1px solid var(--primary)",
              paddingBottom: 2,
            }}
          />
        ) : (
          <h2
            className="font-semibold"
            style={{ fontSize: 20, color: "var(--foreground)", letterSpacing: -0.3 }}
          >
            {campaignName}
          </h2>
        )}
        {description && (
          <p className="text-[12.5px] mt-1" style={{ color: "var(--fg-dim)", lineHeight: 1.5 }}>
            {description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="text-[11px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "var(--surface-2)",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {status}
          </span>
          {typeof contentFormat === "string" && contentFormat && (
            <span
              className="text-[11px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "var(--surface-2)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
            >
              {contentFormat}
            </span>
          )}
          {(typeof startDate === "string" || typeof endDate === "string") && (
            <span className="text-[11px] font-mono" style={{ color: "var(--fg-dim)" }}>
              {startDate ? String(startDate) : ""}{startDate && endDate ? " → " : ""}{endDate ? String(endDate) : ""}
            </span>
          )}
        </div>
      </div>

      {/* 01 — Objective + KPIs */}
      {(goal || kpis.length > 0) && (
        <Section title="Objective & KPIs" mono="01">
          {goal && (
            <p className="text-[13px] mb-3" style={{ color: "var(--foreground)", lineHeight: 1.55 }}>
              {goal}
            </p>
          )}
          {kpis.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {kpis.map((kpi, i) => (
                <div
                  key={i}
                  className="rounded-md px-2.5 py-2"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="text-[10.5px] font-mono uppercase tracking-wider" style={{ color: "var(--fg-faint)" }}>
                    {String(kpi.label ?? kpi.name ?? `KPI ${i + 1}`)}
                  </div>
                  <div className="font-semibold mt-0.5" style={{ fontSize: 16, color: "var(--foreground)" }}>
                    {String(kpi.target ?? kpi.value ?? "—")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* 02 — Budget + split bar */}
      {budget > 0 && (
        <Section title="Budget" mono="02">
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="font-semibold"
              style={{ fontSize: 20, letterSpacing: -0.3, color: "var(--foreground)" }}
            >
              ₹{budget.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] font-mono" style={{ color: "var(--fg-faint)" }}>
              total
            </span>
          </div>
          {(budgetMin != null || budgetMax != null) ? (
            <div className="text-[12px] mb-3" style={{ color: "var(--fg-dim)" }}>
              Per creator: ₹{Number(budgetMin ?? 0).toLocaleString("en-IN")} – ₹{Number(budgetMax ?? 0).toLocaleString("en-IN")}
            </div>
          ) : null}
          {budgetSplit && (
            <>
              <div className="h-2 rounded-full flex overflow-hidden gap-px mb-2">
                {Object.entries(budgetSplit).map(([key, val], i) => {
                  const pct = budget > 0 ? (val / budget) * 100 : 0;
                  const colors = ["var(--primary)", "var(--amber)", "var(--success)", "var(--fg-dim)", "var(--danger)"];
                  return (
                    <div
                      key={key}
                      className="h-full rounded-sm"
                      style={{ width: `${pct}%`, background: colors[i % colors.length], minWidth: 4 }}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(budgetSplit).map(([key, val], i) => {
                  const colors = ["var(--primary)", "var(--amber)", "var(--success)", "var(--fg-dim)", "var(--danger)"];
                  return (
                    <div key={key} className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <span style={{ color: "var(--muted-foreground)" }}>
                        {key.replace(/_/g, " ")} · ₹{val.toLocaleString("en-IN")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Section>
      )}

      {/* 03 — Targeting */}
      {(formatTags(targetRegions).length > 0 || formatTags(targetNiches).length > 0 || formatTags(creatorTiers).length > 0) && (
        <Section title="Targeting" mono="03">
          {formatTags(targetRegions).length > 0 && (
            <div className="mb-2">
              <div className="text-[10.5px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--fg-faint)" }}>
                Regions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formatTags(targetRegions).map((r) => (
                  <span key={r} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
          {formatTags(targetNiches).length > 0 && (
            <div className="mb-2">
              <div className="text-[10.5px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--fg-faint)" }}>
                Niches
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formatTags(targetNiches).map((n) => (
                  <span key={n} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          {formatTags(creatorTiers).length > 0 && (
            <div>
              <div className="text-[10.5px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--fg-faint)" }}>
                Creator tiers
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formatTags(creatorTiers).map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* 04 — Creator roster (full table or count summary) */}
      {creatorsCount > 0 && (!creators || creators.length === 0) && (
        <Section title="Creators" mono="04">
          <div
            className="rounded-md px-2.5 py-2"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div className="font-semibold" style={{ fontSize: 18, color: "var(--foreground)" }}>
              {creatorsCount}
            </div>
            <div className="text-[11px] font-mono mt-0.5" style={{ color: "var(--fg-dim)" }}>
              creators selected
            </div>
          </div>
        </Section>
      )}
      {creators && creators.length > 0 && (
        <Section title="Creator Roster" mono="04">
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div
              className="grid px-2.5 py-1.5 text-[10.5px] font-mono uppercase tracking-wider"
              style={{
                gridTemplateColumns: "1fr 60px 60px 72px",
                background: "var(--surface-2)",
                color: "var(--fg-faint)",
                fontWeight: 600,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>Creator</div>
              <div className="text-right">Tier</div>
              <div className="text-right">Rate</div>
              <div className="text-right">Deliverables</div>
            </div>
            {creators.map((c, i) => {
              const handle = String(c.handle ?? c.name ?? `Creator ${i + 1}`);
              const tier = String(c.tier ?? "");
              const rate = Number(c.rate ?? c.price ?? 0);
              const dels = c.deliverables ?? c.content_count ?? "";
              return (
                <div
                  key={i}
                  className="grid px-2.5 py-2 items-center"
                  style={{
                    gridTemplateColumns: "1fr 60px 60px 72px",
                    borderBottom: i < creators.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className="font-mono text-[12px] truncate">@{handle}</div>
                  <div className="text-right text-[11px] font-mono" style={{ color: "var(--fg-dim)" }}>{tier}</div>
                  <div className="text-right font-mono text-[12px]">
                    {rate > 0 ? `₹${(rate / 1000).toFixed(0)}k` : "—"}
                  </div>
                  <div className="text-right text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {typeof dels === "number" ? `${dels} posts` : String(dels || "—")}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 05 — Deliverables */}
      {deliverables && deliverables.length > 0 && (
        <Section title="Deliverables" mono="05">
          <div className="grid grid-cols-2 gap-2">
            {deliverables.map((d, i) => {
              const isObj = typeof d === "object" && d !== null;
              const label = isObj ? String((d as Record<string, unknown>).type ?? (d as Record<string, unknown>).name ?? `Type ${i + 1}`) : String(d);
              const count = isObj ? (d as Record<string, unknown>).count : undefined;
              const platform = isObj ? (d as Record<string, unknown>).platform : undefined;
              return (
                <div
                  key={i}
                  className="rounded-md px-2.5 py-2"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="text-[12.5px] font-medium" style={{ color: "var(--foreground)" }}>
                    {label}
                  </div>
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: "var(--fg-dim)" }}>
                    {count != null && `${String(count)}x`}
                    {platform ? ` · ${String(platform)}` : null}
                    {!count && !platform && "included"}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 05b — Brief requirements (from campaign_builder) */}
      {briefRequirements && briefRequirements.length > 0 && (
        <Section title="Content Requirements" mono="05">
          <ul className="space-y-1">
            {briefRequirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--foreground)" }}>
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--primary)" }} />
                {req}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 06 — Performance (from get_campaign_info) */}
      {perfSummary && (
        <Section title="Performance" mono="06">
          <div className="grid grid-cols-4 gap-2">
            <SumStat label="Revenue" value={`₹${Number(perfSummary.total_revenue ?? 0).toLocaleString("en-IN")}`} />
            <SumStat label="Orders" value={String(perfSummary.total_orders ?? 0)} />
            <SumStat label="Spend" value={`₹${Number(perfSummary.total_spend ?? 0).toLocaleString("en-IN")}`} />
            <SumStat label="ROI" value={`${Number(perfSummary.roi ?? 0).toFixed(1)}x`} accent />
          </div>
        </Section>
      )}

      {/* 07 — Timeline */}
      {timeline && timeline.length > 0 && (
        <Section title="Timeline" mono="06">
          <div className="flex items-start gap-0 relative">
            {/* Connector line */}
            <div
              className="absolute top-[6px] left-[6px] right-[6px] h-px"
              style={{ background: "var(--border)" }}
            />
            {timeline.map((phase, i) => (
              <div key={i} className="flex-1 relative flex flex-col items-center text-center">
                <div
                  className="h-3 w-3 rounded-full z-10 shrink-0"
                  style={{
                    background: i === 0 ? "var(--primary)" : "var(--surface-3)",
                    border: `2px solid ${i === 0 ? "var(--primary)" : "var(--border)"}`,
                  }}
                />
                <div className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--foreground)" }}>
                  {String(phase.name ?? phase.label ?? `Phase ${i + 1}`)}
                </div>
                <div className="text-[10px] font-mono" style={{ color: "var(--fg-faint)" }}>
                  {String(phase.dates ?? phase.duration ?? "")}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 07 — Creator brief */}
      {brief && (
        <Section title="Creator Brief" mono="07">
          <div
            className="rounded-md p-2.5 text-[12.5px]"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {typeof brief === "string" ? brief : JSON.stringify(brief, null, 2)}
          </div>
        </Section>
      )}

      {/* Sticky approval footer — always visible for campaigns */}
      <div
        className="sticky bottom-0 px-3 py-2.5 flex items-center gap-2"
        style={{
          background: "var(--card)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {approvalStatus === "approved" ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--success, #10B981)" }}>
            <Check className="h-3.5 w-3.5" /> Campaign activated
          </div>
        ) : approvalStatus === "rejected" ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--danger)" }}>
            <X className="h-3.5 w-3.5" /> Campaign rejected
          </div>
        ) : (
          <>
            <button
              onClick={() => handleAction("approve")}
              disabled={approvalStatus === "loading" || !approvalId}
              className="h-7 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "var(--foreground)", color: "var(--background)" }}
            >
              {approvalStatus === "loading" ? "Activating..." : "Approve & activate"}
              {approvalStatus !== "loading" && <kbd className="text-[10px] font-mono ml-1 opacity-60">⌘↵</kbd>}
            </button>
            <button
              onClick={() => {
                if (onSend) onSend(`Save campaign "${campaignName}" as draft`);
              }}
              className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border"
              style={{ color: "var(--foreground)", background: "var(--card)" }}
            >
              Save draft
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={approvalStatus === "loading" || !approvalId}
              className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border disabled:opacity-50"
              style={{ color: "var(--danger)", background: "var(--card)" }}
            >
              Reject
            </button>
            {approvalError && (
              <span className="text-[11px] ml-1" style={{ color: "var(--danger)" }}>{approvalError}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Approval actions (shared by outreach & campaign) ──── */

function ApprovalActions({
  approvalId,
  context,
}: {
  approvalId: string;
  context: "outreach" | "campaign";
}) {
  const primaryLabel = context === "outreach" ? "Approve & send" : "Approve & launch";
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: "var(--amber-soft)",
        border: "1px solid var(--amber)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3 w-3" style={{ color: "var(--amber)" }} />
        <span className="text-[11.5px] font-medium" style={{ color: "var(--amber)" }}>
          Awaiting your approval
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="h-7 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1.5"
          style={{ background: "var(--foreground)", color: "var(--background)" }}
        >
          {primaryLabel}
          <kbd className="text-[10px] font-mono ml-1 opacity-60">⌘↵</kbd>
        </button>
        <button
          className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border"
          style={{ color: "var(--foreground)", background: "var(--card)" }}
        >
          <Edit3 className="h-3 w-3" /> Edit
          <kbd className="text-[10px] font-mono ml-1 opacity-40">E</kbd>
        </button>
        <button
          className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 border"
          style={{ color: "var(--danger)", background: "var(--card)" }}
        >
          Reject
          <kbd className="text-[10px] font-mono ml-1 opacity-40">⌘⌫</kbd>
        </button>
      </div>
    </div>
  );
}

/* ── Section helper ────────────────────────────────────── */

function Section({
  title,
  mono,
  children,
}: {
  title: string;
  mono: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--fg-faint)" }}
        >
          {mono}
        </span>
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: "var(--fg-dim)" }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── Fallback view ─────────────────────────────────────── */

function FallbackView({ highlight }: { highlight: Highlight }) {
  // Construct a fake tool part that ToolResultCard can consume
  const fakePart = {
    toolCallId: highlight.id,
    toolName: highlight.toolName,
    state: "result",
    output: highlight.toolOutput,
    type: `tool-${highlight.toolName}`,
  };

  return (
    <div className="p-3">
      <ToolResultCard tool={fakePart} />
      {/* If ToolResultCard returns null, show raw summary */}
      <div className="mt-3">
        <div
          className="p-3 rounded-lg text-[12.5px]"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
            lineHeight: 1.55,
          }}
        >
          <p className="font-mono text-[11px] mb-2" style={{ color: "var(--fg-faint)" }}>
            Tool: {highlight.toolName}
          </p>
          {typeof highlight.toolOutput.message === "string" && (
            <p>{highlight.toolOutput.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
