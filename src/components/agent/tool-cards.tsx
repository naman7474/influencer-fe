"use client";

import { NegotiationCard } from "./negotiation-card";

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

  if (name === "creator_search" && result?.results) {
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

export function CreatorSearchCard({
  result,
  compact,
}: {
  result: Record<string, unknown>;
  compact: boolean;
}) {
  const creators = result.results as Array<Record<string, unknown>>;
  const limit = compact ? 5 : 10;

  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">
          Found {String(result.count)} creators
        </p>
        {result.total_in_database != null &&
          Number(result.total_in_database) > Number(result.count) ? (
            <span className="text-muted-foreground">
              {String(result.total_in_database)} total matches
            </span>
          ) : null}
      </div>
      <div className="space-y-1.5">
        {creators.slice(0, limit).map((c) => (
          <div
            key={String(c.id)}
            className="flex items-center justify-between border-b pb-1.5 last:border-0 last:pb-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {String(c.handle)?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <span className="font-mono font-medium block truncate">
                  @{String(c.handle)}
                </span>
                {!compact && c.display_name ? (
                  <span className="text-muted-foreground text-[10px] block truncate">
                    {String(c.display_name)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
              <span>
                {((c.followers as number) / 1000).toFixed(1)}K
              </span>
              <TierBadge tier={String(c.tier)} />
              {c.cpi_score != null ? (
                <span className="font-medium text-foreground">
                  CPI:{String(c.cpi_score)}
                </span>
              ) : null}
              {c.match_score != null ? (
                <MatchBadge score={Number(c.match_score)} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {creators.length > limit && (
        <p className="text-muted-foreground mt-2 text-center">
          +{creators.length - limit} more
        </p>
      )}
    </div>
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
