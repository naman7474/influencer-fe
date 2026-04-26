import * as React from "react";

import type {
  CaptionIntelligence,
  CreatorBrandMatch,
} from "@/lib/types/database";

import { SectionCard } from "./section-card";
import { EmptyCard } from "./empty-card";

interface BrandMatchTabProps {
  match: CreatorBrandMatch | null;
  caption: CaptionIntelligence | null;
}

interface Reason {
  label: string;
  score: number;
  detail?: string;
}

function pct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

function buildReasons(match: CreatorBrandMatch | null): Reason[] {
  if (!match) return [];
  const out: Reason[] = [];
  const push = (label: string, value: number | null | undefined, detail?: string) => {
    const v = pct(value);
    if (v != null) out.push({ label, score: v, detail });
  };
  push("Niche fit", match.niche_fit_score, "Creator's niche vs. our brand category");
  push("Audience geography", match.audience_geo_score, "Where their followers live");
  push("Engagement quality", match.engagement_score, "How their audience interacts");
  push("Brand safety", match.brand_safety_score, "Risk signals across content");
  push("Content style", match.content_style_score, "Voice and aesthetic alignment");
  return out;
}

function WhyCard({ match }: { match: CreatorBrandMatch | null }) {
  if (!match) {
    return (
      <SectionCard
        title="Why this score?"
        subtitle="Sub-score breakdown"
        span={2}
      >
        <EmptyCard
          title="No brand match available"
          description="Brand match scores are computed when a brand is logged in and the brief is loaded."
        />
      </SectionCard>
    );
  }
  const reasons = buildReasons(match);
  const headline = pct(match.match_score) ?? 0;

  return (
    <SectionCard
      title="Why this score?"
      subtitle={`Brand match · ${headline}/100`}
      span={2}
    >
      {match.match_reasoning && (
        <div
          className="rounded-xl px-4 py-3 text-sm leading-relaxed text-foreground"
          style={{ background: "var(--gradient-canva-soft)" }}
        >
          {match.match_reasoning}
        </div>
      )}
      {reasons.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {reasons.map((r) => (
            <div key={r.label} className="flex items-center gap-3.5">
              <div className="w-[200px] shrink-0">
                <div className="text-[13px] font-bold text-foreground">
                  {r.label}
                </div>
                {r.detail && (
                  <div className="text-[11px] text-muted-foreground">
                    {r.detail}
                  </div>
                )}
              </div>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${r.score}%`,
                    background: "var(--gradient-canva)",
                  }}
                />
              </div>
              <div className="w-12 text-right text-sm font-extrabold tabular-nums text-foreground">
                {r.score}
                <span className="text-[11px] font-bold text-muted-foreground">
                  /100
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyCard title="No sub-score breakdown stored for this match" />
      )}
    </SectionCard>
  );
}

interface PartnershipRow {
  brand: string;
  status: "paid" | "organic";
}

function buildHistory(caption: CaptionIntelligence | null): PartnershipRow[] {
  if (!caption) return [];
  const paid = (caption.paid_brand_mentions ?? []).map((b) => ({
    brand: b,
    status: "paid" as const,
  }));
  const organic = (caption.organic_brand_mentions ?? []).map((b) => ({
    brand: b,
    status: "organic" as const,
  }));
  // De-dupe by brand, prefer paid over organic
  const seen = new Map<string, PartnershipRow>();
  for (const r of [...paid, ...organic]) {
    const key = r.brand.toLowerCase();
    if (!seen.has(key)) seen.set(key, r);
  }
  return [...seen.values()];
}

function HistoryCard({ caption }: { caption: CaptionIntelligence | null }) {
  const rows = buildHistory(caption);
  if (!rows.length) {
    return (
      <SectionCard
        title="Brand history"
        subtitle="Past partnerships detected from captions"
        span={2}
      >
        <EmptyCard title="No brand mentions detected yet" />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Brand history"
      subtitle={`${rows.length} brand${rows.length > 1 ? "s" : ""} detected from captions`}
      span={2}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.brand + r.status}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
          >
            <div className="truncate text-[13px] font-bold text-foreground">
              {r.brand}
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
              style={
                r.status === "paid"
                  ? {
                      background: "var(--canva-purple-soft)",
                      color: "var(--canva-purple)",
                    }
                  : {
                      background: "var(--canva-teal-soft)",
                      color: "var(--canva-teal)",
                    }
              }
            >
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function BrandMatchTab({ match, caption }: BrandMatchTabProps) {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <WhyCard match={match} />
      <HistoryCard caption={caption} />
    </div>
  );
}
