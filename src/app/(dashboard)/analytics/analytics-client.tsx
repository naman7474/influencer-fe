"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AnalyticsData {
  kpis: {
    totalSpend: number;
    totalRevenue: number;
    totalOrders: number;
    totalROI: number;
  };
  campaignComparison: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    revenue: number;
    orders: number;
    roi: number;
  }>;
  topCreators: Array<{
    handle: string;
    displayName: string | null;
    campaigns: number;
    revenue: number;
    orders: number;
    roi: number;
  }>;
  attributionMix: {
    discountOrders: number;
    utmOrders: number;
    bothOrders: number;
  };
}

interface AnalyticsClientProps {
  currency: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AnalyticsClient({ currency }: AnalyticsClientProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading analytics...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <BarChart3 className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No analytics data yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Analytics will appear here once campaigns start tracking orders.
        </p>
      </div>
    );
  }

  const { kpis, campaignComparison, topCreators, attributionMix } = data;
  const totalAttribOrders =
    attributionMix.discountOrders +
    attributionMix.utmOrders +
    attributionMix.bothOrders;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl tracking-tight">Analytics</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={<DollarSign className="size-5 text-primary" />}
          iconBg="bg-primary/10"
          label="Total Spend"
          value={formatCurrency(kpis.totalSpend, currency)}
        />
        <KPICard
          icon={<TrendingUp className="size-5 text-success" />}
          iconBg="bg-success/10"
          label="Total Revenue"
          value={formatCurrency(kpis.totalRevenue, currency)}
        />
        <KPICard
          icon={<BarChart3 className="size-5 text-info" />}
          iconBg="bg-info/10"
          label="Overall ROI"
          value={`${kpis.totalROI}x`}
        />
        <KPICard
          icon={<ShoppingCart className="size-5 text-warning" />}
          iconBg="bg-warning/10"
          label="Total Orders"
          value={kpis.totalOrders.toLocaleString()}
        />
      </div>

      {/* Campaign Comparison */}
      {campaignComparison.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium">Campaign Comparison</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignComparison
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(c.spend, currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatCurrency(c.revenue, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-mono text-[10px]",
                            c.roi >= 3
                              ? "badge-active"
                              : c.roi >= 1
                                ? "bg-warning/10 text-warning"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {c.roi}x
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "capitalize text-[10px]",
                            c.status === "active"
                              ? "badge-active"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top Creators */}
      {topCreators.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium flex items-center gap-2">
              <Users className="size-4" />
              Top Performing Creators
            </h3>
            <div className="space-y-2">
              {topCreators.map((c, i) => (
                <div
                  key={c.handle}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <span className="text-xs font-semibold text-muted-foreground w-5">
                    {i + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-handle text-sm">@{c.handle}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {c.campaigns} campaign{c.campaigns !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(c.revenue, currency)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "font-mono text-[10px]",
                      c.roi >= 3 ? "badge-active" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {c.roi}x
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attribution Mix */}
      {totalAttribOrders > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium">Attribution Mix</h3>
            <div className="space-y-2">
              <MixBar
                label="Discount Code"
                count={attributionMix.discountOrders}
                total={totalAttribOrders}
                color="bg-primary"
              />
              <MixBar
                label="UTM Tracked"
                count={attributionMix.utmOrders}
                total={totalAttribOrders}
                color="bg-info"
              />
              <MixBar
                label="Both Signals"
                count={attributionMix.bothOrders}
                total={totalAttribOrders}
                color="bg-success"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KPICard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg",
            iconBg
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-mono text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MixBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {count} orders ({Math.round(pct)}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
