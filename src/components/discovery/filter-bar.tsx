"use client";

import * as React from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  type DiscoveryFilters,
  type SortOption,
  type PlatformFilter,
} from "@/lib/queries/creators";

const TIERS = [
  { value: "nano", label: "Nano · 1-10K" },
  { value: "micro", label: "Micro · 10-50K" },
  { value: "mid", label: "Mid · 50-500K" },
  { value: "macro", label: "Macro · 500K-1M" },
  { value: "mega", label: "Mega · 1M+" },
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

const PLATFORMS: { id: PlatformFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
];

interface FilterBarProps {
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
  sort: SortOption;
  onSortChange: (next: SortOption) => void;
  resultCount: number | null;
}

function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return "1M+";
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

export function FilterBar({
  filters,
  onChange,
  sort,
  onSortChange,
  resultCount,
}: FilterBarProps) {
  const update = React.useCallback(
    (patch: Partial<DiscoveryFilters>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange],
  );

  const toggleArrayItem = React.useCallback(
    (key: keyof DiscoveryFilters, item: string) => {
      const arr = filters[key] as string[];
      const next = arr.includes(item)
        ? arr.filter((i) => i !== item)
        : [...arr, item];
      update({ [key]: next });
    },
    [filters, update],
  );

  const hasAnyActive =
    filters.search.trim() !== "" ||
    filters.platform !== "all" ||
    filters.minFollowers > 0 ||
    filters.maxFollowers < 1_000_000 ||
    filters.tiers.length > 0 ||
    filters.niches.length > 0 ||
    filters.minCpi > 0 ||
    filters.minEngagementRate > 0 ||
    filters.minAuthenticity > 0 ||
    filters.location.trim() !== "" ||
    filters.audienceLanguages.length > 0 ||
    filters.contentFormats.length > 0 ||
    filters.verifiedOnly ||
    filters.hasContact;

  const followersLabel =
    filters.minFollowers > 0 || filters.maxFollowers < 1_000_000
      ? `${fmtFollowers(filters.minFollowers)}–${fmtFollowers(filters.maxFollowers)}`
      : "Followers";
  const tierLabel =
    filters.tiers.length === 0
      ? "Tier"
      : filters.tiers.length === 1
        ? filters.tiers[0][0].toUpperCase() + filters.tiers[0].slice(1)
        : `${filters.tiers.length} tiers`;
  const nicheLabel =
    filters.niches.length === 0
      ? "Niche"
      : filters.niches.length === 1
        ? filters.niches[0]
        : `${filters.niches.length} niches`;
  const erLabel =
    filters.minEngagementRate > 0 ? `ER ≥ ${filters.minEngagementRate}%` : "Engagement";
  const cpiLabel = filters.minCpi > 0 ? `CPI ≥ ${filters.minCpi}` : "CPI";
  const authLabel =
    filters.minAuthenticity > 0
      ? `Authentic ≥ ${filters.minAuthenticity}%`
      : "Authenticity";
  const locationLabel = filters.location.trim()
    ? `“${filters.location.trim()}”`
    : "Location";
  const langLabel =
    filters.audienceLanguages.length === 0
      ? "Languages"
      : filters.audienceLanguages.length === 1
        ? filters.audienceLanguages[0]
        : `${filters.audienceLanguages.length} languages`;
  const formatLabel =
    filters.contentFormats.length === 0
      ? "Format"
      : filters.contentFormats.length === 1
        ? filters.contentFormats[0]
        : `${filters.contentFormats.length} formats`;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Row 1 — Search + Sort + result count */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search creators by name, niche, location..."
            className="h-10 rounded-xl border-border bg-card pl-9"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger size="sm" className="h-10 w-[180px] rounded-xl border-border bg-card">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {resultCount == null ? (
            "Searching…"
          ) : (
            <>
              <span className="font-bold text-foreground">
                {resultCount.toLocaleString()}
              </span>{" "}
              creators
            </>
          )}
        </span>
      </div>

      {/* Row 2 — All filters inline */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Platform — segmented control */}
        <div
          role="tablist"
          aria-label="Platform"
          className="inline-flex overflow-hidden rounded-xl border border-border bg-card"
        >
          {PLATFORMS.map((p) => {
            const isActive = filters.platform === p.id;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => update({ platform: p.id })}
                className={cn(
                  "px-3.5 py-2 text-xs font-bold transition-colors",
                  isActive
                    ? "text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={
                  isActive ? { background: "var(--gradient-canva)" } : undefined
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <FilterPill
          label={followersLabel}
          active={filters.minFollowers > 0 || filters.maxFollowers < 1_000_000}
        >
          <div className="flex w-[260px] flex-col gap-3 p-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Follower range
            </Label>
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
              <span>{fmtFollowers(filters.minFollowers)}</span>
              <span>{fmtFollowers(filters.maxFollowers)}</span>
            </div>
          </div>
        </FilterPill>

        <FilterPill label={tierLabel} active={filters.tiers.length > 0}>
          <div className="flex w-[220px] flex-col gap-2 p-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Creator tier
            </Label>
            {TIERS.map((t) => {
              const checked = filters.tiers.includes(t.value);
              return (
                <label key={t.value} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleArrayItem("tiers", t.value)}
                  />
                  <span className="text-sm">{t.label}</span>
                </label>
              );
            })}
          </div>
        </FilterPill>

        <FilterPill label={nicheLabel} active={filters.niches.length > 0}>
          <div className="grid w-[260px] grid-cols-2 gap-1.5 p-3">
            {NICHES.map((n) => {
              const checked = filters.niches.includes(n);
              return (
                <label key={n} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleArrayItem("niches", n)}
                  />
                  <span className="text-sm">{n}</span>
                </label>
              );
            })}
          </div>
        </FilterPill>

        <FilterPill label={erLabel} active={filters.minEngagementRate > 0}>
          <div className="flex w-[220px] flex-col gap-3 p-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Min engagement rate
            </Label>
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
              <span>≥ {filters.minEngagementRate}%</span>
              <span>15%</span>
            </div>
          </div>
        </FilterPill>

        <FilterPill label={cpiLabel} active={filters.minCpi > 0}>
          <div className="flex w-[220px] flex-col gap-3 p-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Min CPI score
            </Label>
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
              <span>≥ {filters.minCpi}</span>
              <span>100</span>
            </div>
          </div>
        </FilterPill>

        <FilterPill label={authLabel} active={filters.minAuthenticity > 0}>
          <div className="flex w-[220px] flex-col gap-3 p-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Min authenticity
            </Label>
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
              <span>≥ {filters.minAuthenticity}%</span>
              <span>100%</span>
            </div>
          </div>
        </FilterPill>

        <FilterPill label={locationLabel} active={!!filters.location.trim()}>
          <div className="flex w-[240px] flex-col gap-2 p-3">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Location
            </Label>
            <Input
              placeholder="City or country..."
              value={filters.location}
              onChange={(e) => update({ location: e.target.value })}
              className="h-9"
            />
          </div>
        </FilterPill>

        <FilterPill label={langLabel} active={filters.audienceLanguages.length > 0}>
          <div className="grid w-[240px] grid-cols-2 gap-1.5 p-3">
            {LANGUAGES.map((lang) => (
              <label key={lang} className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={filters.audienceLanguages.includes(lang)}
                  onCheckedChange={() => toggleArrayItem("audienceLanguages", lang)}
                />
                <span className="text-sm">{lang}</span>
              </label>
            ))}
          </div>
        </FilterPill>

        <FilterPill label={formatLabel} active={filters.contentFormats.length > 0}>
          <div className="flex w-[220px] flex-wrap gap-1.5 p-3">
            {CONTENT_FORMATS.map((fmt) => {
              const checked = filters.contentFormats.includes(fmt);
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => toggleArrayItem("contentFormats", fmt)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                    checked
                      ? "border-canva-purple bg-canva-purple-soft text-canva-purple"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {checked && <Check className="size-3" />}
                  {fmt}
                </button>
              );
            })}
          </div>
        </FilterPill>

        <TogglePill
          label="Verified"
          active={filters.verifiedOnly}
          onClick={() => update({ verifiedOnly: !filters.verifiedOnly })}
        />
        <TogglePill
          label="Has contact"
          active={filters.hasContact}
          onClick={() => update({ hasContact: !filters.hasContact })}
        />

        {hasAnyActive && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
            className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-canva-purple hover:bg-canva-purple-soft"
          >
            <X className="size-3.5" />
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
              active
                ? "border-canva-purple bg-canva-purple-soft text-canva-purple"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          />
        }
      >
        {label}
        <ChevronDown className="size-3.5 opacity-70" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
        active
          ? "border-canva-purple bg-canva-purple-soft text-canva-purple"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full border",
          active ? "border-canva-purple bg-canva-purple" : "border-border",
        )}
      />
      {label}
    </button>
  );
}
