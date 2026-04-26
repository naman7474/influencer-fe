"use client";

import * as React from "react";
import {
  MousePointerClick,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatFollowers } from "@/lib/format";

interface PerformanceKPIs {
  totalSpend: number;
  totalRevenue: number;
  totalOrders: number;
  totalROI: number;
}

interface PerformancePerCreator {
  clicks: number;
  spent: number;
  revenue: number;
  orders: number;
}

interface FunnelCounts {
  shortlisted: number;
  outreach_sent: number;
  negotiating: number;
  confirmed: number;
  content_live: number;
  completed: number;
  declined: number;
}

interface CampaignAnalyticsStripProps {
  campaignId: string;
  currency: string;
  budget: number | null;
  funnel: FunnelCounts;
  totalCreators: number;
}

interface PerformanceResponse {
  kpis: PerformanceKPIs;
  perCreator: PerformancePerCreator[];
}

const FUNNEL_STEPS: { key: keyof FunnelCounts; label: string; dot: string }[] = [
  { key: "shortlisted", label: "Shortlisted", dot: "bg-muted-foreground/50" },
  { key: "outreach_sent", label: "Outreach", dot: "bg-info" },
  { key: "negotiating", label: "Negotiating", dot: "bg-warning" },
  { key: "confirmed", label: "Confirmed", dot: "bg-success" },
  { key: "content_live", label: "Live", dot: "bg-canva-purple" },
  { key: "completed", label: "Completed", dot: "bg-success/70" },
];

export function CampaignAnalyticsStrip({
  campaignId,
  currency,
  budget,
  funnel,
  totalCreators,
}: CampaignAnalyticsStripProps) {
  const [perf, setPerf] = React.useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/performance`);
        if (!res.ok) {
          if (!cancelled) setPerf(null);
          return;
        }
        const data = (await res.json()) as PerformanceResponse;
        if (!cancelled) setPerf(data);
      } catch (err) {
        console.error("performance fetch:", err);
        if (!cancelled) setPerf(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const totalClicks =
    perf?.perCreator.reduce((sum, c) => sum + (c.clicks ?? 0), 0) ?? 0;
  const orders = perf?.kpis.totalOrders ?? 0;
  const revenue = perf?.kpis.totalRevenue ?? 0;
  const roi = perf?.kpis.totalROI ?? 0;
  const spend = perf?.kpis.totalSpend ?? 0;
  const budgetPct =
    budget && budget > 0 ? Math.min(Math.round((spend / budget) * 100), 999) : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={<MousePointerClick className="size-3.5" />}
          label="Clicks"
          value={loading ? "—" : formatFollowers(totalClicks)}
          accent="text-canva-purple"
        />
        <Kpi
          icon={<ShoppingBag className="size-3.5" />}
          label="Orders"
          value={loading ? "—" : orders.toLocaleString()}
          accent="text-canva-teal"
        />
        <Kpi
          icon={<Wallet className="size-3.5" />}
          label="Revenue"
          value={loading ? "—" : formatCurrency(revenue, currency)}
          accent="text-success"
        />
        <Kpi
          icon={<TrendingUp className="size-3.5" />}
          label="ROI"
          value={
            loading ? "—" : roi > 0 ? `${roi.toFixed(1)}×` : "—"
          }
          accent={roi >= 1 ? "text-success" : "text-muted-foreground"}
          sub={
            spend > 0
              ? `${formatCurrency(spend, currency)} spent${
                  budgetPct != null ? ` · ${budgetPct}% of budget` : ""
                }`
              : undefined
          }
        />
      </div>

      {totalCreators > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span className="font-bold uppercase tracking-wide text-foreground/70">
            Funnel
          </span>
          {FUNNEL_STEPS.map((step) => (
            <span key={step.key} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", step.dot)} />
              <span>{step.label}</span>
              <b className="tabular-nums text-foreground">
                {funnel[step.key] ?? 0}
              </b>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide", accent)}>
        {icon}
        {label}
      </div>
      <div className="font-heading text-xl font-extrabold leading-tight text-foreground">
        {value}
      </div>
      {sub && (
        <div className="text-[10px] leading-snug text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}
