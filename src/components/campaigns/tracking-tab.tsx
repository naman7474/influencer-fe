"use client";

import { useState, useCallback } from "react";
import {
  Link2,
  Copy,
  Check,
  Loader2,
  Wand2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CampaignUtmLink } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DiscountCode {
  id: string;
  campaign_id: string;
  campaign_creator_id: string;
  creator_id: string;
  code: string;
  shopify_discount_id: string | null;
  discount_percentage: number;
  usage_count: number;
  revenue_attributed: number;
  is_active: boolean;
  created_at: string;
  creator?: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface CreatorInfo {
  creator_id: string;
  creator: { handle: string };
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TrackingTabProps {
  campaignId: string;
  currency: string;
  initialUtmLinks: CampaignUtmLink[];
  initialDiscountCodes: DiscountCode[];
  defaultDiscountPercentage: number;
  creators: CreatorInfo[];
  hasConfirmedCreators: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TrackingTab({
  campaignId,
  currency,
  initialUtmLinks,
  initialDiscountCodes,
  defaultDiscountPercentage,
  creators,
  hasConfirmedCreators,
}: TrackingTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // UTM state
  const [generatedLinks, setGeneratedLinks] = useState(initialUtmLinks);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Discount code state
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(initialDiscountCodes);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [codeGenError, setCodeGenError] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(defaultDiscountPercentage);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const handleGenerateUTMs = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/utm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Failed to generate UTM links");
      } else {
        window.location.reload();
      }
    } catch {
      setGenError("Failed to generate UTM links. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [campaignId]);

  const handleGenerateDiscountCodes = useCallback(async () => {
    setGeneratingCodes(true);
    setCodeGenError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/discount-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPercent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeGenError(data.error ?? "Failed to generate discount codes");
      } else {
        const codesRes = await fetch(`/api/campaigns/${campaignId}/discount-codes`);
        const codesData = await codesRes.json();
        if (codesRes.ok) {
          setDiscountCodes(codesData.codes ?? []);
        }
      }
    } catch {
      setCodeGenError("Failed to generate discount codes. Please try again.");
    } finally {
      setGeneratingCodes(false);
    }
  }, [campaignId, discountPercent]);

  const handleDeactivateCode = useCallback(async (codeId: string) => {
    try {
      const res = await fetch(`/api/discount-codes/${codeId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDiscountCodes((prev) =>
          prev.map((c) => (c.id === codeId ? { ...c, is_active: false } : c)),
        );
      }
    } catch {
      // Silently fail — user can retry
    }
  }, []);

  if (!hasConfirmedCreators) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <Link2 className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">
          No confirmed creators yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          UTM links and discount codes will appear here once creators
          are confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* UTM Links */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">UTM Links</h3>
            <Button
              size="sm"
              onClick={handleGenerateUTMs}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              {generating
                ? "Generating..."
                : generatedLinks.length > 0
                  ? "Regenerate UTMs"
                  : "Generate UTM Links"}
            </Button>
          </div>
          {genError && (
            <p className="text-sm text-destructive">{genError}</p>
          )}
          {generatedLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No UTM links generated yet. Click the button above to generate unique tracking links for each confirmed creator.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Creator</TableHead>
                    <TableHead className="w-[160px]">Short URL</TableHead>
                    <TableHead>Full URL</TableHead>
                    <TableHead className="text-right w-[90px]">
                      Clicks
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedLinks.map((link) => {
                    const creator = creators.find(
                      (c) => c.creator_id === link.creator_id,
                    );
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const linkAny = link as any;
                    const shortUrl = linkAny.short_url as string | undefined;
                    const clickCount = (linkAny.click_count ?? 0) as number;
                    const copyTarget = shortUrl ?? link.full_url ?? "";
                    return (
                      <TableRow key={link.id}>
                        <TableCell>
                          <span className="font-handle text-sm">
                            {creator
                              ? `@${creator.creator.handle}`
                              : "General"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {shortUrl ? (
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                              {shortUrl}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-0">
                          <p
                            className="truncate font-mono text-[11px] text-muted-foreground"
                            title={link.full_url ?? ""}
                          >
                            {link.full_url}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-mono text-sm tabular-nums",
                              clickCount > 0
                                ? "text-foreground font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            {clickCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => copyToClipboard(copyTarget, link.id)}
                            aria-label="Copy link"
                          >
                            {copiedId === link.id ? (
                              <Check className="size-3 text-success" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount Codes */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Discount Codes</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">
                Default discount:
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-14 rounded border bg-background px-2 py-1 text-xs"
              />
              <span className="text-xs text-muted-foreground">% off</span>
              <Button
                size="sm"
                onClick={handleGenerateDiscountCodes}
                disabled={generatingCodes}
              >
                {generatingCodes ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                {generatingCodes
                  ? "Generating..."
                  : discountCodes.length > 0
                    ? "Generate Missing Codes"
                    : "Generate Codes"}
              </Button>
            </div>
          </div>
          {codeGenError && (
            <p className="text-sm text-destructive">{codeGenError}</p>
          )}
          {discountCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No discount codes generated yet. Click the button above
              to auto-generate Shopify discount codes for each
              confirmed creator.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountCodes.map((dc) => (
                  <TableRow key={dc.id}>
                    <TableCell>
                      <span className="font-handle text-sm">
                        @{dc.creator?.handle ?? "unknown"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                          {dc.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            copyToClipboard(dc.code, `disc-${dc.id}`)
                          }
                        >
                          {copiedId === `disc-${dc.id}` ? (
                            <Check className="size-3 text-success" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {dc.usage_count}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(dc.revenue_attributed, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          dc.is_active
                            ? "badge-active"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {dc.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dc.is_active && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDeactivateCode(dc.id)}
                          title="Deactivate code"
                        >
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
