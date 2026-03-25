"use client";

import type { ReactNode } from "react";
import { ArrowUpDown, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatNumber,
  humanize,
  NICHES,
  TIER_LABELS,
  TONES,
  TREND_CONFIG,
} from "@/lib/constants";
import type { CreatorFilters } from "@/lib/queries/creators";

interface FilterPanelProps {
  filters: CreatorFilters;
  onChange: (filters: Partial<CreatorFilters>) => void;
  onReset: () => void;
}

const FOLLOWER_MAX = 1_500_000;
const ENGAGEMENT_MAX = 12;
const FIELD_CLASSNAME =
  "h-9 rounded-lg border-border bg-background text-sm";

export function FilterPanel({
  filters,
  onChange,
  onReset,
}: FilterPanelProps) {
  const followerRange = [
    filters.minFollowers ?? 0,
    filters.maxFollowers ?? FOLLOWER_MAX,
  ];
  const cpiRange = [filters.minCPI ?? 0, filters.maxCPI ?? 100];
  const engagementRange = [
    filters.minEngagement ?? 0,
    filters.maxEngagement ?? ENGAGEMENT_MAX,
  ];
  const authenticityRange = [
    filters.minAuthenticity ?? 0,
    filters.maxAuthenticity ?? 100,
  ];

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              Filters
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
              Narrow the creator list
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-300 bg-white"
              onClick={() =>
                onChange({
                  sortDir: filters.sortDir === "asc" ? "desc" : "asc",
                })
              }
            >
              <ArrowUpDown className="h-4 w-4" />
              {filters.sortDir === "asc" ? "Ascending" : "Descending"}
            </Button>
            <Button
              variant="outline"
              className="border-slate-300 bg-white"
              onClick={onReset}
            >
              <FilterX className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.8fr))]">
          <div>
            <FieldLabel>Search</FieldLabel>
            <Input
              placeholder="Handle, name, or keyword"
              value={filters.search ?? ""}
              onChange={(event) =>
                onChange({ search: event.target.value || undefined })
              }
              className={FIELD_CLASSNAME}
            />
          </div>

          <SelectField
            label="Niche"
            value={filters.niche ?? "all"}
            onValueChange={(value) =>
              onChange({ niche: value === "all" ? undefined : value })
            }
            placeholder="All niches"
            options={NICHES.map((niche) => ({
              value: niche,
              label: humanize(niche),
            }))}
          />

          <SelectField
            label="Tone"
            value={filters.tone ?? "all"}
            onValueChange={(value) =>
              onChange({ tone: value === "all" ? undefined : value })
            }
            placeholder="All tones"
            options={TONES.map((tone) => ({
              value: tone,
              label: humanize(tone),
            }))}
          />

          <SelectField
            label="Creator tier"
            value={filters.tier ?? "all"}
            onValueChange={(value) =>
              onChange({ tier: value === "all" ? undefined : value })
            }
            placeholder="All tiers"
            options={Object.entries(TIER_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          <SelectField
            label="Sort by"
            value={filters.sortBy ?? "cpi"}
            onValueChange={(value) => onChange({ sortBy: value })}
            placeholder="CPI"
            includeAll={false}
            options={[
              { value: "cpi", label: "CPI score" },
              { value: "engagement", label: "Engagement rate" },
              { value: "followers", label: "Followers" },
              { value: "authenticity", label: "Audience authenticity" },
            ]}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <RangeBlock
            label="Follower range"
            valueLabel={`${formatNumber(followerRange[0])} - ${formatNumber(followerRange[1])}`}
          >
            <Slider
              value={followerRange}
              min={0}
              max={FOLLOWER_MAX}
              step={10_000}
              onValueCommitted={(value) => {
                if (!Array.isArray(value)) return;
                onChange({
                  minFollowers: value[0],
                  maxFollowers: value[1],
                });
              }}
            />
          </RangeBlock>

          <RangeBlock
            label="CPI range"
            valueLabel={`${cpiRange[0]} - ${cpiRange[1]}`}
          >
            <Slider
              value={cpiRange}
              min={0}
              max={100}
              step={1}
              onValueCommitted={(value) => {
                if (!Array.isArray(value)) return;
                onChange({
                  minCPI: value[0],
                  maxCPI: value[1],
                });
              }}
            />
          </RangeBlock>

          <RangeBlock
            label="Engagement rate"
            valueLabel={`${engagementRange[0].toFixed(1)}% - ${engagementRange[1].toFixed(1)}%`}
          >
            <Slider
              value={engagementRange}
              min={0}
              max={ENGAGEMENT_MAX}
              step={0.1}
              onValueCommitted={(value) => {
                if (!Array.isArray(value)) return;
                onChange({
                  minEngagement: value[0],
                  maxEngagement: value[1],
                });
              }}
            />
          </RangeBlock>

          <RangeBlock
            label="Audience authenticity"
            valueLabel={`${authenticityRange[0]}% - ${authenticityRange[1]}%`}
          >
            <Slider
              value={authenticityRange}
              min={0}
              max={100}
              step={1}
              onValueCommitted={(value) => {
                if (!Array.isArray(value)) return;
                onChange({
                  minAuthenticity: value[0],
                  maxAuthenticity: value[1],
                });
              }}
            />
          </RangeBlock>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_0.9fr_0.9fr]">
          <div>
            <FieldLabel>Audience country</FieldLabel>
            <Input
              placeholder="India, UAE, Singapore..."
              value={filters.audienceCountry ?? ""}
              onChange={(event) =>
                onChange({
                  audienceCountry: event.target.value || undefined,
                })
              }
              className={FIELD_CLASSNAME}
            />
          </div>

          <SelectField
            label="Momentum"
            value={filters.trend ?? "all"}
            onValueChange={(value) =>
              onChange({ trend: value === "all" ? undefined : value })
            }
            placeholder="Any trend"
            options={Object.entries(TREND_CONFIG).map(([value, config]) => ({
              value,
              label: `${config.icon} ${config.label}`,
            }))}
          />

          <div className="rounded-lg border bg-muted/50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <FieldLabel className="mb-1">Verified only</FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Prefer accounts with platform verification.
                </p>
              </div>
              <Checkbox
                id="verified"
                checked={filters.verified ?? false}
                onCheckedChange={(checked) =>
                  onChange({ verified: checked === true ? true : undefined })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FieldLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`mb-2 block text-xs font-medium text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  placeholder,
  includeAll = true,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  includeAll?: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue ?? "all")}>
        <SelectTrigger className={FIELD_CLASSNAME}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {includeAll && <SelectItem value="all">All</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RangeBlock({
  label,
  valueLabel,
  children,
}: {
  label: string;
  valueLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/50 px-3 py-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <FieldLabel className="mb-0">{label}</FieldLabel>
        <span className="text-sm font-medium text-slate-700">{valueLabel}</span>
      </div>
      <div className="px-1">{children}</div>
    </div>
  );
}
