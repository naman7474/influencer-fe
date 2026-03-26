"use client";

import { useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function PerformanceTab({
  campaignId,
  summary,
  creators,
  regions,
  timeSeries,
}: {
  campaignId: string;
  summary: {
    total_orders_attributed?: number;
    total_revenue_attributed?: number;
    total_creator_cost?: number;
    overall_roi?: number | null;
    last_attribution_at?: string | null;
  };
  creators: Array<{
    id: string;
    campaign_orders: number;
    campaign_revenue: number;
    creator_cost: number | null;
    roi_ratio: number | null;
    campaign_creator?: {
      creator?: {
        handle: string;
        display_name: string | null;
      } | null;
    } | null;
  }>;
  regions: Array<{
    region: string;
    baseline_revenue: number;
    campaign_revenue: number;
  }>;
  timeSeries: Array<{
    snapshot_date: string;
    revenue: number;
    orders: number;
    roi: number | null;
  }>;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshAttribution = () => {
    setNotice(null);
    startTransition(async () => {
      const response = await fetch(`/api/v1/campaigns/${campaignId}/performance/refresh`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error?.message ?? "Unable to queue attribution refresh.");
        return;
      }
      setNotice("Attribution refresh queued.");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Performance</p>
          <p className="text-sm text-muted-foreground">
            Revenue, orders, ROI, and regional lift from campaign attribution.
          </p>
        </div>
        <Button variant="outline" onClick={refreshAttribution} disabled={isPending}>
          <RefreshCcw className="h-4 w-4" />
          Refresh attribution
        </Button>
      </div>

      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Revenue</CardDescription>
            <CardTitle>{formatCurrency(summary.total_revenue_attributed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Orders</CardDescription>
            <CardTitle>{summary.total_orders_attributed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>ROI</CardDescription>
            <CardTitle>
              {summary.overall_roi != null ? `${summary.overall_roi.toFixed(2)}x` : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Avg CPA</CardDescription>
            <CardTitle>
              {summary.total_orders_attributed
                ? formatCurrency(
                    Number(summary.total_creator_cost ?? 0) /
                      Number(summary.total_orders_attributed)
                  )
                : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Revenue over time</CardTitle>
            <CardDescription>
              Daily snapshots of attributed revenue and orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {timeSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="snapshot_date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} />
                  <Line type="monotone" dataKey="orders" stroke="#1d4ed8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No performance snapshots yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader>
            <CardTitle>Regional lift</CardTitle>
            <CardDescription>
              Campaign revenue against the baseline brand geo revenue.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {regions.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regions}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="region" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="baseline_revenue" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="campaign_revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No regional performance rows yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border bg-card">
        <CardHeader>
          <CardTitle>Per-creator performance</CardTitle>
          <CardDescription>
            Revenue, attributed orders, and ROI by creator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creators.length ? (
                creators.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.campaign_creator?.creator?.display_name ??
                        row.campaign_creator?.creator?.handle ??
                        "Unknown"}
                    </TableCell>
                    <TableCell>{row.campaign_orders ?? 0}</TableCell>
                    <TableCell>{formatCurrency(row.campaign_revenue)}</TableCell>
                    <TableCell>{formatCurrency(row.creator_cost)}</TableCell>
                    <TableCell>
                      {row.roi_ratio != null ? `${row.roi_ratio.toFixed(2)}x` : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No creator attribution rows yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
