"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Download,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PerformanceData {
  kpis: {
    totalSpend: number;
    totalRevenue: number;
    totalOrders: number;
    totalROI: number;
  };
  attribution: {
    discountOrders: number;
    utmOrders: number;
    bothOrders: number;
  };
  timeseries: Array<{
    date: string;
    total: number;
    discount: number;
    utm: number;
  }>;
  perCreator: Array<{
    campaignCreatorId: string;
    handle: string;
    displayName: string | null;
    spent: number;
    orders: number;
    revenue: number;
    roi: number;
    clicks: number;
  }>;
  topProducts: Array<{
    title: string;
    quantity: number;
    revenue: number;
  }>;
}

interface PerformanceTabProps {
  campaignId: string;
  currency: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PIE_COLORS = ["#6366F1", "#3B82F6", "#10B981"];

type SortField = "roi" | "revenue" | "orders" | "clicks" | "spent";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PerformanceTab({ campaignId, currency }: PerformanceTabProps) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>("roi");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/performance`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading performance data...
        </div>
      </div>
    );
  }

  if (!data || data.kpis.totalOrders === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <BarChart3 className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">
          No attribution data yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance data will appear here once orders are attributed via
          discount codes or UTM links.
        </p>
      </div>
    );
  }

  const { kpis, attribution, timeseries, perCreator, topProducts } = data;

  const sortedCreators = [...perCreator].sort((a, b) => {
    switch (sortBy) {
      case "roi":
        return b.roi - a.roi;
      case "revenue":
        return b.revenue - a.revenue;
      case "orders":
        return b.orders - a.orders;
      case "clicks":
        return b.clicks - a.clicks;
      case "spent":
        return b.spent - a.spent;
      default:
        return 0;
    }
  });

  const pieData = [
    { name: "Discount Code", value: attribution.discountOrders },
    { name: "UTM Tracked", value: attribution.utmOrders },
    { name: "Both Signals", value: attribution.bothOrders },
  ].filter((d) => d.value > 0);

  const handleExportCSV = () => {
    const headers = "Creator,Spent,Orders,Revenue,ROI,Clicks";
    const rows = sortedCreators
      .map(
        (c) =>
          `@${c.handle},${c.spent},${c.orders},${c.revenue},${c.roi}x,${c.clicks}`
      )
      .join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-performance-${campaignId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
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
          label="Revenue"
          value={formatCurrency(kpis.totalRevenue, currency)}
        />
        <KPICard
          icon={<BarChart3 className="size-5 text-info" />}
          iconBg="bg-info/10"
          label="ROI"
          value={`${kpis.totalROI}x`}
        />
        <KPICard
          icon={<ShoppingCart className="size-5 text-warning" />}
          iconBg="bg-warning/10"
          label="Orders"
          value={kpis.totalOrders.toLocaleString()}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Attribution Breakdown */}
        {pieData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent>
              <h3 className="mb-3 text-sm font-medium">
                Attribution Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs text-muted-foreground">
                        {value}
                      </span>
                    )}
                  />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [
                      `${value} orders`,
                      "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Revenue Over Time */}
        {timeseries.length > 0 && (
          <Card className={pieData.length > 0 ? "lg:col-span-3" : "lg:col-span-5"}>
            <CardContent>
              <h3 className="mb-3 text-sm font-medium">Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d: string) =>
                      new Date(d).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) =>
                      `${(v / 1000).toFixed(0)}K`
                    }
                  />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) =>
                      formatCurrency(Number(value), currency)
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    labelFormatter={(label: any) =>
                      new Date(String(label)).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#6366F1"
                    strokeWidth={2}
                    dot={false}
                    name="Total"
                  />
                  <Line
                    type="monotone"
                    dataKey="discount"
                    stroke="#10B981"
                    strokeWidth={1}
                    dot={false}
                    strokeDasharray="4 4"
                    name="Discount Code"
                  />
                  <Line
                    type="monotone"
                    dataKey="utm"
                    stroke="#3B82F6"
                    strokeWidth={1}
                    dot={false}
                    strokeDasharray="4 4"
                    name="UTM"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Per-Creator Performance Table */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Per-Creator Performance</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort:</span>
              {(["roi", "revenue", "orders", "clicks", "spent"] as SortField[]).map(
                (field) => (
                  <Button
                    key={field}
                    variant={sortBy === field ? "default" : "ghost"}
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setSortBy(field)}
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={handleExportCSV}
              >
                <Download className="size-3 mr-1" />
                CSV
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCreators.map((c) => (
                <TableRow key={c.campaignCreatorId}>
                  <TableCell>
                    <span className="font-handle text-sm">@{c.handle}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(c.spent, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {c.orders}
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
                            : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {c.roi}x
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {c.clicks}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium">Top Products Sold</h3>
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <Package className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {p.quantity} units
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(p.revenue, currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
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
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
