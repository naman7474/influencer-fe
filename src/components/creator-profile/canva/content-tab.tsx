import * as React from "react";

import type {
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
} from "@/lib/types/database";
import type { ContentItem, SocialPlatform } from "@/lib/types/creator-detail";
import { formatFollowers } from "@/lib/format";

import { SectionCard } from "./section-card";
import { EmptyCard } from "./empty-card";
import { ContentViewerDialog } from "./content-viewer-dialog";

interface ContentTabProps {
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  audience: AudienceIntelligence | null;
  content: ContentItem[];
  platform: SocialPlatform;
  accent: string;
}

const PILLAR_COLORS = [
  "var(--canva-pink)",
  "var(--canva-purple)",
  "var(--canva-teal)",
  "var(--canva-yellow)",
  "var(--muted-foreground)",
];

// `emoji_only_percentage` etc may be stored as 0-1 or 0-100 depending on
// the pipeline run. Normalize to 0-100 for display.
function pct(v: number | null | undefined): number {
  if (v == null) return 0;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

// Voice factor score: caption + transcript fields are 0-1 today; render as 0-100.
function score100(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

function pillarPercents(pillars: string[]): { name: string; pct: number }[] {
  const n = pillars.length;
  if (n === 0) return [];
  // Equal distribution — DB doesn't store per-pillar share. Note in subtitle.
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return pillars.map((name, i) => ({
    name,
    pct: i === 0 ? base + remainder : base,
  }));
}

function ContentPillarsCard({ caption }: { caption: CaptionIntelligence | null }) {
  const pillars = caption?.content_pillars ?? [];
  if (!pillars.length) {
    return (
      <SectionCard title="Content pillars" subtitle="What they post about">
        <EmptyCard
          title="No pillars detected yet"
          description="Pillars surface once enough captions are analysed."
        />
      </SectionCard>
    );
  }
  const items = pillarPercents(pillars).map((p, i) => ({
    ...p,
    color: PILLAR_COLORS[i % PILLAR_COLORS.length],
  }));
  return (
    <SectionCard
      title="Content pillars"
      subtitle="Top themes across recent captions"
    >
      <div className="flex h-3.5 overflow-hidden rounded-full">
        {items.map((p) => (
          <div
            key={p.name}
            title={`${p.name} ${p.pct}%`}
            style={{ flexBasis: `${p.pct}%`, background: p.color }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: p.color }}
            />
            <span className="flex-1 font-semibold text-foreground capitalize">
              {p.name}
            </span>
            <span className="font-bold tabular-nums text-muted-foreground">
              {p.pct}%
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function CommentQualityCard({
  audience,
}: {
  audience: AudienceIntelligence | null;
}) {
  if (!audience) {
    return (
      <SectionCard title="Comment quality" subtitle="Spam-filtered authenticity">
        <EmptyCard title="No audience signals available" />
      </SectionCard>
    );
  }
  const positive = pct(audience.substantive_comment_percentage);
  const neutral = pct(audience.generic_comment_percentage);
  const spam = pct(audience.emoji_only_percentage);
  const total = positive + neutral + spam || 1;
  const score = Math.round((positive * 100) / total);

  return (
    <SectionCard
      title="Comment quality"
      subtitle="Substantive vs generic vs emoji-only"
      right={
        <div className="rounded-full bg-[var(--gradient-canva-soft)] px-3 py-1 text-xs font-extrabold text-canva-purple">
          {score}/100
        </div>
      }
    >
      <div className="flex h-8 overflow-hidden rounded-lg">
        <div
          className="grid place-items-center text-[11px] font-extrabold text-white"
          style={{ flexBasis: `${(positive / total) * 100}%`, background: "var(--success)" }}
        >
          {positive > 8 ? `${positive}%` : ""}
        </div>
        <div
          className="grid place-items-center text-[11px] font-extrabold"
          style={{
            flexBasis: `${(neutral / total) * 100}%`,
            background: "var(--canva-yellow)",
            color: "#7a5a00",
          }}
        >
          {neutral > 8 ? `${neutral}%` : ""}
        </div>
        <div
          className="grid place-items-center text-[11px] font-extrabold text-white"
          style={{
            flexBasis: `${(spam / total) * 100}%`,
            background: "var(--destructive)",
          }}
        >
          {spam > 8 ? `${spam}%` : ""}
        </div>
      </div>
      <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
        <span>Substantive</span>
        <span>Generic</span>
        <span>Emoji-only</span>
      </div>
    </SectionCard>
  );
}

function VoiceCard({
  caption,
  transcript,
  accent,
}: {
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  accent: string;
}) {
  const tones = [caption?.primary_tone, caption?.secondary_tone].filter(
    (t): t is NonNullable<typeof t> => Boolean(t),
  );
  const factors: { label: string; score: number | null }[] = [
    { label: "Authenticity", score: score100(caption?.authenticity_feel) },
    { label: "Humor", score: score100(caption?.humor_score) },
    { label: "Formality", score: score100(caption?.formality_score) },
    { label: "Educational", score: score100(transcript?.educational_density) },
    { label: "Storytelling", score: score100(transcript?.storytelling_score) },
  ].filter((f) => f.score != null) as { label: string; score: number }[];

  if (!tones.length && !factors.length) {
    return (
      <SectionCard title="Voice & tone">
        <EmptyCard title="Not enough captions analysed yet" />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Voice & tone"
      subtitle="Auto-detected from captions and transcripts"
    >
      {tones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tones.map((t) => (
            <span
              key={t}
              className="rounded-full bg-canva-purple-soft px-2.5 py-1 text-xs font-bold capitalize text-canva-purple"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {factors.length > 0 && (
        <div className="flex flex-col gap-2">
          {factors.map((f) => (
            <div key={f.label} className="flex items-center gap-2.5">
              <div className="w-[100px] text-[11px] font-semibold text-muted-foreground">
                {f.label}
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${f.score}%`,
                    background: accent,
                  }}
                />
              </div>
              <div className="w-8 text-right text-[11px] font-extrabold tabular-nums text-foreground">
                {f.score}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function recentPostMeta(item: ContentItem): {
  badge: string;
  views: number | null;
  thumbnail: string | null;
  daysAgo: number | null;
} {
  if (item.kind === "ig_post") {
    const dateStr = item.date_posted;
    const days = dateStr
      ? Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
      : null;
    return {
      badge: item.content_type ?? "Post",
      views: item.video_view_count ?? item.video_play_count ?? item.likes ?? null,
      thumbnail: item.thumbnail_url ?? null,
      daysAgo: days,
    };
  }
  const dateStr = item.published_at;
  const days = dateStr
    ? Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
    : null;
  // Older rows have `thumbnail_url=null` because the YT API path used to
  // skip thumbnails. ytimg's hqdefault.jpg is a public CDN URL deterministic
  // from video_id, so we synthesize when the DB value is missing.
  const thumbnail =
    item.thumbnail_url ??
    (item.video_id
      ? `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`
      : null);
  return {
    badge: item.is_short ? "Short" : item.is_livestream ? "Live" : "Long",
    views: item.view_count ?? null,
    thumbnail,
    daysAgo: days,
  };
}

function RecentPostsCard({
  content,
  platform,
  onSelect,
}: {
  content: ContentItem[];
  platform: SocialPlatform;
  onSelect: (item: ContentItem) => void;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  if (!content.length) {
    return (
      <SectionCard
        title="Recent posts"
        subtitle={`No recent ${platform === "instagram" ? "Instagram" : "YouTube"} content`}
      >
        <EmptyCard title="No recent posts available" />
      </SectionCard>
    );
  }

  const items = showAll ? content.slice(0, visibleCount) : content.slice(0, 6);
  const subtitle = showAll
    ? `${items.length} of ${content.length}`
    : `${items.length} most recent`;

  return (
    <SectionCard
      title="Recent posts"
      subtitle={subtitle}
      right={
        content.length > 6 ? (
          <button
            type="button"
            onClick={() => {
              setShowAll((v) => !v);
              setVisibleCount(PAGE_SIZE);
            }}
            className="text-xs font-semibold text-canva-purple hover:underline"
          >
            {showAll ? "Show less" : "View all"}
          </button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {items.map((item, idx) => {
          const meta = recentPostMeta(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="overflow-hidden rounded-lg border border-border text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-square">
                {meta.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{
                      background: PILLAR_COLORS[idx % PILLAR_COLORS.length],
                    }}
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55))",
                  }}
                />
                <div className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                  {meta.badge}
                </div>
                {meta.views != null && (
                  <div className="absolute bottom-1 left-1.5 text-[10px] font-extrabold text-white">
                    {formatFollowers(meta.views)}
                  </div>
                )}
                {meta.daysAgo != null && (
                  <div className="absolute bottom-1 right-1.5 text-[9px] font-semibold text-white/90">
                    {meta.daysAgo}d
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {showAll && visibleCount < content.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
        >
          Load more
        </button>
      )}
    </SectionCard>
  );
}

// ── Brands & CTAs ──────────────────────────────────────────────
function BrandsAndCTAsCard({
  caption,
}: {
  caption: CaptionIntelligence | null;
}) {
  const organic = caption?.organic_brand_mentions ?? [];
  const paid = caption?.paid_brand_mentions ?? [];
  const cats = caption?.brand_categories ?? [];
  const ctaStyle = caption?.dominant_cta_style;
  const ctaFreq = caption?.cta_frequency;
  const conversion = caption?.is_conversion_oriented;
  const hasAny =
    organic.length > 0 ||
    paid.length > 0 ||
    cats.length > 0 ||
    ctaStyle ||
    ctaFreq != null ||
    conversion != null;
  if (!hasAny) {
    return (
      <SectionCard title="Brands & CTAs" subtitle="Mentions and call-to-action style">
        <EmptyCard title="No brand or CTA signals yet" />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Brands & CTAs"
      subtitle="What they mention and how they push action"
      right={
        conversion != null ? (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
            style={{
              background: conversion ? "var(--success-soft)" : "var(--muted)",
              color: conversion ? "var(--success)" : "var(--muted-foreground)",
            }}
          >
            {conversion ? "Conversion-led" : "Awareness-led"}
          </span>
        ) : undefined
      }
    >
      {organic.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Organic mentions
          </div>
          <div className="flex flex-wrap gap-1.5">
            {organic.slice(0, 12).map((b) => (
              <span
                key={`o-${b}`}
                className="rounded-full bg-canva-purple-soft px-2.5 py-1 text-[11px] font-bold text-canva-purple"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
      {paid.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Paid / sponsored mentions
          </div>
          <div className="flex flex-wrap gap-1.5">
            {paid.slice(0, 12).map((b) => (
              <span
                key={`p-${b}`}
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{
                  background: "var(--canva-yellow)",
                  color: "#7a5a00",
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
      {cats.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Categories
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cats.slice(0, 8).map((c) => (
              <span
                key={`c-${c}`}
                className="rounded-md border border-border px-2 py-0.5 text-[11px] font-bold capitalize text-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {(ctaStyle || ctaFreq != null) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          {ctaStyle && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                CTA style
              </div>
              <div className="mt-0.5 text-xs font-extrabold capitalize text-foreground">
                {ctaStyle.replace(/_/g, " ")}
              </div>
            </div>
          )}
          {ctaFreq != null && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                CTA frequency
              </div>
              <div className="mt-0.5 text-xs font-extrabold tabular-nums text-foreground">
                {pct(ctaFreq)}%
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Languages (caption + transcript) ───────────────────────────
function LanguagesCard({
  caption,
  transcript,
}: {
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
}) {
  // language_mix is `{ "Hindi": 0.2, "English": 0.8 }` — treat as Record<string, number>.
  const mix = (caption?.language_mix ?? {}) as Record<string, unknown>;
  const mixEntries = Object.entries(mix)
    .map(([k, v]) => {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(n)) return null;
      return [k, n <= 1 ? n * 100 : n] as [string, number];
    })
    .filter((x): x is [string, number] => x != null)
    .sort((a, b) => b[1] - a[1]);

  const spoken = transcript?.languages_spoken ?? [];
  const primarySpoken = transcript?.primary_spoken_language;
  const mismatch = transcript?.caption_vs_spoken_mismatch;
  const transliteration = caption?.uses_transliteration;

  if (
    mixEntries.length === 0 &&
    spoken.length === 0 &&
    !primarySpoken &&
    transliteration == null
  ) {
    return (
      <SectionCard title="Languages" subtitle="Caption vs spoken language">
        <EmptyCard title="No language signals yet" />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Languages"
      subtitle="What they write in vs what they say on camera"
      right={
        mismatch ? (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
            style={{
              background: "var(--canva-yellow)",
              color: "#7a5a00",
            }}
          >
            Caption ≠ spoken
          </span>
        ) : undefined
      }
    >
      {mixEntries.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Caption language mix
          </div>
          <div className="flex h-3.5 overflow-hidden rounded-full">
            {mixEntries.map(([lang, p], i) => (
              <div
                key={lang}
                title={`${lang} ${Math.round(p)}%`}
                style={{
                  flexBasis: `${p}%`,
                  background: PILLAR_COLORS[i % PILLAR_COLORS.length],
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {mixEntries.map(([lang, p], i) => (
              <span key={lang} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: PILLAR_COLORS[i % PILLAR_COLORS.length] }}
                />
                <span className="font-semibold text-foreground">{lang}</span>
                <span className="font-bold tabular-nums text-muted-foreground">
                  {Math.round(p)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      {(primarySpoken || spoken.length > 0) && (
        <div className="border-t border-border pt-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Spoken on camera
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(primarySpoken
              ? [primarySpoken, ...spoken.filter((s) => s !== primarySpoken)]
              : spoken
            )
              .slice(0, 5)
              .map((lang, i) => (
                <span
                  key={lang}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    i === 0
                      ? "bg-canva-purple-soft text-canva-purple"
                      : "border border-border text-foreground"
                  }`}
                >
                  {lang}
                  {i === 0 ? "  · primary" : ""}
                </span>
              ))}
          </div>
        </div>
      )}
      {transliteration && (
        <div className="text-[11px] font-semibold text-muted-foreground">
          Uses transliteration (e.g. Hinglish in Latin script)
        </div>
      )}
    </SectionCard>
  );
}

// ── Hook quality (transcript) ──────────────────────────────────
interface HookDetail {
  post_id?: string;
  hook_text?: string;
  hook_score?: number;
  hook_style?: string;
}
function HookQualityCard({
  transcript,
}: {
  transcript: TranscriptIntelligence | null;
}) {
  const score = transcript?.avg_hook_quality;
  const style = transcript?.dominant_hook_style;
  const details = (transcript?.hook_details ?? []) as unknown as HookDetail[];
  if (score == null && !style && (!details || details.length === 0)) {
    return (
      <SectionCard title="Hook quality" subtitle="Opening seconds of recent videos">
        <EmptyCard title="No hook analysis yet" />
      </SectionCard>
    );
  }
  const score100 = score != null ? Math.round((score <= 1 ? score * 100 : score)) : null;
  const examples = (details || [])
    .filter((d) => d && typeof d.hook_text === "string" && d.hook_text!.trim().length > 0)
    .slice(0, 3);
  return (
    <SectionCard
      title="Hook quality"
      subtitle="How they open videos"
      right={
        score100 != null ? (
          <div className="rounded-full bg-[var(--gradient-canva-soft)] px-3 py-1 text-xs font-extrabold text-canva-purple">
            {score100}/100
          </div>
        ) : undefined
      }
    >
      {style && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Dominant style
          </div>
          <div className="mt-0.5 text-xs font-extrabold capitalize text-foreground">
            {style.replace(/_/g, " ")}
          </div>
        </div>
      )}
      {examples.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Recent examples
          </div>
          {examples.map((ex, i) => (
            <blockquote
              key={ex.post_id ?? i}
              className="border-l-2 border-canva-purple bg-canva-purple-soft/40 px-3 py-2 text-[12px] italic leading-snug text-foreground"
            >
              “{ex.hook_text}”
            </blockquote>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Cultural context (transcript) ──────────────────────────────
function CulturalContextCard({
  transcript,
}: {
  transcript: TranscriptIntelligence | null;
}) {
  const region = transcript?.estimated_region;
  const refs = transcript?.cultural_references ?? [];
  const phrases = transcript?.regional_language_phrases ?? [];
  const places = transcript?.local_places_mentioned ?? [];
  if (!region && !refs.length && !phrases.length && !places.length) {
    return (
      <SectionCard
        title="Cultural context"
        subtitle="Regional cues from on-camera audio"
      >
        <EmptyCard title="No cultural cues detected yet" />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Cultural context"
      subtitle="Regional cues from on-camera audio"
      right={
        region ? (
          <span className="rounded-full bg-canva-purple-soft px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-canva-purple">
            {region}
          </span>
        ) : undefined
      }
    >
      {refs.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Cultural references
          </div>
          <div className="flex flex-wrap gap-1.5">
            {refs.slice(0, 8).map((r) => (
              <span
                key={`cr-${r}`}
                className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
      {phrases.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Regional phrases
          </div>
          <div className="flex flex-wrap gap-1.5">
            {phrases.slice(0, 8).map((p) => (
              <span
                key={`rp-${p}`}
                className="rounded-md px-2 py-0.5 text-[11px] italic font-semibold"
                style={{
                  background: "var(--canva-purple-soft)",
                  color: "var(--canva-purple)",
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
      {places.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Places mentioned
          </div>
          <div className="flex flex-wrap gap-1.5">
            {places.slice(0, 8).map((pl) => (
              <span
                key={`pl-${pl}`}
                className="rounded-md border border-border px-2 py-0.5 text-[11px] font-bold capitalize text-foreground"
              >
                {pl}
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Recurring topics (caption) ─────────────────────────────────
function TopicsCard({ caption }: { caption: CaptionIntelligence | null }) {
  const topics = caption?.recurring_topics ?? [];
  if (!topics.length) return null;
  return (
    <SectionCard
      title="Recurring topics"
      subtitle="What they keep coming back to"
    >
      <div className="flex flex-wrap gap-1.5">
        {topics.slice(0, 12).map((t) => (
          <span
            key={t}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground"
          >
            {t}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}

export function ContentTab({
  caption,
  transcript,
  audience,
  content,
  platform,
  accent,
}: ContentTabProps) {
  const [viewerItem, setViewerItem] = React.useState<ContentItem | null>(null);
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <ContentPillarsCard caption={caption} />
      <CommentQualityCard audience={audience} />
      <VoiceCard caption={caption} transcript={transcript} accent={accent} />
      <BrandsAndCTAsCard caption={caption} />
      <LanguagesCard caption={caption} transcript={transcript} />
      <HookQualityCard transcript={transcript} />
      <CulturalContextCard transcript={transcript} />
      <TopicsCard caption={caption} />
      <RecentPostsCard
        content={content}
        platform={platform}
        onSelect={setViewerItem}
      />
      <ContentViewerDialog
        item={viewerItem}
        onClose={() => setViewerItem(null)}
      />
    </div>
  );
}
