"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Target,
  DollarSign,
  Video,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types/database";

type CampaignGoal = Database["public"]["Enums"]["campaign_goal"];
type ContentFormat = Database["public"]["Enums"]["content_format"];

/* ---------- Question data ---------- */

const GOALS: { value: CampaignGoal; label: string; description: string; icon: typeof Target }[] = [
  {
    value: "awareness",
    label: "Awareness",
    description: "Get your brand in front of new audiences",
    icon: Target,
  },
  {
    value: "conversion",
    label: "Conversions",
    description: "Drive sales through influencer content",
    icon: DollarSign,
  },
  {
    value: "ugc_generation",
    label: "UGC Content",
    description: "Get high-quality content for your channels",
    icon: Video,
  },
];

const BUDGET_STOPS = [
  { label: "Gifting Only", min: 0, max: 0 },
  { label: "5K-10K", min: 5000, max: 10000 },
  { label: "10K-25K", min: 10000, max: 25000 },
  { label: "25K-50K", min: 25000, max: 50000 },
  { label: "50K+", min: 50000, max: 999999 },
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

/* ---------- Tag Input Component ---------- */

function TagInput({
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
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary font-handle"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5"
          >
            <X className="size-3" />
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
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/* ---------- Main Preferences Page ---------- */

export default function PreferencesPage() {
  const router = useRouter();
  const supabase = createClient();

  // State for each question
  const [goal, setGoal] = useState<CampaignGoal | null>(null);
  const [budgetIndex, setBudgetIndex] = useState<number | null>(null);
  const [formats, setFormats] = useState<string[]>([]);
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [creatorHandles, setCreatorHandles] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);

  // Track visible questions
  const [visibleQ, setVisibleQ] = useState(1);
  const [saving, setSaving] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-advance when a question is answered
  const advanceQuestion = useCallback(
    (nextQ: number) => {
      if (nextQ > visibleQ) {
        setTimeout(() => {
          setVisibleQ(nextQ);
        }, 300);
      }
    },
    [visibleQ]
  );

  // Scroll into view when new question appears
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [visibleQ]);

  // Can the user finish?
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

      // Map formats to the primary content_format_pref enum
      // If "any" selected or multiple formats, use "any"
      let contentFormatPref: ContentFormat = "any";
      if (formats.length === 1) {
        const f = formats[0];
        if (f === "reels" || f === "static" || f === "carousel" || f === "any") {
          contentFormatPref = f;
        }
      }

      // Map target region zone keys to labels for shipping_zones
      const REGION_LABELS: Record<string, string> = {
        north: "North India",
        south: "South India",
        east: "East India",
        west: "West India",
      };
      const regionZoneLabels = targetRegions.map((r) => REGION_LABELS[r] ?? r);

      // Merge with any existing shipping_zones from brand-profile step
      const { data: existingBrand } = await supabase
        .from("brands")
        .select("shipping_zones")
        .eq("auth_user_id", user.id)
        .single();

      const existingZones = ((existingBrand as Record<string, unknown> | null)?.shipping_zones as string[] | null) ?? [];
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

      // Fire-and-forget: kick off initial data sync in the background.
      // User is redirected to dashboard immediately — these run async.
      const brand = updatedBrand as { id: string; shopify_connected: boolean } | null;
      if (brand) {
        // Sync Shopify products if connected
        if (brand.shopify_connected) {
          fetch(`/api/brands/${brand.id}/products`, { method: "POST" }).catch(() => {});
        }
        // Compute initial creator-brand matches
        fetch("/api/matching/compute", { method: "POST" }).catch(() => {});
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Error saving preferences:", err);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">
          Tell us about your preferences
        </h1>
        <p className="text-muted-foreground">
          Help us find the perfect creators for your brand. Answer a few quick
          questions.
        </p>
      </div>

      {/* Question 1 — Primary goal */}
      <QuestionWrapper visible={visibleQ >= 1} index={1}>
        <QuestionLabel number={1}>
          What&apos;s your primary goal right now?
        </QuestionLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          {GOALS.map((g) => {
            const Icon = g.icon;
            const selected = goal === g.value;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => {
                  setGoal(g.value);
                  advanceQuestion(2);
                }}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all hover:border-primary/40 hover:bg-primary/[0.02]",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border"
                )}
              >
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl transition-colors",
                    selected
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-heading font-semibold text-sm">
                    {g.label}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {g.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </QuestionWrapper>

      {/* Question 2 — Budget per creator */}
      <QuestionWrapper visible={visibleQ >= 2} index={2}>
        <QuestionLabel number={2}>
          What&apos;s your typical budget per creator?
        </QuestionLabel>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {BUDGET_STOPS.map((stop, i) => (
              <button
                key={stop.label}
                type="button"
                onClick={() => {
                  setBudgetIndex(i);
                  advanceQuestion(3);
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  budgetIndex === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/40 hover:bg-primary/[0.02]"
                )}
              >
                {i === 0 ? "Gifting Only" : `\u20B9${stop.label}`}
              </button>
            ))}
          </div>
        </div>
      </QuestionWrapper>

      {/* Question 3 — Content format */}
      <QuestionWrapper visible={visibleQ >= 3} index={3}>
        <QuestionLabel number={3}>
          What content format works best?
        </QuestionLabel>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((opt) => {
            const selected = formats.includes(opt.value);
            const isAny = opt.value === "any";
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  let next: string[];
                  if (isAny) {
                    // Toggle "any" — clears other selections
                    next = selected ? [] : ["any"];
                  } else {
                    // Remove "any" if present, then toggle this one
                    const without = formats.filter((f) => f !== "any");
                    next = selected
                      ? without.filter((f) => f !== opt.value)
                      : [...without, opt.value];
                  }
                  setFormats(next);
                  if (next.length > 0) advanceQuestion(4);
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/40 hover:bg-primary/[0.02]"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </QuestionWrapper>

      {/* Question 4 — Target regions */}
      <QuestionWrapper visible={visibleQ >= 4} index={4}>
        <QuestionLabel number={4}>
          Where do you want to grow your audience?
        </QuestionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {REGION_OPTIONS.map((region) => {
            const selected = targetRegions.includes(region.value);
            return (
              <button
                key={region.value}
                type="button"
                onClick={() => {
                  const next = selected
                    ? targetRegions.filter((r) => r !== region.value)
                    : [...targetRegions, region.value];
                  setTargetRegions(next);
                  if (next.length > 0) advanceQuestion(5);
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.02]",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border"
                )}
              >
                <p className="font-heading font-semibold text-sm">
                  {region.label}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {region.description}
                </p>
              </button>
            );
          })}
        </div>
        {visibleQ === 4 && targetRegions.length === 0 && (
          <button
            type="button"
            onClick={() => advanceQuestion(5)}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors mt-1"
          >
            Skip — target all of India
          </button>
        )}
      </QuestionWrapper>

      {/* Question 5 — Past creator handles */}
      <QuestionWrapper visible={visibleQ >= 5} index={5}>
        <QuestionLabel number={5} optional>
          Worked with creators before? Drop their handles.
        </QuestionLabel>
        <TagInput
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
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors mt-1"
          >
            Skip this question
          </button>
        )}
      </QuestionWrapper>

      {/* Question 6 — Competitors */}
      <QuestionWrapper visible={visibleQ >= 6} index={6}>
        <QuestionLabel number={6} optional>
          Who are your competitors?
        </QuestionLabel>
        <TagInput
          tags={competitors}
          setTags={setCompetitors}
          placeholder="Brand name or @handle (press Enter to add)"
        />
      </QuestionWrapper>

      {/* Finish button — appears after Q1-Q3 answered */}
      {canFinish && (
        <div
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          ref={bottomRef}
        >
          <div className="flex items-center justify-between border-t pt-6">
            <p className="text-sm text-muted-foreground">
              You can always update these later in Settings.
            </p>
            <Button
              onClick={handleFinish}
              disabled={saving}
              size="lg"
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {saving ? "Saving..." : "Finish Setup"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Utility Components ---------- */

function QuestionWrapper({
  visible,
  children,
}: {
  visible: boolean;
  index: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      // Small delay to trigger the CSS transition after mount
      const timer = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="space-y-4 transition-all duration-500 ease-out"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
      }}
    >
      {children}
    </div>
  );
}

function QuestionLabel({
  number,
  optional,
  children,
}: {
  number: number;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {number}
      </span>
      <h2 className="text-base font-heading font-semibold">
        {children}
        {optional && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Optional
          </span>
        )}
      </h2>
    </div>
  );
}
