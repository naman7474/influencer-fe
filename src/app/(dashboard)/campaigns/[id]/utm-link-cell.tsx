"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function UtmLinkCell({
  campaignId,
  creatorId,
  initialLink,
}: {
  campaignId: string;
  creatorId: string;
  initialLink:
    | {
        id: string;
        full_url: string;
        orders_attributed: number;
        revenue_attributed: number;
      }
    | null
    | undefined;
}) {
  const [link, setLink] = useState(initialLink ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const createLink = () => {
    setNotice(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/v1/campaigns/${campaignId}/creators/${creatorId}/utm`,
        {
          method: "POST",
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error?.message ?? "Unable to generate UTM link.");
        return;
      }
      setLink(payload.data.utm_link);
      setNotice("UTM link ready.");
    });
  };

  const copyLink = async () => {
    if (!link?.full_url) {
      return;
    }
    await navigator.clipboard.writeText(link.full_url);
    setNotice("Copied.");
  };

  return (
    <div className="space-y-2">
      {link?.full_url ? (
        <>
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="truncate text-xs font-medium text-foreground">
              {link.full_url}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {link.orders_attributed ?? 0} orders ·{" "}
              {formatCurrency(link.revenue_attributed ?? 0)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button size="sm" variant="outline" onClick={createLink} disabled={isPending}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={createLink} disabled={isPending}>
          <Link2 className="h-3.5 w-3.5" />
          Generate UTM
        </Button>
      )}
      {notice ? <p className="text-[11px] text-muted-foreground">{notice}</p> : null}
    </div>
  );
}
