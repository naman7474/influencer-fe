"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ObPill } from "@/components/onboarding/ob-pill";
import { ObRow } from "@/components/onboarding/ob-row";
import { X, ArrowRightIcon, Loader2Icon } from "lucide-react";
import type { Database } from "@/lib/types/database";

type CampaignGoal = Database["public"]["Enums"]["campaign_goal"];
type ContentFormat = Database["public"]["Enums"]["content_format"];

/* ---------- Data ---------- */

const GOALS: { value: CampaignGoal; label: string; description: string }[] = [
  {
    value: "awareness",
    label: "Awareness",
    description: "Get your brand in front of new audiences",
  },
  {
    value: "conversion",
    label: "Conversions",
    description: "Drive sales through influencer content",
  },
  {
    value: "ugc_generation",
    label: "UGC Content",
    description: "Get high-quality content for your channels",
  },
];

const BUDGET_STOPS = [
  { label: "Gifting only", min: 0, max: 0 },
  { label: "\u20B95K\u201310K", min: 5000, max: 10000 },
  { label: "\u20B910K\u201325K", min: 10000, max: 25000 },
  { label: "\u20B925K\u201350K", min: 25000, max: 50000 },
  { label: "\u20B950K+", min: 50000, max: 999999 },
];

const FORMAT_OPTIONS: { value: ContentFormat | "stories"; label: string }[] = [
  { value: "reels", label: "Reels" },
  { value: "static", label: "Static Posts" },
  { value: "carousel", label: "Carousels" },
  { value: "stories" as const, label: "Stories" },
  { value: "any", label: "Any" },
];

const REGION_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "north", label: "North India", description: "Delhi NCR, UP, Punjab, Rajasthan, Haryana" },
  { value: "south", label: "South India", description: "Karnataka, Tamil Nadu, Kerala, Telangana, AP" },
  { value: "east", label: "East India", description: "West Bengal, Odisha, Bihar, Northeast" },
  { value: "west", label: "West India", description: "Maharashtra, Gujarat, Goa, MP" },
];

/* ---------- Tag Input ---------- */

function ObTagInput({
  tags,
  setTags,
  placeholder,
  prefix,
}: {
  tags: string[];
  setTags: (tags: string[]) => void;
  placeholder: string;
  prefix?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    let value = raw.trim();
    if (!value) return;
    if (prefix && !value.startsWith(prefix)) {
      value = prefix + value;
    }
    if (!tags.includes(value)) {
      setTags([...tags, value]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] px-3 py-2.5 transition-colors focus-within:border-[var(--ob-clay)] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--ob-clay-soft)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--ob-clay2)]"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--ob-clay)]/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)]"
      />
    </div>
  );
}

/* ---------- Main ---------- */

export default function PreferencesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [goal, setGoal] = useState<CampaignGoal | null>(null);
  const [budgetIndex, setBudgetIndex] = useState<number | null>(null);
  const [formats, setFormats] = useState<string[]>([]);
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [creatorHandles, setCreatorHandles] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);

  const [visibleQ, setVisibleQ] = useState(1);
  const [saving, setSaving] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const advanceQuestion = useCallback(
    (nextQ: number) => {
      if (nextQ > visibleQ) {
        setTimeout(() => setVisibleQ(nextQ), 300);
      }
    },
    [visibleQ]
  );

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [visibleQ]);

  const canFinish = goal !== null && budgetIndex !== null && formats.length > 0;

  async function handleFinish() {
    if (!canFinish) return;
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const budgetStop = budgetIndex !== null ? BUDGET_STOPS[budgetIndex] : null;

      let contentFormatPref: ContentFormat = "any";
      if (formats.length === 1) {
        const f = formats[0];
        if (f === "reels" || f === "static" || f === "carousel" || f === "any") {
          contentFormatPref = f;
        }
      }

      const REGION_LABELS: Record<string, string> = {
        north: "North India",
        south: "South India",
        east: "East India",
        west: "West India",
      };
      const regionZoneLabels = targetRegions.map((r) => REGION_LABELS[r] ?? r);

      const { data: existingBrand } = await supabase
        .from("brands")
        .select("shipping_zones")
        .eq("auth_user_id", user.id)
        .single();

      const existingZones =
        ((existingBrand as Record<string, unknown> | null)?.shipping_zones as string[] | null) ?? [];
      const mergedZones = [
        ...existingZones.filter((z) => !Object.values(REGION_LABELS).includes(z)),
        ...regionZoneLabels,
      ];

      const updatePayload: Database["public"]["Tables"]["brands"]["Update"] = {
        default_campaign_goal: goal,
        budget_per_creator_min: budgetStop?.min ?? null,
        budget_per_creator_max: budgetStop?.max ?? null,
        content_format_pref: contentFormatPref,
        shipping_zones: mergedZones.length > 0 ? mergedZones : null,
        past_collaborations: creatorHandles.length > 0 ? creatorHandles : null,
        competitor_brands: competitors.length > 0 ? competitors : null,
        onboarding_step: 5,
        onboarded_at: new Date().toISOString(),
      };

      const { data: updatedBrand, error } = await supabase
        .from("brands")
        .update(updatePayload as never)
        .eq("auth_user_id", user.id)
        .select("id, shopify_connected")
        .single();

      if (error) {
        console.error("Failed to save preferences:", error);
        setSaving(false);
        return;
      }

      const brand = updatedBrand as { id: string; shopify_connected: boolean } | null;
      if (brand) {
        if (brand.shopify_connected) {
          fetch(`/api/brands/${brand.id}/products`, { method: "POST" }).catch(() => {});
        }
        fetch(`/api/brands/${brand.id}/ig-analyze`, { method: "POST" }).catch(() => {});
      }

      router.push(brand ? `/processing/${brand.id}` : "/dashboard");
    } catch (err) {
      console.error("Error saving preferences:", err);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pb-20" style={{ animation: "obRise 0.35s ease-out" }}>
      {/* Header */}
      <div>
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[1.4px] text-[var(--ob-clay)]">
          &#x25CF; step 3 of 3 &middot; define
        </div>
        <h1 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
          Now &mdash;{" "}
          <span className="italic text-[var(--ob-clay)]">
            what are you trying to do?
          </span>
        </h1>
        <p className="mt-2 text-sm text-[var(--ob-ink2)]">
          The things we can&rsquo;t guess from your site. Answer a few quick questions.
        </p>
      </div>

      {/* Q1 — Primary goal */}
      <QWrap visible={visibleQ >= 1}>
        <ObRow label="Primary goal" hint="pick the one that matters most this quarter">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {GOALS.map((g) => {
              const sel = goal === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => {
                    setGoal(g.value);
                    advanceQuestion(2);
                  }}
                  className={`rounded-xl border-[1.5px] p-4 text-left transition-all ${
                    sel
                      ? "border-[var(--ob-clay)] bg-[var(--ob-clay-soft)]"
                      : "border-[var(--ob-line)] bg-[var(--ob-card)] hover:border-[var(--ob-ink4)]"
                  }`}
                >
                  <div className="font-serif text-xl italic tracking-tight text-[var(--ob-ink)]">
                    {g.label}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-[var(--ob-ink2)]">
                    {g.description}
                  </div>
                </button>
              );
            })}
          </div>
        </ObRow>
      </QWrap>

      {/* Q2 — Budget per creator */}
      <QWrap visible={visibleQ >= 2}>
        <ObRow label="Budget per creator" hint="you can fine-tune per campaign later">
          <ObPill
            options={BUDGET_STOPS.map((s, i) => ({
              value: String(i),
              label: s.label,
            }))}
            value={budgetIndex !== null ? String(budgetIndex) : ""}
            onChange={(val) => {
              setBudgetIndex(Number(val));
              advanceQuestion(3);
            }}
          />
        </ObRow>
      </QWrap>

      {/* Q3 — Content formats */}
      <QWrap visible={visibleQ >= 3}>
        <ObRow label="Content formats" hint="what works best for your brand">
          <ObPill
            options={FORMAT_OPTIONS.map((f) => ({
              value: f.value,
              label: f.label,
            }))}
            value={formats}
            onChange={(val) => {
              const next = val as string[];
              // If "any" is selected, clear others
              if (next.includes("any") && !formats.includes("any")) {
                setFormats(["any"]);
              } else if (next.includes("any") && next.length > 1) {
                setFormats(next.filter((f) => f !== "any"));
              } else {
                setFormats(next);
              }
              if (next.length > 0) advanceQuestion(4);
            }}
            multi
          />
        </ObRow>
      </QWrap>

      {/* Q4 — Target regions */}
      <QWrap visible={visibleQ >= 4}>
        <ObRow label="Regions to grow in" hint="where you want to show up next">
          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4">
            {REGION_OPTIONS.map((r) => {
              const sel = targetRegions.includes(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    const next = sel
                      ? targetRegions.filter((x) => x !== r.value)
                      : [...targetRegions, r.value];
                    setTargetRegions(next);
                    if (next.length > 0) advanceQuestion(5);
                  }}
                  className={`rounded-xl border-[1.5px] p-3.5 text-left transition-all ${
                    sel
                      ? "border-[var(--ob-clay)] bg-[var(--ob-clay-soft)]"
                      : "border-[var(--ob-line)] bg-[var(--ob-card)] hover:border-[var(--ob-ink4)]"
                  }`}
                >
                  <div className="font-serif text-lg italic tracking-tight text-[var(--ob-ink)]">
                    {r.label}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[var(--ob-ink3)]">
                    {r.description}
                  </div>
                </button>
              );
            })}
          </div>
          {visibleQ === 4 && targetRegions.length === 0 && (
            <button
              type="button"
              onClick={() => advanceQuestion(5)}
              className="mt-1 text-[13px] text-[var(--ob-ink3)] underline underline-offset-[3px] transition-colors hover:text-[var(--ob-ink)]"
            >
              Skip &mdash; target all of India
            </button>
          )}
        </ObRow>
      </QWrap>

      {/* Q5 — Past creators */}
      <QWrap visible={visibleQ >= 5}>
        <ObRow label="Past creators" hint="optional &mdash; worked with anyone before?">
          <ObTagInput
            tags={creatorHandles}
            setTags={(t) => {
              setCreatorHandles(t);
              advanceQuestion(6);
            }}
            placeholder="@handle (press Enter to add)"
            prefix="@"
          />
          {visibleQ === 5 && creatorHandles.length === 0 && (
            <button
              type="button"
              onClick={() => advanceQuestion(6)}
              className="mt-1 text-[13px] text-[var(--ob-ink3)] underline underline-offset-[3px] transition-colors hover:text-[var(--ob-ink)]"
            >
              Skip this question
            </button>
          )}
        </ObRow>
      </QWrap>

      {/* Q6 — Competitors */}
      <QWrap visible={visibleQ >= 6}>
        <ObRow label="Competitors" hint="optional &mdash; who do you compete with?">
          <ObTagInput
            tags={competitors}
            setTags={setCompetitors}
            placeholder="Brand name or @handle (press Enter to add)"
          />
        </ObRow>
      </QWrap>

      {/* Finish */}
      {canFinish && (
        <div ref={bottomRef} style={{ animation: "obFadeUp 0.4s ease-out" }}>
          <div className="flex items-center justify-between border-t border-[var(--ob-line)] pt-5">
            <p className="text-xs text-[var(--ob-ink3)]">
              You can always update these later in Settings.
            </p>
            <button
              onClick={handleFinish}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--ob-ink)] px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Finish setup
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Question wrapper with reveal animation ---------- */

function QWrap({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="transition-all duration-500 ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(16px)",
      }}
    >
      {children}
    </div>
  );
}
