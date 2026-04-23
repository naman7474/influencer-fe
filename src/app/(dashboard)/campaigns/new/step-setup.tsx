"use client";

import { useState } from "react";
import {
  ArrowRight,
  FileText,
  Target,
  IndianRupee,
  MapPin,
  Palette,
  Crown,
  Film,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/creator-profile/collapsible-section";

import {
  GOAL_OPTIONS,
  FORMAT_OPTIONS,
  TIER_OPTIONS,
  REGION_OPTIONS,
  NICHE_OPTIONS,
  toggleMulti,
  type WizardState,
} from "./wizard-types";

/* ------------------------------------------------------------------ */
/*  Region grouping                                                    */
/* ------------------------------------------------------------------ */

const METROS = [
  "Delhi NCR", "Mumbai", "Bangalore", "Hyderabad",
  "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur",
];
const STATES = [
  "Maharashtra", "Karnataka", "Tamil Nadu", "Kerala",
  "Uttar Pradesh", "Gujarat", "Rajasthan", "West Bengal",
  "Telangana", "Punjab",
];

const INITIAL_NICHE_COUNT = 6;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface StepSetupProps {
  form: WizardState;
  updateForm: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  hasBudgetDefaults: boolean;
  onNext: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StepSetup({ form, updateForm, hasBudgetDefaults, onNext }: StepSetupProps) {
  const canProceed = form.name.trim().length > 0;
  const [showAllNiches, setShowAllNiches] = useState(false);

  // Build targeting summary for collapsed state
  const targetingSummary = buildTargetingSummary(form);

  return (
    <div className="space-y-6">
      {/* ── Essentials (always visible) ── */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Basics</h2>
          </div>

          <div>
            <Label htmlFor="name">
              Campaign Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Diwali Festive Collection 2026"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Campaign goals, key messaging, dos & don'ts..."
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Campaign Goal */}
          <div>
            <Label className="flex items-center gap-1.5">
              <Target className="size-3.5 text-muted-foreground" />
              Campaign Goal
            </Label>
            <div className="grid gap-3 sm:grid-cols-3 mt-2">
              {GOAL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateForm("goal", opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                      form.goal === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-input hover:border-foreground/30 hover:bg-muted/50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-5",
                        form.goal === opt.value
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Budget & Timeline (collapsible) ── */}
      <Card>
        <CardContent className="py-0">
          <CollapsibleSection
            icon={<IndianRupee className="size-4 text-primary" />}
            title="Budget & Timeline"
            summary={buildBudgetSummary(form)}
            defaultOpen={hasBudgetDefaults || !!form.totalBudget}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="totalBudget">Total Budget</Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {"\u20B9"}
                    </span>
                    <Input
                      id="totalBudget"
                      type="number"
                      placeholder="e.g., 500000"
                      value={form.totalBudget}
                      onChange={(e) => updateForm("totalBudget", e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="budgetMin">Min per Creator</Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {"\u20B9"}
                    </span>
                    <Input
                      id="budgetMin"
                      type="number"
                      placeholder="e.g., 5000"
                      value={form.budgetPerCreatorMin}
                      onChange={(e) => updateForm("budgetPerCreatorMin", e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="budgetMax">Max per Creator</Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {"\u20B9"}
                    </span>
                    <Input
                      id="budgetMax"
                      type="number"
                      placeholder="e.g., 25000"
                      value={form.budgetPerCreatorMax}
                      onChange={(e) => updateForm("budgetPerCreatorMax", e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateForm("startDate", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => updateForm("endDate", e.target.value)}
                    className="mt-1"
                    min={form.startDate || undefined}
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </CardContent>
      </Card>

      {/* ── Targeting (collapsible, default closed) ── */}
      <Card>
        <CardContent className="py-0">
          <CollapsibleSection
            icon={<MapPin className="size-4 text-primary" />}
            title="Targeting"
            summary={targetingSummary || "No targeting set"}
            defaultOpen={form.targetRegions.length > 0 || form.targetNiches.length > 0}
          >
            <div className="space-y-5">
              {/* Target Regions — grouped */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  Target Regions
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Select metros or states where you want creator reach
                </p>

                {/* Pan India toggle */}
                <div className="mb-3">
                  <PillButton
                    label="Pan India"
                    selected={form.targetRegions.includes("Pan India")}
                    onClick={() =>
                      updateForm("targetRegions", toggleMulti(form.targetRegions, "Pan India"))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Metros */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Metros</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = METROS.every((m) => form.targetRegions.includes(m));
                          if (allSelected) {
                            updateForm("targetRegions", form.targetRegions.filter((r) => !METROS.includes(r)));
                          } else {
                            updateForm("targetRegions", [...new Set([...form.targetRegions, ...METROS])]);
                          }
                        }}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {METROS.every((m) => form.targetRegions.includes(m)) ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {METROS.map((r) => (
                        <PillButton
                          key={r}
                          label={r}
                          selected={form.targetRegions.includes(r)}
                          onClick={() => updateForm("targetRegions", toggleMulti(form.targetRegions, r))}
                        />
                      ))}
                    </div>
                  </div>

                  {/* States */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">States</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = STATES.every((s) => form.targetRegions.includes(s));
                          if (allSelected) {
                            updateForm("targetRegions", form.targetRegions.filter((r) => !STATES.includes(r)));
                          } else {
                            updateForm("targetRegions", [...new Set([...form.targetRegions, ...STATES])]);
                          }
                        }}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {STATES.every((s) => form.targetRegions.includes(s)) ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATES.map((r) => (
                        <PillButton
                          key={r}
                          label={r}
                          selected={form.targetRegions.includes(r)}
                          onClick={() => updateForm("targetRegions", toggleMulti(form.targetRegions, r))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Target Niches — show-more */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Palette className="size-3.5 text-muted-foreground" />
                  Creator Niches
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  What type of creators are you looking for?
                </p>
                <div className="flex flex-wrap gap-2">
                  {(showAllNiches ? NICHE_OPTIONS : NICHE_OPTIONS.slice(0, INITIAL_NICHE_COUNT)).map((n) => (
                    <PillButton
                      key={n}
                      label={n}
                      selected={form.targetNiches.includes(n)}
                      onClick={() => updateForm("targetNiches", toggleMulti(form.targetNiches, n))}
                    />
                  ))}
                  {!showAllNiches && NICHE_OPTIONS.length > INITIAL_NICHE_COUNT && (
                    <button
                      type="button"
                      onClick={() => setShowAllNiches(true)}
                      className="rounded-full border border-dashed border-input px-3 py-1 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                    >
                      +{NICHE_OPTIONS.length - INITIAL_NICHE_COUNT} more
                    </button>
                  )}
                </div>
              </div>

              {/* Creator Tiers */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Crown className="size-3.5 text-muted-foreground" />
                  Creator Tiers
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  What follower range fits your campaign?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier.value}
                      type="button"
                      onClick={() =>
                        updateForm("creatorTiers", toggleMulti(form.creatorTiers, tier.value))
                      }
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        form.creatorTiers.includes(tier.value)
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-input hover:border-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium block capitalize",
                          form.creatorTiers.includes(tier.value)
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {tier.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tier.range} followers
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Format */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Film className="size-3.5 text-muted-foreground" />
                  Content Format
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  What type of content do you want from creators?
                </p>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm("contentFormat", opt.value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        form.contentFormat === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-input hover:border-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium block",
                          form.contentFormat === opt.value
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {opt.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed} size="lg">
          Next: Add Creators
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PillButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-input text-muted-foreground hover:border-foreground/30",
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildTargetingSummary(form: WizardState): string {
  const parts: string[] = [];
  if (form.targetRegions.length > 0) {
    parts.push(`${form.targetRegions.length} region${form.targetRegions.length > 1 ? "s" : ""}`);
  }
  if (form.targetNiches.length > 0) {
    parts.push(`${form.targetNiches.length} niche${form.targetNiches.length > 1 ? "s" : ""}`);
  }
  if (form.creatorTiers.length > 0) {
    parts.push(form.creatorTiers.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("-"));
  }
  return parts.join(", ");
}

function buildBudgetSummary(form: WizardState): string {
  const parts: string[] = [];
  if (form.totalBudget) {
    parts.push(`\u20B9${parseFloat(form.totalBudget).toLocaleString("en-IN")}`);
  }
  if (form.startDate) {
    parts.push(new Date(form.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }));
    if (form.endDate) {
      parts[parts.length - 1] += ` – ${new Date(form.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;
    }
  }
  return parts.join(" | ") || "Not set";
}
