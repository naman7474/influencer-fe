"use client";

import { useCallback } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { DiscoveryFilters } from "@/lib/queries/creators";
import { DEFAULT_FILTERS } from "@/lib/queries/creators";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TIERS = [
  { value: "nano", label: "Nano (1K-10K)" },
  { value: "micro", label: "Micro (10K-50K)" },
  { value: "mid", label: "Mid (50K-500K)" },
  { value: "macro", label: "Macro (500K-1M)" },
  { value: "mega", label: "Mega (1M+)" },
];

const NICHES = [
  "Beauty",
  "Fitness",
  "Fashion",
  "Food",
  "Tech",
  "Lifestyle",
  "Wellness",
  "Other",
];

const LANGUAGES = [
  "Hindi",
  "English",
  "Telugu",
  "Tamil",
  "Bengali",
  "Marathi",
  "Other",
];

const CONTENT_FORMATS = ["Reels", "Carousel", "Static"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatFollowerLabel(n: number): string {
  if (n >= 1_000_000) return "1M+";
  if (n >= 1_000) return `${n / 1_000}K`;
  return n.toString();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface FilterSidebarProps {
  filters: DiscoveryFilters;
  onChange: (filters: DiscoveryFilters) => void;
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const update = useCallback(
    (patch: Partial<DiscoveryFilters>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange],
  );

  const toggleArrayItem = useCallback(
    (key: keyof DiscoveryFilters, item: string) => {
      const arr = filters[key] as string[];
      const next = arr.includes(item)
        ? arr.filter((i) => i !== item)
        : [...arr, item];
      update({ [key]: next });
    },
    [filters, update],
  );

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-card px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
            className="text-xs text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-5 px-4 pt-4">
        {/* ── Follower Range ── */}
        <FilterSection title="Follower Range">
          <div className="space-y-2">
            <Slider
              min={0}
              max={1_000_000}
              step={10_000}
              value={[filters.minFollowers, filters.maxFollowers]}
              onValueChange={(val) => {
                const v = Array.isArray(val) ? val : [val];
                update({ minFollowers: v[0], maxFollowers: v[1] ?? v[0] });
              }}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{formatFollowerLabel(filters.minFollowers)}</span>
              <span>{formatFollowerLabel(filters.maxFollowers)}</span>
            </div>
          </div>
        </FilterSection>

        {/* ── Creator Tier ── */}
        <FilterSection title="Creator Tier">
          <div className="space-y-2">
            {TIERS.map((tier) => (
              <label
                key={tier.value}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={filters.tiers.includes(tier.value)}
                  onCheckedChange={() => toggleArrayItem("tiers", tier.value)}
                />
                <span className="text-sm text-foreground">{tier.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* ── CPI Score ── */}
        <FilterSection title="CPI Score">
          <div className="space-y-2">
            <Slider
              min={0}
              max={100}
              step={1}
              value={[filters.minCpi]}
              onValueChange={(val) => {
                const v = Array.isArray(val) ? val[0] : val;
                update({ minCpi: v });
              }}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Min: {filters.minCpi}</span>
              <span>100</span>
            </div>
          </div>
        </FilterSection>

        {/* ── Niche ── */}
        <FilterSection title="Niche">
          <div className="space-y-2">
            {NICHES.map((niche) => (
              <label
                key={niche}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={filters.niches.includes(niche)}
                  onCheckedChange={() => toggleArrayItem("niches", niche)}
                />
                <span className="text-sm text-foreground">{niche}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* ── Location ── */}
        <FilterSection title="Location">
          <Input
            placeholder="City or country..."
            value={filters.location}
            onChange={(e) => update({ location: e.target.value })}
          />
        </FilterSection>

        {/* ── Audience Language ── */}
        <FilterSection title="Audience Language">
          <div className="space-y-2">
            {LANGUAGES.map((lang) => (
              <label
                key={lang}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={filters.audienceLanguages.includes(lang)}
                  onCheckedChange={() =>
                    toggleArrayItem("audienceLanguages", lang)
                  }
                />
                <span className="text-sm text-foreground">{lang}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* ── Engagement Rate ── */}
        <FilterSection title="Engagement Rate">
          <div className="space-y-2">
            <Slider
              min={0}
              max={15}
              step={0.5}
              value={[filters.minEngagementRate]}
              onValueChange={(val) => {
                const v = Array.isArray(val) ? val[0] : val;
                update({ minEngagementRate: v });
              }}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Min: {filters.minEngagementRate}%</span>
              <span>15%</span>
            </div>
          </div>
        </FilterSection>

        {/* ── Authenticity ── */}
        <FilterSection title="Authenticity">
          <div className="space-y-2">
            <Slider
              min={0}
              max={100}
              step={1}
              value={[filters.minAuthenticity]}
              onValueChange={(val) => {
                const v = Array.isArray(val) ? val[0] : val;
                update({ minAuthenticity: v });
              }}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Min: {filters.minAuthenticity}%</span>
              <span>100%</span>
            </div>
          </div>
        </FilterSection>

        {/* ── Content Format ── */}
        <FilterSection title="Content Format">
          <div className="space-y-2">
            {CONTENT_FORMATS.map((fmt) => (
              <label
                key={fmt}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  checked={filters.contentFormats.includes(fmt)}
                  onCheckedChange={() =>
                    toggleArrayItem("contentFormats", fmt)
                  }
                />
                <span className="text-sm text-foreground">{fmt}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* ── Verified Only ── */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Verified Only
          </Label>
          <Switch
            checked={filters.verifiedOnly}
            onCheckedChange={(checked: boolean) =>
              update({ verifiedOnly: checked })
            }
          />
        </div>

        {/* ── Has Contact ── */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Has Contact
          </Label>
          <Switch
            checked={filters.hasContact}
            onCheckedChange={(checked: boolean) =>
              update({ hasContact: checked })
            }
          />
        </div>

        {/* ── Clear All ── */}
        {hasActiveFilters && (
          <>
            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onChange({ ...DEFAULT_FILTERS })}
            >
              <X className="size-3.5" />
              Clear All Filters
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}
