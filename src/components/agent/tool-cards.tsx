"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Plus, BadgeCheck, Sparkles } from "lucide-react";

import { NegotiationCard } from "./negotiation-card";
import { AddToCampaignDialog } from "@/components/creators/add-to-campaign-dialog";
import { formatFollowers } from "@/lib/format";

interface ToolCardProps {
  tool: Record<string, unknown>;
  compact?: boolean;
}

export function ToolResultCard({ tool, compact = false }: ToolCardProps) {
  const state = tool.state as string;
  if (state !== "result" && state !== "output") return null;

  const partType = (tool.type as string) || "";
  const name = (tool.toolName as string) || partType.replace(/^tool-/, "");
  const result = (tool.output ?? tool.result) as Record<string, unknown>;

  if (!result) return null;

  // Both creator_search and creator_semantic_search return briefs in the
  // same shape — render with the same card. The semantic flavour will
  // surface a similarity chip on each card (see CreatorBriefCard).
  if (
    (name === "creator_search" || name === "creator_semantic_search") &&
    result?.results
  ) {
    return <CreatorSearchCard result={result} compact={compact} />;
  }

  if (name === "outreach_drafter" && result?.draft_id) {
    return <OutreachDraftCard result={result} />;
  }

  if (name === "propose_outreach" && result?.approval_id) {
    return <ApprovalPendingCard message="Outreach awaiting your approval" />;
  }

  if (name === "rate_benchmarker" && result?.market_rate) {
    return <RateBenchmarkCard result={result} />;
  }

  if (name === "counter_offer_generator" && result?.negotiation) {
    return <NegotiationCard data={result as never} />;
  }

  if (name === "budget_optimizer" && result?.budget_summary) {
    return <BudgetCard result={result} />;
  }

  if (name === "deal_memo_generator" && result?.deal_memo) {
    return <DealMemoCard result={result} />;
  }

  if (name === "roi_calculator" && result?.kpis) {
    return <ROICard result={result} />;
  }

  if (name === "campaign_overview" && result?.campaigns) {
    return <CampaignOverviewCard result={result} compact={compact} />;
  }

  if (name === "content_tracker" && result?.posts) {
    return <ContentTrackerCard result={result} compact={compact} />;
  }

  // Generic approval-pending cards
  if (result?.approval_id && result?.status === "pending") {
    return (
      <ApprovalPendingCard
        message={String(result.message || "Review in Approvals")}
      />
    );
  }

  // Generic tool result — show a summary if there's a message
  if (result?.message && typeof result.message === "string") {
    return (
      <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  return null;
}

/* ── Creator Search Card ─────────────────────────────────── */
/**
 * Renders the result of `creator_search` (and forward-compat with
 * `creator_semantic_search`). Each result is a rich, interactive card:
 * avatar, handle, platform pill, stat chips, "why" reasoning, and two
 * inline action buttons (Open profile · Add to campaign).
 *
 * Compact mode (used inside conversation history) collapses each card
 * to a one-line summary so old turns don't dominate the scrollback.
 */

interface CreatorBrief {
  id: string;
  handle: string | null;
  display_name: string | null;
  platform: "instagram" | "youtube" | null;
  avatar_url: string | null;
  followers: number | null;
  tier: string | null;
  is_verified: boolean | null;
  summary?: string;
  why?: string;
  scores?: {
    cpi: number | null;
    er: number | null;
    hook_quality: number | null;
    audience_authenticity: number | null;
    brand_match: number | null;
    /** Only set by creator_semantic_search — RRF-derived 0–1 score. */
    similarity?: number | null;
  };
  /* Back-compat with the old flat shape so older messages still render */
  cpi_score?: number | null;
  engagement_rate?: number | null;
  match_score?: number | null;
  niche?: string | null;
  language?: string | null;
  city?: string | null;
  country?: string | null;
}

function formatFiltersRecap(filters: Record<string, unknown>): string[] {
  if (!filters) return [];
  const labels: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === "") continue;
    const label = k.replace(/_/g, " ");
    if (typeof v === "boolean") {
      labels.push(`${label}: ${v ? "yes" : "no"}`);
    } else {
      labels.push(`${label}: ${v}`);
    }
  }
  return labels;
}

export function CreatorSearchCard({
  result,
  compact,
}: {
  result: Record<string, unknown>;
  compact: boolean;
}) {
  const creators = (result.results as CreatorBrief[]) ?? [];
  const limit = compact ? 5 : 10;
  const visible = creators.slice(0, limit);
  const filters = (result.filters as Record<string, unknown> | undefined) ?? {};
  const filterChips = formatFiltersRecap(filters);

  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      {/* Header: count + total + filter recap */}
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Found {String(result.count)} creator
            {Number(result.count) === 1 ? "" : "s"}
          </p>
          {result.total_in_database != null &&
          Number(result.total_in_database) > Number(result.count) ? (
            <span className="text-[10px] text-muted-foreground">
              {String(result.total_in_database)} matches in database
            </span>
          ) : null}
        </div>
        {filterChips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {filterChips.map((label) => (
              <span
                key={label}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card grid */}
      <div
        className={
          compact
            ? "flex flex-col gap-1.5"
            : "grid grid-cols-1 gap-2 lg:grid-cols-2"
        }
      >
        {visible.map((c) => (
          <CreatorBriefCard key={c.id} brief={c} compact={compact} />
        ))}
      </div>

      {creators.length > limit && (
        <p className="mt-2 text-center text-muted-foreground">
          +{creators.length - limit} more — refine the search to see them
        </p>
      )}
    </div>
  );
}

function CreatorBriefCard({
  brief,
  compact,
}: {
  brief: CreatorBrief;
  compact: boolean;
}) {
  const [campaignDialogOpen, setCampaignDialogOpen] = React.useState(false);

  // Back-compat: fall back to old flat fields when scores object is missing.
  const cpi = brief.scores?.cpi ?? brief.cpi_score ?? null;
  const er = brief.scores?.er ?? brief.engagement_rate ?? null;
  const brandMatch =
    brief.scores?.brand_match ?? brief.match_score ?? null;
  const hookQuality = brief.scores?.hook_quality ?? null;

  // Compact rendering — terse line for conversation history.
  if (compact) {
    return (
      <div className="flex items-center gap-2 border-b py-1 last:border-0">
        <Avatar
          src={brief.avatar_url}
          alt={brief.handle ?? ""}
          handle={brief.handle ?? "?"}
          size={20}
        />
        <span className="truncate font-mono">@{brief.handle}</span>
        {brief.tier && <TierBadge tier={brief.tier} />}
        {brief.followers != null && (
          <span className="text-muted-foreground">
            {formatFollowers(brief.followers)}
          </span>
        )}
        {brandMatch != null && <MatchBadge score={Number(brandMatch)} />}
      </div>
    );
  }

  // Full card.
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      {/* Identity row */}
      <div className="flex items-start gap-2.5">
        <Avatar
          src={brief.avatar_url}
          alt={brief.handle ?? ""}
          handle={brief.handle ?? "?"}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-sm font-semibold">
              @{brief.handle}
            </span>
            {brief.is_verified && (
              <BadgeCheck className="size-3.5 shrink-0 text-blue-500" />
            )}
            {brief.platform && <PlatformPill platform={brief.platform} />}
          </div>
          {brief.display_name && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {brief.display_name}
            </span>
          )}
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {brief.tier && <TierBadge tier={brief.tier} />}
        {brief.followers != null && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            {formatFollowers(brief.followers)}
          </span>
        )}
        {cpi != null && (
          <StatChip label="CPI" value={Math.round(Number(cpi))} />
        )}
        {er != null && (
          <StatChip
            label="ER"
            value={`${(Number(er) <= 1 ? Number(er) * 100 : Number(er)).toFixed(1)}%`}
          />
        )}
        {brandMatch != null ? (
          <StatChip
            label="Match"
            value={`${Math.round(Number(brandMatch) * 100)}%`}
            tone={
              Number(brandMatch) >= 0.8
                ? "success"
                : Number(brandMatch) >= 0.6
                  ? "warn"
                  : "muted"
            }
          />
        ) : hookQuality != null ? (
          <StatChip
            label="Hook"
            value={`${Math.round(Number(hookQuality) <= 1 ? Number(hookQuality) * 100 : Number(hookQuality))}/100`}
          />
        ) : null}
        {/* Similarity chip — only present on results from creator_semantic_search.
            Indicates how well the creator matched the natural-language intent. */}
        {brief.scores?.similarity != null && (
          <StatChip
            label="Sim"
            value={`${Math.round(Number(brief.scores.similarity) * 100)}%`}
            tone={
              Number(brief.scores.similarity) >= 0.8
                ? "success"
                : Number(brief.scores.similarity) >= 0.5
                  ? "warn"
                  : "muted"
            }
          />
        )}
      </div>

      {/* Summary (templated) */}
      {brief.summary && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {brief.summary}
        </p>
      )}

      {/* Why chip */}
      {brief.why && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-1.5 text-[10px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <Sparkles className="size-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{brief.why}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-0.5">
        {brief.handle && (
          <Link
            href={`/creator/${encodeURIComponent(brief.handle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-muted"
          >
            <ExternalLink className="size-3" />
            Open profile
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCampaignDialogOpen(true)}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-muted"
        >
          <Plus className="size-3" />
          Add to campaign
        </button>
      </div>

      <AddToCampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        creatorId={brief.id}
        creatorHandle={brief.handle ?? ""}
        matchScore={brandMatch != null ? Number(brandMatch) : null}
      />
    </div>
  );
}

function Avatar({
  src,
  alt,
  handle,
  size,
}: {
  src: string | null;
  alt: string;
  handle: string;
  size: number;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size / 2.5)),
      }}
    >
      {handle?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function PlatformPill({ platform }: { platform: "instagram" | "youtube" }) {
  const cls =
    platform === "youtube"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400";
  const label = platform === "youtube" ? "YT" : "IG";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1 py-0.5 text-[9px] font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warn" | "muted";
}) {
  const color =
    tone === "success"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : tone === "warn"
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-muted text-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${color}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

/* ── Outreach Draft Card ─────────────────────────────────── */

export function OutreachDraftCard({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      <p className="font-semibold mb-1">Draft saved</p>
      <p className="text-muted-foreground">
        To: {String(result.creator_email)}
      </p>
      <p className="font-medium mt-1">{String(result.subject)}</p>
      <p className="text-muted-foreground mt-1 line-clamp-3">
        {String(result.body).substring(0, 200)}...
      </p>
    </div>
  );
}

/* ── Approval Pending Card ───────────────────────────────── */

export function ApprovalPendingCard({ message }: { message: string }) {
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs">
      <p className="font-semibold text-amber-700 dark:text-amber-400">
        Awaiting your approval
      </p>
      <p className="text-muted-foreground mt-1">{message}</p>
      <p className="mt-1">
        <a
          href="/approvals"
          className="underline text-amber-700 dark:text-amber-400"
        >
          Review in Approvals
        </a>
      </p>
    </div>
  );
}

/* ── Rate Benchmark Card ─────────────────────────────────── */

export function RateBenchmarkCard({ result }: { result: Record<string, unknown> }) {
  const rate = result.market_rate as Record<string, unknown>;
  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      <p className="font-semibold mb-1">
        Rate benchmark — {String(result.tier)} tier
      </p>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="text-center">
          <p className="text-muted-foreground text-[10px]">Min</p>
          <p className="font-medium">
            {"\u20B9"}
            {(rate.min as number).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-[10px]">Median</p>
          <p className="font-semibold text-primary">
            {"\u20B9"}
            {(rate.median as number).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-[10px]">Max</p>
          <p className="font-medium">
            {"\u20B9"}
            {(rate.max as number).toLocaleString()}
          </p>
        </div>
      </div>
      {!!(
        result.brand_historical &&
        (result.brand_historical as Record<string, unknown>).avg_rate_paid
      ) && (
        <p className="text-muted-foreground mt-2 text-center">
          Your avg: {"\u20B9"}
          {(
            (result.brand_historical as Record<string, unknown>)
              .avg_rate_paid as number
          ).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/* ── Budget Card ─────────────────────────────────────────── */

export function BudgetCard({ result }: { result: Record<string, unknown> }) {
  const bs = result.budget_summary as Record<string, unknown>;
  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      <p className="font-semibold mb-2">Budget — {String(result.campaign)}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Total:</span>
        <span>
          {"\u20B9"}
          {(bs.total_budget as number).toLocaleString()}
        </span>
        <span className="text-muted-foreground">Confirmed:</span>
        <span>
          {"\u20B9"}
          {(bs.confirmed_spend as number).toLocaleString()}
        </span>
        <span className="text-muted-foreground">Available:</span>
        <span className="font-semibold">
          {"\u20B9"}
          {(bs.available_for_negotiation as number).toLocaleString()}
        </span>
        <span className="text-muted-foreground">Used:</span>
        <span>{String(bs.budget_used_percent)}%</span>
      </div>
      {Array.isArray(result.warnings) ? (
        <div className="mt-2 text-amber-600 dark:text-amber-400">
          {(result.warnings as string[]).map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Deal Memo Card ──────────────────────────────────────── */

export function DealMemoCard({ result }: { result: Record<string, unknown> }) {
  const memo = result.deal_memo as Record<string, unknown>;
  const terms = memo.terms as Record<string, unknown>;
  return (
    <div className="mt-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-xs">
      <p className="font-semibold text-green-700 dark:text-green-400 mb-1">
        Deal Memo —{" "}
        {String((memo.creator as Record<string, unknown>)?.handle)}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
        <span className="text-muted-foreground">Rate:</span>
        <span>
          {"\u20B9"}
          {(terms.agreed_rate as number).toLocaleString()}
        </span>
        <span className="text-muted-foreground">Usage:</span>
        <span>{String(terms.usage_rights)}</span>
        <span className="text-muted-foreground">Payment:</span>
        <span>{String(terms.payment_terms)}</span>
      </div>
    </div>
  );
}

/* ── ROI Card ────────────────────────────────────────────── */

export function ROICard({ result }: { result: Record<string, unknown> }) {
  const kpis = result.kpis as Record<string, unknown>;
  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      <p className="font-semibold mb-2">ROI — {String(result.campaign)}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Revenue:</span>
        <span>
          {"\u20B9"}
          {(kpis.total_revenue as number).toLocaleString()}
        </span>
        <span className="text-muted-foreground">Spend:</span>
        <span>
          {"\u20B9"}
          {(kpis.total_spend as number).toLocaleString()}
        </span>
        <span className="text-muted-foreground">Orders:</span>
        <span>{kpis.total_orders as number}</span>
        <span className="text-muted-foreground">ROI:</span>
        <span className="font-semibold text-primary">{String(kpis.roi)}x</span>
      </div>
    </div>
  );
}

/* ── Campaign Overview Card ──────────────────────────────── */

export function CampaignOverviewCard({
  result,
  compact,
}: {
  result: Record<string, unknown>;
  compact: boolean;
}) {
  const campaigns = result.campaigns as Array<Record<string, unknown>>;
  const limit = compact ? 3 : 6;
  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      <p className="font-semibold mb-2">
        {campaigns.length} Campaign{campaigns.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-2">
        {campaigns.slice(0, limit).map((c) => (
          <div
            key={String(c.id)}
            className="flex items-center justify-between border-b pb-1.5 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{String(c.name)}</p>
              {c.status != null ? (
                <StatusBadge status={String(c.status)} />
              ) : null}
            </div>
            {c.total_budget != null ? (
              <span className="shrink-0 text-muted-foreground">
                {"\u20B9"}
                {(c.total_budget as number).toLocaleString()}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Content Tracker Card ────────────────────────────────── */

export function ContentTrackerCard({
  result,
  compact,
}: {
  result: Record<string, unknown>;
  compact: boolean;
}) {
  const posts = result.posts as Array<Record<string, unknown>>;
  const limit = compact ? 3 : 6;
  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      <p className="font-semibold mb-2">
        {posts.length} Post{posts.length !== 1 ? "s" : ""} tracked
      </p>
      <div className="space-y-1.5">
        {posts.slice(0, limit).map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b pb-1 last:border-0 last:pb-0"
          >
            <span className="truncate">{String(p.caption || p.url || "Post")}</span>
            <div className="flex gap-2 shrink-0 text-muted-foreground">
              {p.likes != null && <span>{String(p.likes)} likes</span>}
              {p.comments != null && <span>{String(p.comments)} comments</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Shared badge components ─────────────────────────────── */

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    nano: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    micro:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    mid: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    macro:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    mega: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colors[tier] || "bg-muted text-muted-foreground"}`}
    >
      {tier}
    </span>
  );
}

function MatchBadge({ score }: { score: number }) {
  const color =
    score >= 0.8
      ? "text-green-600 dark:text-green-400"
      : score >= 0.6
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-muted-foreground";
  return (
    <span className={`font-medium ${color}`}>
      {Math.round(score * 100)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    draft: "bg-muted text-muted-foreground",
    paused:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    completed:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium mt-0.5 ${colors[status] || "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
