import * as React from "react";

import type { AudienceIntelligence } from "@/lib/types/database";
import {
  resolveZone,
  ZONE_LABELS,
  type IndiaZone,
} from "@/lib/geo/india";

import { SectionCard } from "./section-card";
import { EmptyCard } from "./empty-card";

interface AudienceTabProps {
  audience: AudienceIntelligence | null;
  accent: string;
}

interface GeoRegion {
  region: string;
  percentage: number;
}

function parseGeoRegions(value: unknown): GeoRegion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Record<string, unknown>;
      const region = (e.region ?? e.country ?? e.name ?? e.label) as
        | string
        | undefined;
      const pct = (e.percentage ?? e.pct ?? e.share ?? e.value) as
        | number
        | string
        | undefined;
      if (!region || pct == null) return null;
      const n = typeof pct === "string" ? parseFloat(pct) : pct;
      if (!Number.isFinite(n)) return null;
      return { region, percentage: n <= 1 ? n * 100 : n };
    })
    .filter((x): x is GeoRegion => x != null)
    .sort((a, b) => b.percentage - a.percentage);
}

const ZONE_ORDER: IndiaZone[] = ["north", "south", "east", "west"];
const ZONE_COLOR: Record<IndiaZone, string> = {
  north: "var(--canva-purple)",
  south: "var(--canva-teal)",
  east: "var(--canva-pink)",
  west: "var(--canva-yellow)",
};

function bucketIntoZones(
  geo: GeoRegion[],
): { zones: Record<IndiaZone, number>; mapped: number; total: number } {
  const zones: Record<IndiaZone, number> = { north: 0, south: 0, east: 0, west: 0 };
  let mapped = 0;
  let total = 0;
  for (const g of geo) {
    total += g.percentage;
    const zone = resolveZone(g.region);
    if (zone) {
      zones[zone] += g.percentage;
      mapped += g.percentage;
    }
  }
  return { zones, mapped, total };
}

function GeoCard({
  audience,
  accent,
}: {
  audience: AudienceIntelligence | null;
  accent: string;
}) {
  const geo = parseGeoRegions(audience?.geo_regions ?? null);
  if (!geo.length) {
    return (
      <SectionCard
        title="Where they watch from"
        subtitle="Top regions by audience share"
      >
        <EmptyCard title="No geographic signals available" />
      </SectionCard>
    );
  }
  const { zones, mapped } = bucketIntoZones(geo);
  // Show the zone breakdown only if at least one entry mapped to an India zone.
  const showZones = mapped > 0;
  // Normalize zone shares relative to the mapped portion so they sum to 100%.
  const zoneNorm: Record<IndiaZone, number> = { north: 0, south: 0, east: 0, west: 0 };
  if (showZones) {
    for (const z of ZONE_ORDER) {
      zoneNorm[z] = mapped > 0 ? Math.round((zones[z] / mapped) * 100) : 0;
    }
  }
  const max = Math.max(...geo.map((g) => g.percentage), 1);
  return (
    <SectionCard
      title="Where they watch from"
      subtitle={
        audience?.primary_country
          ? `Primary: ${audience.primary_country}${
              audience?.domestic_percentage != null
                ? ` · ${Math.round(
                    audience.domestic_percentage <= 1
                      ? audience.domestic_percentage * 100
                      : audience.domestic_percentage,
                  )}% domestic`
                : ""
            }`
          : "Top regions by audience share"
      }
    >
      {showZones && (
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            India zones
          </div>
          <div className="mb-2 flex h-3 overflow-hidden rounded-full">
            {ZONE_ORDER.map((z) =>
              zoneNorm[z] > 0 ? (
                <div
                  key={z}
                  title={`${ZONE_LABELS[z]} ${zoneNorm[z]}%`}
                  style={{
                    flexBasis: `${zoneNorm[z]}%`,
                    background: ZONE_COLOR[z],
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {ZONE_ORDER.map((z) => (
              <div key={z} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: ZONE_COLOR[z] }}
                />
                <span className="flex-1 text-foreground">{ZONE_LABELS[z]}</span>
                <span className="font-bold tabular-nums text-muted-foreground">
                  {zoneNorm[z]}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        {showZones && (
          <div className="mb-2 mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Top cities &amp; regions
          </div>
        )}
        <div className="flex flex-col gap-2">
          {geo.slice(0, 8).map((g) => (
            <div key={g.region} className="flex items-center gap-2.5">
              <div className="w-[110px] truncate text-xs font-semibold text-foreground">
                {g.region}
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(g.percentage / max) * 100}%`,
                    background: accent,
                  }}
                />
              </div>
              <div className="w-9 text-right text-[11px] font-extrabold tabular-nums text-foreground">
                {Math.round(g.percentage)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function ProfileCard({
  audience,
  accent,
}: {
  audience: AudienceIntelligence | null;
  accent: string;
}) {
  if (!audience) {
    return (
      <SectionCard title="Audience profile">
        <EmptyCard title="No audience profile available" />
      </SectionCard>
    );
  }
  const interests = audience.interest_signals ?? [];
  const hasContent =
    audience.estimated_gender_skew ||
    audience.estimated_age_group ||
    interests.length > 0;
  if (!hasContent) {
    return (
      <SectionCard title="Audience profile">
        <EmptyCard title="No demographic signals available" />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Audience profile"
      subtitle="Gender skew, age band and interests"
    >
      {audience.estimated_gender_skew && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Gender skew
          </div>
          <div
            className="rounded-md px-2.5 py-1.5 text-xs font-bold capitalize"
            style={{
              background: "var(--gradient-canva-soft)",
              color: "var(--canva-purple)",
            }}
          >
            {audience.estimated_gender_skew}
          </div>
        </div>
      )}
      {audience.estimated_age_group && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Dominant age band
          </div>
          <div
            className="inline-block rounded-md px-2.5 py-1.5 text-xs font-bold"
            style={{ background: accent, color: "#fff" }}
          >
            {audience.estimated_age_group}
          </div>
        </div>
      )}
      {interests.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Interest signals
          </div>
          <div className="flex flex-wrap gap-1.5">
            {interests.slice(0, 8).map((i) => (
              <span
                key={i}
                className="rounded-full bg-canva-purple-soft px-2.5 py-1 text-[11px] font-bold capitalize text-canva-purple"
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function pct(v: number | null | undefined): number {
  if (v == null) return 0;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

function SentimentCard({
  audience,
}: {
  audience: AudienceIntelligence | null;
}) {
  if (!audience || (audience.overall_sentiment == null && audience.sentiment_score == null)) {
    return (
      <SectionCard title="Audience sentiment">
        <EmptyCard title="Not enough comments to gauge sentiment" />
      </SectionCard>
    );
  }
  const score = pct(audience.sentiment_score);
  const positives = audience.positive_themes ?? [];
  const negatives = audience.negative_themes ?? [];
  // Donut split: positive = sentiment_score, negative = remainder weighted
  // by negative themes presence; otherwise neutral fills.
  const positivePct = score;
  const negativePct = negatives.length ? Math.min(20, 100 - score) : 0;
  const neutralPct = Math.max(0, 100 - positivePct - negativePct);

  const r = 38;
  const c = 2 * Math.PI * r;
  const segments: { color: string; len: number; offset: number }[] = [];
  {
    let cursor = 0;
    for (const [val, color] of [
      [positivePct, "var(--success)"] as const,
      [neutralPct, "var(--canva-yellow)"] as const,
      [negativePct, "var(--destructive)"] as const,
    ]) {
      const len = (val / 100) * c;
      segments.push({ color, len, offset: -cursor });
      cursor += len;
    }
  }
  const seg = (s: (typeof segments)[number]) => (
    <circle
      key={s.color}
      cx="50"
      cy="50"
      r={r}
      fill="none"
      stroke={s.color}
      strokeWidth="14"
      strokeDasharray={`${s.len} ${c - s.len}`}
      strokeDashoffset={s.offset}
      transform="rotate(-90 50 50)"
    />
  );

  return (
    <SectionCard
      title="Audience sentiment"
      subtitle={
        audience.overall_sentiment
          ? `Overall: ${audience.overall_sentiment}`
          : "From comments + replies"
      }
    >
      <div className="flex items-center gap-4">
        <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
          {segments.map(seg)}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            fontSize="20"
            fontWeight={800}
            fill="currentColor"
            className="font-heading text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {positivePct}%
          </text>
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontSize="9"
            fontWeight={700}
            fill="currentColor"
            className="text-muted-foreground"
          >
            POSITIVE
          </text>
        </svg>
        <div className="flex flex-1 flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: "var(--success)" }}
            />
            <span className="flex-1">Positive</span>
            <b className="tabular-nums">{positivePct}%</b>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: "var(--canva-yellow)" }}
            />
            <span className="flex-1">Neutral</span>
            <b className="tabular-nums">{neutralPct}%</b>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: "var(--destructive)" }}
            />
            <span className="flex-1">Negative</span>
            <b className="tabular-nums">{negativePct}%</b>
          </div>
        </div>
      </div>
      {(positives.length > 0 || negatives.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {positives.slice(0, 5).map((t) => (
            <span
              key={`p-${t}`}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                background: "var(--success-soft)",
                color: "var(--success)",
              }}
            >
              + {t}
            </span>
          ))}
          {negatives.slice(0, 3).map((t) => (
            <span
              key={`n-${t}`}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                background: "var(--danger-soft)",
                color: "var(--destructive)",
              }}
            >
              − {t}
            </span>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function CommentCloudCard() {
  return (
    <SectionCard
      title="Comment cloud"
      subtitle="What audiences say most"
      right={
        <span className="rounded-full bg-canva-purple-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-canva-purple">
          Coming soon
        </span>
      }
    >
      <EmptyCard
        title="Comment cloud is in the works"
        description="Word-cloud surfaces are queued behind the comment-corpus extraction pipeline. Sentiment and theme tags above already summarise what audiences are saying."
      />
    </SectionCard>
  );
}

export function AudienceTab({ audience, accent }: AudienceTabProps) {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <GeoCard audience={audience} accent={accent} />
      <ProfileCard audience={audience} accent={accent} />
      <SentimentCard audience={audience} />
      <CommentCloudCard />
    </div>
  );
}
