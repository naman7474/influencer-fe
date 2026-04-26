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
  return {
    badge: item.is_short ? "Short" : item.is_livestream ? "Live" : "Long",
    views: item.view_count ?? null,
    thumbnail: item.thumbnail_url ?? null,
    daysAgo: days,
  };
}

function RecentPostsCard({
  content,
  platform,
}: {
  content: ContentItem[];
  platform: SocialPlatform;
}) {
  const items = content.slice(0, 6);
  if (!items.length) {
    return (
      <SectionCard
        title="Recent posts"
        subtitle={`No recent ${platform === "instagram" ? "Instagram" : "YouTube"} content`}
      >
        <EmptyCard title="No recent posts available" />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Recent posts"
      subtitle={`${items.length} most recent`}
    >
      <div className="grid grid-cols-3 gap-2">
        {items.map((item, idx) => {
          const meta = recentPostMeta(item);
          return (
            <div
              key={item.kind === "ig_post" ? item.id : item.id}
              className="overflow-hidden rounded-lg border border-border"
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
            </div>
          );
        })}
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
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <ContentPillarsCard caption={caption} />
      <CommentQualityCard audience={audience} />
      <VoiceCard caption={caption} transcript={transcript} accent={accent} />
      <RecentPostsCard content={content} platform={platform} />
    </div>
  );
}
