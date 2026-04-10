"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Camera } from "lucide-react";
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GeoLiftData {
  hasPreSnapshot: boolean;
  hasPostSnapshot: boolean;
  regions: Array<{
    city: string;
    state: string;
    sessionLift: number | null;
    orderLift: number | null;
    revenueLift: number | null;
    postRevenue: number;
    preRevenue: number;
    status: "lift" | "mild" | "flat";
  }>;
}

interface GeographicLiftWidgetProps {
  campaignId: string;
  campaignStatus: string;
  currency: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GeographicLiftWidget({
  campaignId,
  campaignStatus,
  currency,
}: GeographicLiftWidgetProps) {
  const [data, setData] = useState<GeoLiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/geographic-lift`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSnapshot = useCallback(
    async (type: "pre_campaign" | "post_campaign") => {
      setSnapshotting(true);
      try {
        const res = await fetch(
          `/api/campaigns/${campaignId}/geographic-lift`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type }),
          }
        );
        if (res.ok) {
          await fetchData();
        }
      } catch {
        // Silently fail
      } finally {
        setSnapshotting(false);
      }
    },
    [campaignId, fetchData]
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading geographic data...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="size-4" />
            Geographic Impact
          </h3>
          <div className="flex items-center gap-2">
            {!data?.hasPreSnapshot && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSnapshot("pre_campaign")}
                disabled={snapshotting}
              >
                <Camera className="size-3.5 mr-1" />
                Snapshot Baseline
              </Button>
            )}
            {data?.hasPreSnapshot &&
              !data?.hasPostSnapshot &&
              (campaignStatus === "completed" ||
                campaignStatus === "active") && (
                <Button
                  size="sm"
                  onClick={() => handleSnapshot("post_campaign")}
                  disabled={snapshotting}
                >
                  <Camera className="size-3.5 mr-1" />
                  Measure Lift
                </Button>
              )}
          </div>
        </div>

        {!data?.hasPreSnapshot && (
          <p className="text-sm text-muted-foreground">
            Take a baseline snapshot before the campaign starts to measure
            geographic lift later.
          </p>
        )}

        {data?.hasPreSnapshot && !data?.hasPostSnapshot && (
          <div className="rounded-lg border border-info/30 bg-info/5 p-3">
            <p className="text-sm text-info">
              Baseline snapshot captured. Click &quot;Measure Lift&quot; after
              the campaign ends to see geographic impact.
            </p>
          </div>
        )}

        {data?.regions && data.regions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.regions.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    {r.city || r.state || "Unknown"}
                  </TableCell>
                  <TableCell className="text-right">
                    <LiftBadge value={r.sessionLift} />
                  </TableCell>
                  <TableCell className="text-right">
                    <LiftBadge value={r.orderLift} />
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    +{formatCurrency(
                      Math.max(0, r.postRevenue - r.preRevenue),
                      currency
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LiftBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span>--</span>;
  const isPositive = value > 0;
  return (
    <span
      className={cn(
        "text-xs font-mono",
        isPositive ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {isPositive ? "+" : ""}
      {Math.round(value)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    lift: { label: "Lift", className: "badge-active" },
    mild: { label: "Mild", className: "bg-warning/10 text-warning" },
    flat: { label: "Flat", className: "bg-muted text-muted-foreground" },
  };
  const c = config[status] ?? config.flat;
  return (
    <Badge variant="secondary" className={cn("text-[10px]", c.className)}>
      {c.label}
    </Badge>
  );
}
