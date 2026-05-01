"use client";

import * as React from "react";
import {
  Search,
  ChevronDown,
  X,
  Check,
  Sparkles,
  Users,
  Clapperboard,
  Gauge,
  Building2,
} from "lucide-react";

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

/* ─── Static option lists ────────────────────────────────────── */

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
  "Education",
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

const CTA_STYLES = [
  { value: "", label: "Any CTA style" },
  { value: "link_in_bio", label: "Link in bio" },
  { value: "swipe_up", label: "Swipe up" },
  { value: "comment_below", label: "Comment below" },
  { value: "dm_for_info", label: "DM for info" },
  { value: "follow_for_more", label: "Follow for more" },
  { value: "none", label: "No explicit CTA" },
];

/* ─── Quick-pick presets ────────────────────────────────────── */

interface Preset {
  id: string;
  label: string;
  description: string;
  apply: (current: DiscoveryFilters) => Partial<DiscoveryFilters>;
}

const PRESETS: Preset[] = [
  {
    id: "hidden-gems",
    label: "Hidden gems",
    description: "High ER, smaller audience",
    apply: () => ({
      minEngagementRate: 5,
      tiers: ["nano", "micro"],
    }),
  },
  {
    id: "brand-aware",
    label: "Brand-aware",
    description: "Mentions brands organically",
    apply: () => ({
      // Setting `mentionsBrand` to a special wildcard would need RPC support;
      // instead we drive this via the higher minCpi + conversion flag combo
      // until we wire a "any organic mention" flag.
      isConversionOriented: true,
      minAuthenticity: 70,
    }),
  },
  {
    id: "strong-hook",
    label: "Strong hooks",
    description: "Hook quality ≥ 0.7",
    apply: () => ({
      minHookQuality: 0.7,
    }),
  },
  {
    id: "conversion-led",
    label: "Conversion-led",
    description: "Drives specific actions",
    apply: () => ({
      isConversionOriented: true,
      minEngagementRate: 3,
    }),
  },
];

/* ─── Component ─────────────────────────────────────────────── */

interface FilterBarProps {
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
  sort: SortOption;
  onSortChange: (next: SortOption) => void;
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

  /* Per-section active-counts for the section-button badges. */
  const activeCounts = React.useMemo(() => {
    return {
      audience:
        (filters.audienceCountry.trim() ? 1 : 0) +
        (filters.audienceLanguages.length > 0 ? 1 : 0) +
        (filters.minAuthenticity > 0 ? 1 : 0) +
        (filters.location.trim() ? 1 : 0),
      content:
        (filters.niches.length > 0 ? 1 : 0) +
        (filters.estimatedRegion.trim() ? 1 : 0) +
        (filters.contentFormats.length > 0 ? 1 : 0) +
        (filters.minHookQuality > 0 ? 1 : 0),
      performance:
        ((filters.minFollowers > 0 || filters.maxFollowers < 1_000_000) ? 1 : 0) +
        (filters.tiers.length > 0 ? 1 : 0) +
        (filters.minCpi > 0 ? 1 : 0) +
        (filters.minEngagementRate > 0 ? 1 : 0),
      brandFit:
        (filters.mentionsBrand.trim() ? 1 : 0) +
        (filters.isConversionOriented !== null ? 1 : 0) +
        (filters.dominantCtaStyle.trim() ? 1 : 0) +
        (filters.maxEngagementBait < 1 ? 1 : 0) +
        (filters.verifiedOnly ? 1 : 0) +
        (filters.hasContact ? 1 : 0),
    };
  }, [filters]);

  const totalActive =
    activeCounts.audience +
    activeCounts.content +
    activeCounts.performance +
    activeCounts.brandFit +
    (filters.search.trim() ? 1 : 0) +
    (filters.platform !== "all" ? 1 : 0);

  /* Build the array of active-filter chips (drives the bottom row). */
  const activeChips = React.useMemo(() => buildActiveChips(filters), [filters]);

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* ── Row 1: Search box + sort + result count ─────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Smart search — try 'creators who do NEET prep' or 'home cooking shorts'…"
            className="h-10 rounded-xl border-border bg-card pl-9"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
          {filters.search.trim() && (
            <span
              className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-canva-purple-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canva-purple"
              title="Hybrid retrieval: BM25 (lexical) + vector embeddings, fused with RRF"
            >
              <Sparkles className="size-2.5" /> Smart
            </span>
          )}
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
          <span className="font-bold text-foreground">20K+</span> creators
        </span>
      </div>

      {/* ── Row 2: Quick-pick presets ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Quick picks
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange({ ...filters, ...preset.apply(filters) })}
            title={preset.description}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-card px-2.5 py-1 text-[11.5px] font-bold text-foreground transition-colors hover:border-canva-purple/40 hover:bg-canva-purple-soft hover:text-canva-purple"
          >
            <Sparkles className="size-3" />
            {preset.label}
          </button>
        ))}
      </div>

      {/* ── Row 3: Platform + Section buttons + Clear-all ─── */}
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

        {/* Audience section */}
        <SectionButton
          icon={<Users className="size-3.5" />}
          label="Audience"
          activeCount={activeCounts.audience}
        >
          <div className="flex w-[280px] flex-col gap-3 p-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Audience country
              </Label>
              <Input
                placeholder="e.g. India"
                value={filters.audienceCountry}
                onChange={(e) => update({ audienceCountry: e.target.value })}
                className="mt-1.5 h-9"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Audience languages
              </Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {LANGUAGES.map((lang) => (
                  <label key={lang} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={filters.audienceLanguages.includes(lang)}
                      onCheckedChange={() =>
                        toggleArrayItem("audienceLanguages", lang)
                      }
                    />
                    <span className="text-sm">{lang}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Authenticity floor
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
                className="mt-2"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>≥ {filters.minAuthenticity}%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Creator location
              </Label>
              <Input
                placeholder="City or country…"
                value={filters.location}
                onChange={(e) => update({ location: e.target.value })}
                className="mt-1.5 h-9"
              />
            </div>
          </div>
        </SectionButton>

        {/* Content section */}
        <SectionButton
          icon={<Clapperboard className="size-3.5" />}
          label="Content"
          activeCount={activeCounts.content}
        >
          <div className="flex w-[280px] flex-col gap-3 p-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Niche
              </Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {NICHES.map((n) => (
                  <label key={n} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={filters.niches.includes(n)}
                      onCheckedChange={() => toggleArrayItem("niches", n)}
                    />
                    <span className="text-sm">{n}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Region (state-level)
              </Label>
              <Input
                placeholder="e.g. North India, Maharashtra"
                value={filters.estimatedRegion}
                onChange={(e) => update({ estimatedRegion: e.target.value })}
                className="mt-1.5 h-9"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Format
              </Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
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
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Min hook quality
              </Label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[filters.minHookQuality]}
                onValueChange={(val) => {
                  const v = Array.isArray(val) ? val[0] : val;
                  update({ minHookQuality: v });
                }}
                className="mt-2"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>≥ {filters.minHookQuality.toFixed(2)}</span>
                <span>1.00</span>
              </div>
            </div>
          </div>
        </SectionButton>

        {/* Performance section */}
        <SectionButton
          icon={<Gauge className="size-3.5" />}
          label="Performance"
          activeCount={activeCounts.performance}
        >
          <div className="flex w-[280px] flex-col gap-3 p-3">
            <div>
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
                className="mt-2"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{fmtFollowers(filters.minFollowers)}</span>
                <span>{fmtFollowers(filters.maxFollowers)}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tier
              </Label>
              <div className="mt-1.5 flex flex-col gap-1">
                {TIERS.map((t) => (
                  <label key={t.value} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={filters.tiers.includes(t.value)}
                      onCheckedChange={() => toggleArrayItem("tiers", t.value)}
                    />
                    <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
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
                className="mt-2"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>≥ {filters.minEngagementRate}%</span>
                <span>15%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Min CPI
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
                className="mt-2"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>≥ {filters.minCpi}</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </SectionButton>

        {/* Brand fit section */}
        <SectionButton
          icon={<Building2 className="size-3.5" />}
          label="Brand fit"
          activeCount={activeCounts.brandFit}
        >
          <div className="flex w-[280px] flex-col gap-3 p-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Mentions a brand organically
              </Label>
              <Input
                placeholder="e.g. NCERT, Lakme"
                value={filters.mentionsBrand}
                onChange={(e) => update({ mentionsBrand: e.target.value })}
                className="mt-1.5 h-9"
              />
              <div className="mt-1 text-[10.5px] text-muted-foreground">
                Exact name as it appears in captions
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Conversion-oriented
              </Label>
              <div className="mt-1.5 inline-flex overflow-hidden rounded-lg border border-border">
                {[
                  { val: null, label: "Any" },
                  { val: true, label: "Yes" },
                  { val: false, label: "No" },
                ].map(({ val, label }) => {
                  const isActive = filters.isConversionOriented === val;
                  return (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => update({ isConversionOriented: val })}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-colors",
                        isActive
                          ? "bg-canva-purple-soft text-canva-purple"
                          : "bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                CTA style
              </Label>
              <Select
                value={filters.dominantCtaStyle}
                onValueChange={(v) => update({ dominantCtaStyle: v ?? "" })}
              >
                <SelectTrigger size="sm" className="mt-1.5 h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CTA_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Max engagement bait
              </Label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[filters.maxEngagementBait]}
                onValueChange={(val) => {
                  const v = Array.isArray(val) ? val[0] : val;
                  update({ maxEngagementBait: v });
                }}
                className="mt-2"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>0</span>
                <span>≤ {filters.maxEngagementBait.toFixed(2)}</span>
              </div>
              <div className="mt-1 text-[10.5px] text-muted-foreground">
                Lower is better — filters out fake-giveaway / tag-friends creators
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border pt-3">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={filters.verifiedOnly}
                  onCheckedChange={(v) => update({ verifiedOnly: !!v })}
                />
                <span className="text-sm">Verified only</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={filters.hasContact}
                  onCheckedChange={(v) => update({ hasContact: !!v })}
                />
                <span className="text-sm">Has contact</span>
              </label>
            </div>
          </div>
        </SectionButton>

        {totalActive > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
            className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-canva-purple hover:bg-canva-purple-soft"
          >
            <X className="size-3.5" />
            Clear all ({totalActive})
          </button>
        )}
      </div>

      {/* ── Row 4: Active-filter chips ─────────────────────── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() =>
                onChange({ ...filters, ...chip.clear })
              }
              className="inline-flex items-center gap-1 rounded-full bg-canva-purple-soft px-2.5 py-1 text-[11.5px] font-bold text-canva-purple transition-colors hover:bg-canva-purple/20"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */

function SectionButton({
  icon,
  label,
  activeCount,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  activeCount: number;
  children: React.ReactNode;
}) {
  const isActive = activeCount > 0;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
              isActive
                ? "border-canva-purple bg-canva-purple-soft text-canva-purple"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          />
        }
      >
        {icon}
        {label}
        {activeCount > 0 && (
          <span
            aria-label={`${activeCount} active filter${activeCount === 1 ? "" : "s"}`}
            className="grid h-4 min-w-[16px] place-items-center rounded-full bg-canva-purple px-1 text-[9.5px] font-extrabold text-white"
          >
            {activeCount}
          </span>
        )}
        <ChevronDown className="size-3.5 opacity-70" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Active-filter-chip helpers ────────────────────────────── */

interface ActiveChip {
  key: string;
  label: string;
  /** Filter patch that, when applied, removes this filter only. */
  clear: Partial<DiscoveryFilters>;
}

function buildActiveChips(filters: DiscoveryFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (filters.platform !== "all") {
    chips.push({
      key: "platform",
      label: `Platform: ${filters.platform === "instagram" ? "Instagram" : "YouTube"}`,
      clear: { platform: "all" },
    });
  }
  if (filters.minFollowers > 0 || filters.maxFollowers < 1_000_000) {
    chips.push({
      key: "followers",
      label: `Followers: ${fmtFollowers(filters.minFollowers)}–${fmtFollowers(filters.maxFollowers)}`,
      clear: { minFollowers: 0, maxFollowers: 1_000_000 },
    });
  }
  if (filters.tiers.length > 0) {
    chips.push({
      key: "tiers",
      label: `Tier: ${filters.tiers.join(", ")}`,
      clear: { tiers: [] },
    });
  }
  if (filters.niches.length > 0) {
    chips.push({
      key: "niches",
      label: `Niche: ${filters.niches.join(", ")}`,
      clear: { niches: [] },
    });
  }
  if (filters.minCpi > 0) {
    chips.push({
      key: "minCpi",
      label: `CPI ≥ ${filters.minCpi}`,
      clear: { minCpi: 0 },
    });
  }
  if (filters.minEngagementRate > 0) {
    chips.push({
      key: "minER",
      label: `ER ≥ ${filters.minEngagementRate}%`,
      clear: { minEngagementRate: 0 },
    });
  }
  if (filters.minAuthenticity > 0) {
    chips.push({
      key: "minAuth",
      label: `Auth ≥ ${filters.minAuthenticity}%`,
      clear: { minAuthenticity: 0 },
    });
  }
  if (filters.location.trim()) {
    chips.push({
      key: "location",
      label: `Loc: ${filters.location.trim()}`,
      clear: { location: "" },
    });
  }
  if (filters.audienceLanguages.length > 0) {
    chips.push({
      key: "audLang",
      label: `Speaks: ${filters.audienceLanguages.join(", ")}`,
      clear: { audienceLanguages: [] },
    });
  }
  if (filters.contentFormats.length > 0) {
    chips.push({
      key: "formats",
      label: `Format: ${filters.contentFormats.join(", ")}`,
      clear: { contentFormats: [] },
    });
  }
  if (filters.estimatedRegion.trim()) {
    chips.push({
      key: "region",
      label: `Region: ${filters.estimatedRegion.trim()}`,
      clear: { estimatedRegion: "" },
    });
  }
  if (filters.audienceCountry.trim()) {
    chips.push({
      key: "audCountry",
      label: `Audience in ${filters.audienceCountry.trim()}`,
      clear: { audienceCountry: "" },
    });
  }
  if (filters.mentionsBrand.trim()) {
    chips.push({
      key: "mentionsBrand",
      label: `Mentions: ${filters.mentionsBrand.trim()}`,
      clear: { mentionsBrand: "" },
    });
  }
  if (filters.minHookQuality > 0) {
    chips.push({
      key: "minHook",
      label: `Hook ≥ ${filters.minHookQuality.toFixed(2)}`,
      clear: { minHookQuality: 0 },
    });
  }
  if (filters.maxEngagementBait < 1) {
    chips.push({
      key: "maxBait",
      label: `Bait ≤ ${filters.maxEngagementBait.toFixed(2)}`,
      clear: { maxEngagementBait: 1 },
    });
  }
  if (filters.isConversionOriented !== null) {
    chips.push({
      key: "conv",
      label: filters.isConversionOriented
        ? "Conversion-led"
        : "Awareness-led",
      clear: { isConversionOriented: null },
    });
  }
  if (filters.dominantCtaStyle.trim()) {
    chips.push({
      key: "cta",
      label: `CTA: ${filters.dominantCtaStyle.replace(/_/g, " ")}`,
      clear: { dominantCtaStyle: "" },
    });
  }
  if (filters.verifiedOnly) {
    chips.push({
      key: "verified",
      label: "Verified",
      clear: { verifiedOnly: false },
    });
  }
  if (filters.hasContact) {
    chips.push({
      key: "hasContact",
      label: "Has contact",
      clear: { hasContact: false },
    });
  }

  return chips;
}
