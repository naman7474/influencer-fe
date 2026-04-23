"use client";

import {
  ArrowLeft,
  Loader2,
  Users,
  Target,
  IndianRupee,
  CalendarDays,
  Film,
  Zap,
} from "lucide-react";
import { formatFollowers } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { WizardState, SelectedCreator } from "./wizard-types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface StepReviewProps {
  form: WizardState;
  selectedCreators: SelectedCreator[];
  totalEstimated: number;
  saving: boolean;
  onBack: () => void;
  onSubmit: (status: "draft" | "active") => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StepReview({
  form,
  selectedCreators,
  totalEstimated,
  saving,
  onBack,
  onSubmit,
}: StepReviewProps) {
  return (
    <div className="space-y-6">
      {/* 2-column layout */}
      <div className="flex gap-4">
        {/* ── Left: Campaign details (60%) ── */}
        <div className="flex-[3] min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Campaign Details</h2>
              </div>

              {/* Name + description */}
              <div>
                <h3 className="font-semibold text-lg">{form.name}</h3>
                {form.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {form.description}
                  </p>
                )}
              </div>

              {/* Key details grid */}
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <DetailRow
                  icon={<Target className="size-3.5" />}
                  label="Goal"
                  value={form.goal.replace("_", " ")}
                  capitalize
                />
                <DetailRow
                  icon={<IndianRupee className="size-3.5" />}
                  label="Budget"
                  value={
                    form.totalBudget
                      ? `\u20B9${parseFloat(form.totalBudget).toLocaleString("en-IN")}`
                      : "Not set"
                  }
                />
                <DetailRow
                  icon={<IndianRupee className="size-3.5" />}
                  label="Per Creator"
                  value={
                    form.budgetPerCreatorMin || form.budgetPerCreatorMax
                      ? `\u20B9${form.budgetPerCreatorMin || "0"} \u2013 \u20B9${form.budgetPerCreatorMax || "0"}`
                      : "Not set"
                  }
                />
                <DetailRow
                  icon={<CalendarDays className="size-3.5" />}
                  label="Dates"
                  value={formatDateRange(form.startDate, form.endDate)}
                />
                <DetailRow
                  icon={<Film className="size-3.5" />}
                  label="Format"
                  value={form.contentFormat}
                  capitalize
                />
                <DetailRow
                  icon={<Users className="size-3.5" />}
                  label="Creators"
                  value={`${selectedCreators.length} selected`}
                />
              </div>

              {/* Targeting tags */}
              {(form.targetRegions.length > 0 ||
                form.targetNiches.length > 0 ||
                form.creatorTiers.length > 0) && (
                <div className="space-y-2 border-t pt-3">
                  {form.targetRegions.length > 0 && (
                    <TagRow label="Regions" items={form.targetRegions} />
                  )}
                  {form.targetNiches.length > 0 && (
                    <TagRow label="Niches" items={form.targetNiches} />
                  )}
                  {form.creatorTiers.length > 0 && (
                    <TagRow label="Tiers" items={form.creatorTiers} capitalize />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Selected creators mini-list (40%) ── */}
        <div className="flex-[2] min-w-0">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Creators ({selectedCreators.length})
                </h3>
                {totalEstimated > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Est.{" "}
                    <span className="font-semibold text-foreground">
                      {"\u20B9"}{totalEstimated.toLocaleString("en-IN")}
                    </span>
                  </span>
                )}
              </div>

              {selectedCreators.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No creators selected
                </p>
              ) : (
                <ScrollArea className="max-h-[calc(100vh-380px)]">
                  <div className="space-y-0.5">
                    {selectedCreators.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                      >
                        <Avatar className="size-6 shrink-0">
                          {c.avatar_url && (
                            <AvatarImage src={c.avatar_url} alt={c.handle} />
                          )}
                          <AvatarFallback className="text-[9px]">
                            {c.handle.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-handle text-xs truncate text-foreground">
                            @{c.handle}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                          {c.followers != null && (
                            <span>{formatFollowers(c.followers)}</span>
                          )}
                          {c.tier && (
                            <Badge
                              variant="secondary"
                              className="capitalize text-[9px] px-1.5 py-0"
                            >
                              {c.tier}
                            </Badge>
                          )}
                          {c.matchScore != null && (
                            <Badge className="text-[9px] px-1.5 py-0">
                              {c.matchScore}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Sticky CTA bar ── */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-sm border-t flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onSubmit("draft")}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save as Draft"
            )}
          </Button>
          <Button
            onClick={() => onSubmit("active")}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Launch Campaign
                <Zap className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DetailRow({
  icon,
  label,
  value,
  capitalize: cap,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className={cap ? "font-medium capitalize" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

function TagRow({
  label,
  items,
  capitalize: cap,
}: {
  label: string;
  items: string[];
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">{label}:</span>
      {items.map((item) => (
        <Badge
          key={item}
          variant="secondary"
          className={cap ? "text-[10px] capitalize" : "text-[10px]"}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateRange(start: string, end: string): string {
  if (!start) return "TBD";
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  let result = new Date(start).toLocaleDateString("en-IN", opts);
  if (end) {
    result += ` \u2013 ${new Date(end).toLocaleDateString("en-IN", opts)}`;
  }
  return result;
}
