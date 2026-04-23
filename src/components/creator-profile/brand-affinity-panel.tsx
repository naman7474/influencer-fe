"use client";

import { Heart, Megaphone, Tag } from "lucide-react";
import type { CaptionIntelligence, CreatorScore } from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BrandAffinityPanelProps {
  caption: CaptionIntelligence | null;
  scores: CreatorScore | null;
}

export function BrandAffinityPanel({ caption, scores }: BrandAffinityPanelProps) {
  const organic = caption?.organic_brand_mentions ?? [];
  const paid = caption?.paid_brand_mentions ?? [];
  const categories = caption?.brand_categories ?? [];
  const total =
    scores?.brand_mentions_count ??
    (organic.length + paid.length || null);

  const hasAny =
    organic.length > 0 ||
    paid.length > 0 ||
    categories.length > 0 ||
    (total != null && total > 0);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Tag className="size-4 text-primary" />
            Brand History
          </span>
          {total != null && (
            <span className="text-[11px] font-normal text-muted-foreground">
              {total} total mention{total === 1 ? "" : "s"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No brand mentions detected yet.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Organic — the trust signal */}
              <Column
                icon={<Heart className="size-3.5 text-success" />}
                title="Organic"
                subtitle="Mentioned without #ad"
                brands={organic}
                emptyText="No organic mentions detected"
                variant="success"
              />

              {/* Paid — the commercial signal */}
              <Column
                icon={<Megaphone className="size-3.5 text-primary" />}
                title="Paid / Sponsored"
                subtitle="Declared partnerships"
                brands={paid}
                emptyText="No paid partnerships detected"
                variant="primary"
              />
            </div>

            {categories.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Brand Categories
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <Badge key={c} variant="outline" className="text-[11px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Column({
  icon,
  title,
  subtitle,
  brands,
  emptyText,
  variant,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  brands: string[];
  emptyText: string;
  variant: "success" | "primary";
}) {
  const bg = variant === "success" ? "bg-success/5" : "bg-primary/5";
  const ring = variant === "success" ? "ring-success/15" : "ring-primary/15";

  return (
    <div className={`rounded-lg ${bg} p-3 ring-1 ${ring}`}>
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-[11px] font-medium text-muted-foreground">
          {brands.length}
        </span>
      </div>
      <p className="mb-2 text-[10px] text-muted-foreground">{subtitle}</p>
      {brands.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {brands.map((b) => (
            <Badge
              key={b}
              variant={variant === "success" ? "secondary" : "outline"}
              className="text-[11px]"
            >
              {b}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
