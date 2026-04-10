"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Search,
  Users,
  Sparkles,
  FolderOpen,
  Compass,
  Target,
  Megaphone,
  Video,
  IndianRupee,
  CalendarDays,
  MapPin,
  Palette,
  Crown,
  Film,
  FileText,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCampaign, addCreatorToCampaign } from "@/lib/queries/campaigns";
import { getLists, getListItems } from "@/lib/queries/lists";
import { formatFollowers, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Database, CreatorList, Brand } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CampaignGoal = Database["public"]["Enums"]["campaign_goal"];
type ContentFormat = Database["public"]["Enums"]["content_format"];
type CreatorTier = Database["public"]["Enums"]["creator_tier"];

interface SelectedCreator {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  tier: string | null;
  matchScore: number | null;
}

interface WizardState {
  name: string;
  description: string;
  goal: CampaignGoal;
  totalBudget: string;
  budgetPerCreatorMin: string;
  budgetPerCreatorMax: string;
  targetRegions: string[];
  targetNiches: string[];
  creatorTiers: CreatorTier[];
  contentFormat: ContentFormat;
  startDate: string;
  endDate: string;
}

/* ------------------------------------------------------------------ */
/*  Constants — India D2C focused                                      */
/* ------------------------------------------------------------------ */

const GOAL_OPTIONS: { value: CampaignGoal; label: string; description: string; icon: typeof Target }[] = [
  {
    value: "awareness",
    label: "Brand Awareness",
    description: "Introduce your brand to new audiences",
    icon: Megaphone,
  },
  {
    value: "conversion",
    label: "Sales & Conversions",
    description: "Drive purchases via discount codes & affiliate links",
    icon: Target,
  },
  {
    value: "ugc_generation",
    label: "UGC Generation",
    description: "Collect authentic content for ads & social proof",
    icon: Video,
  },
];

const FORMAT_OPTIONS: { value: ContentFormat; label: string; description: string }[] = [
  { value: "reels", label: "Reels", description: "Short-form video content" },
  { value: "static", label: "Static Posts", description: "Photo posts on feed" },
  { value: "carousel", label: "Carousel", description: "Multi-image swipe posts" },
  { value: "any", label: "Any Format", description: "Let creators choose" },
];

const TIER_OPTIONS: { value: CreatorTier; label: string; range: string }[] = [
  { value: "nano", label: "Nano", range: "1K–10K" },
  { value: "micro", label: "Micro", range: "10K–50K" },
  { value: "mid", label: "Mid", range: "50K–200K" },
  { value: "macro", label: "Macro", range: "200K–1M" },
  { value: "mega", label: "Mega", range: "1M+" },
];

// Indian states & metro regions
const REGION_OPTIONS = [
  "Pan India",
  "Delhi NCR",
  "Mumbai",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Kerala",
  "Uttar Pradesh",
  "Gujarat",
  "Rajasthan",
  "West Bengal",
  "Telangana",
  "Punjab",
];

// Niches matching actual DB values + common D2C categories
const NICHE_OPTIONS = [
  "Beauty",
  "Fashion",
  "Lifestyle",
  "Health",
  "Fitness",
  "Food",
  "Entertainment",
  "Education",
  "Parenting",
  "Tech",
  "Travel",
  "Home & Decor",
];

type CreatorSource = "recommendations" | "discovery" | "saved_list";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState<Brand | null>(null);

  // Step 1: Campaign setup
  const [form, setForm] = useState<WizardState>({
    name: "",
    description: "",
    goal: "awareness",
    totalBudget: "",
    budgetPerCreatorMin: "",
    budgetPerCreatorMax: "",
    targetRegions: [],
    targetNiches: [],
    creatorTiers: [],
    contentFormat: "any",
    startDate: "",
    endDate: "",
  });

  // Step 2: Add creators
  const [creatorSource, setCreatorSource] = useState<CreatorSource | null>(null);
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreator[]>(
    [],
  );
  const [searchResults, setSearchResults] = useState<SelectedCreator[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [lists, setLists] = useState<CreatorList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Load brand data
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();

      if (brandData) {
        const b = brandData as Brand;
        setBrand(b);
        setForm((prev) => ({
          ...prev,
          goal: b.default_campaign_goal ?? "awareness",
          budgetPerCreatorMin: b.budget_per_creator_min?.toString() ?? "",
          budgetPerCreatorMax: b.budget_per_creator_max?.toString() ?? "",
          contentFormat: b.content_format_pref ?? "any",
        }));
      }
    }
    load();
  }, [supabase]);

  // Load lists when source is saved_list
  useEffect(() => {
    if (creatorSource === "saved_list" && brand) {
      getLists(supabase, brand.id).then(setLists);
    }
  }, [creatorSource, brand, supabase]);

  // Load list items
  useEffect(() => {
    if (selectedListId) {
      setSearchLoading(true);
      getListItems(supabase, selectedListId)
        .then((items) => {
          const creators: SelectedCreator[] = items.map((item) => {
            const c = item.creator as Record<string, unknown>;
            return {
              id: c.id as string,
              handle: c.handle as string,
              display_name: c.display_name as string | null,
              avatar_url: c.avatar_url as string | null,
              followers: c.followers as number | null,
              tier: c.tier as string | null,
              matchScore: null,
            };
          });
          setSearchResults(creators);
        })
        .finally(() => setSearchLoading(false));
    }
  }, [selectedListId, supabase]);

  // Search creators
  const searchCreators = useCallback(
    async (query: string) => {
      if (!query.trim() && creatorSource !== "recommendations") return;
      setSearchLoading(true);
      try {
        let results;

        if (creatorSource === "recommendations" && brand) {
          const { data } = await supabase
            .from("creator_brand_matches")
            .select(
              `
              match_score,
              creator:creators (
                id,
                handle,
                display_name,
                avatar_url,
                followers,
                tier
              )
            `,
            )
            .eq("brand_id", brand.id)
            .order("match_score", { ascending: false })
            .limit(30);

          results = ((data ?? []) as { match_score: number | null; creator: Record<string, unknown> }[]).map((item) => {
            const c = item.creator;
            return {
              id: c.id as string,
              handle: c.handle as string,
              display_name: c.display_name as string | null,
              avatar_url: c.avatar_url as string | null,
              followers: c.followers as number | null,
              tier: c.tier as string | null,
              matchScore: item.match_score,
            };
          });
        } else {
          const term = `%${query.trim()}%`;
          const { data } = await supabase
            .from("creators")
            .select("id, handle, display_name, avatar_url, followers, tier")
            .or(`handle.ilike.${term},display_name.ilike.${term}`)
            .order("followers", { ascending: false })
            .limit(30);

          type CreatorRow = { id: string; handle: string; display_name: string | null; avatar_url: string | null; followers: number | null; tier: string | null };
          results = ((data ?? []) as CreatorRow[]).map((c) => ({
            id: c.id,
            handle: c.handle,
            display_name: c.display_name,
            avatar_url: c.avatar_url,
            followers: c.followers,
            tier: c.tier,
            matchScore: null,
          }));
        }

        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
        toast.error("Failed to search creators");
      } finally {
        setSearchLoading(false);
      }
    },
    [supabase, brand, creatorSource],
  );

  // Auto-load recommendations
  useEffect(() => {
    if (creatorSource === "recommendations") {
      searchCreators("");
    }
  }, [creatorSource, searchCreators]);

  function toggleCreator(creator: SelectedCreator) {
    setSelectedCreators((prev) => {
      const exists = prev.find((c) => c.id === creator.id);
      if (exists) return prev.filter((c) => c.id !== creator.id);
      return [...prev, creator];
    });
  }

  function isSelected(id: string) {
    return selectedCreators.some((c) => c.id === id);
  }

  function updateForm<K extends keyof WizardState>(
    key: K,
    value: WizardState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMulti<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  // Submit
  async function handleSubmit(status: "draft" | "active") {
    if (!brand) return;

    // Validate
    if (!form.name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error("End date must be after start date");
      return;
    }

    setSaving(true);
    try {
      const campaign = await createCampaign(supabase, {
        brand_id: brand.id,
        name: form.name,
        description: form.description || null,
        goal: form.goal,
        status,
        total_budget: form.totalBudget ? parseFloat(form.totalBudget) : null,
        budget_per_creator: form.budgetPerCreatorMax
          ? parseFloat(form.budgetPerCreatorMax)
          : null,
        currency: "INR",
        target_regions:
          form.targetRegions.length > 0 ? form.targetRegions : null,
        target_niches: form.targetNiches.length > 0 ? form.targetNiches : null,
        target_tiers:
          form.creatorTiers.length > 0 ? form.creatorTiers : null,
        content_format: form.contentFormat,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
      });

      // Add selected creators
      if (selectedCreators.length > 0) {
        await Promise.all(
          selectedCreators.map((c) =>
            addCreatorToCampaign(supabase, campaign.id, c.id, c.matchScore),
          ),
        );
      }

      toast.success(
        status === "active"
          ? "Campaign launched!"
          : "Campaign saved as draft",
      );
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      console.error("Campaign creation error:", err);
      toast.error("Failed to create campaign. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canProceedStep1 = form.name.trim().length > 0;
  const totalEstimated =
    selectedCreators.length *
    (parseFloat(form.budgetPerCreatorMax) || 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New Campaign
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 1
              ? "Set up your campaign details"
              : step === 2
                ? "Choose creators for your campaign"
                : "Review and launch"}
          </p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: "Setup" },
          { num: 2, label: "Creators" },
          { num: 3, label: "Review" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  s.num < step
                    ? "bg-primary text-primary-foreground"
                    : s.num === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {s.num < step ? <Check className="size-3.5" /> : s.num}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:inline",
                  s.num <= step
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < 2 && (
              <div
                className={cn(
                  "h-px flex-1",
                  s.num < step ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Campaign Setup ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Campaign Name & Description */}
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Basics</h2>
              </div>

              <div>
                <Label htmlFor="name">
                  Campaign Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Diwali Festive Collection 2026"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Campaign goals, key messaging, dos & don'ts..."
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Campaign Goal */}
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Campaign Goal</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {GOAL_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm("goal", opt.value)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                        form.goal === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-input hover:border-foreground/30 hover:bg-muted/50",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5",
                          form.goal === opt.value
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Budget & Dates */}
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <IndianRupee className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Budget & Timeline</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="totalBudget">Total Budget</Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {"\u20B9"}
                    </span>
                    <Input
                      id="totalBudget"
                      type="number"
                      placeholder="e.g., 500000"
                      value={form.totalBudget}
                      onChange={(e) =>
                        updateForm("totalBudget", e.target.value)
                      }
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="budgetMin">Min per Creator</Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {"\u20B9"}
                    </span>
                    <Input
                      id="budgetMin"
                      type="number"
                      placeholder="e.g., 5000"
                      value={form.budgetPerCreatorMin}
                      onChange={(e) =>
                        updateForm("budgetPerCreatorMin", e.target.value)
                      }
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="budgetMax">Max per Creator</Label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {"\u20B9"}
                    </span>
                    <Input
                      id="budgetMax"
                      type="number"
                      placeholder="e.g., 25000"
                      value={form.budgetPerCreatorMax}
                      onChange={(e) =>
                        updateForm("budgetPerCreatorMax", e.target.value)
                      }
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateForm("startDate", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => updateForm("endDate", e.target.value)}
                    className="mt-1"
                    min={form.startDate || undefined}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Targeting */}
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Targeting</h2>
              </div>

              {/* Target Regions */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  Target Regions
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Select metros or states where you want creator reach
                </p>
                <div className="flex flex-wrap gap-2">
                  {REGION_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        updateForm(
                          "targetRegions",
                          toggleMulti(form.targetRegions, r),
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        form.targetRegions.includes(r)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-input text-muted-foreground hover:border-foreground/30",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Niches */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Palette className="size-3.5 text-muted-foreground" />
                  Creator Niches
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  What type of creators are you looking for?
                </p>
                <div className="flex flex-wrap gap-2">
                  {NICHE_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        updateForm(
                          "targetNiches",
                          toggleMulti(form.targetNiches, n),
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        form.targetNiches.includes(n)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-input text-muted-foreground hover:border-foreground/30",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Creator Tiers */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Crown className="size-3.5 text-muted-foreground" />
                  Creator Tiers
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  What follower range fits your campaign?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier.value}
                      type="button"
                      onClick={() =>
                        updateForm(
                          "creatorTiers",
                          toggleMulti(form.creatorTiers, tier.value),
                        )
                      }
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        form.creatorTiers.includes(tier.value)
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-input hover:border-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium block capitalize",
                          form.creatorTiers.includes(tier.value)
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {tier.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tier.range} followers
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Format */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Film className="size-3.5 text-muted-foreground" />
                  Content Format
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  What type of content do you want from creators?
                </p>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm("contentFormat", opt.value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        form.contentFormat === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-input hover:border-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium block",
                          form.contentFormat === opt.value
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {opt.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              size="lg"
            >
              Next: Add Creators
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Add Creators ── */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h2 className="text-base font-semibold">Add Creators</h2>
                </div>
                {selectedCreators.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Users className="size-3" />
                    {selectedCreators.length} selected
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Choose how you want to find creators. You can skip this step and add creators later.
              </p>

              {/* Source buttons */}
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreatorSource("recommendations");
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                    creatorSource === "recommendations"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-input hover:border-foreground/30 hover:bg-muted/50",
                  )}
                >
                  <Sparkles className="size-5 text-primary" />
                  <div className="text-center">
                    <p className="font-medium text-xs">AI Recommended</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Best matches for your brand
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatorSource("discovery");
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                    creatorSource === "discovery"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-input hover:border-foreground/30 hover:bg-muted/50",
                  )}
                >
                  <Compass className="size-5 text-blue-500" />
                  <div className="text-center">
                    <p className="font-medium text-xs">Search & Discover</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Find by handle or name
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatorSource("saved_list");
                    setSearchResults([]);
                    setSelectedListId(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                    creatorSource === "saved_list"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-input hover:border-foreground/30 hover:bg-muted/50",
                  )}
                >
                  <FolderOpen className="size-5 text-emerald-500" />
                  <div className="text-center">
                    <p className="font-medium text-xs">From Saved List</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Use your curated lists
                    </p>
                  </div>
                </button>
              </div>

              {/* Source-specific UI */}
              {creatorSource === "discovery" && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by handle or name (e.g., @neeshicorner, Priya)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") searchCreators(searchQuery);
                    }}
                    className="pl-9"
                  />
                </div>
              )}

              {creatorSource === "saved_list" && (
                <div className="flex flex-wrap gap-2">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => setSelectedListId(list.id)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        selectedListId === list.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground hover:border-foreground/30",
                      )}
                    >
                      {list.name}
                    </button>
                  ))}
                  {lists.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No saved lists found. Create lists from the My Creators
                      page.
                    </p>
                  )}
                </div>
              )}

              {/* Results */}
              {creatorSource && (
                <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border p-1">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {creatorSource === "recommendations"
                        ? "No recommendations yet. Complete your brand profile for personalized matches."
                        : creatorSource === "discovery"
                          ? "Type a handle or name and press Enter to search."
                          : "Select a list to see creators."}
                    </p>
                  ) : (
                    searchResults.map((creator) => (
                      <button
                        key={creator.id}
                        type="button"
                        onClick={() => toggleCreator(creator)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isSelected(creator.id)
                            ? "bg-primary/5"
                            : "hover:bg-muted",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                            isSelected(creator.id)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {isSelected(creator.id) && (
                            <Check className="size-3" />
                          )}
                        </div>
                        <Avatar className="size-8">
                          {creator.avatar_url && (
                            <AvatarImage
                              src={creator.avatar_url}
                              alt={creator.handle}
                            />
                          )}
                          <AvatarFallback className="text-xs">
                            {creator.handle.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-handle truncate text-foreground text-sm">
                            @{creator.handle}
                          </p>
                          {creator.display_name && (
                            <p className="truncate text-xs text-muted-foreground">
                              {creator.display_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {creator.followers != null && (
                            <span>{formatFollowers(creator.followers)}</span>
                          )}
                          {creator.tier && (
                            <Badge
                              variant="secondary"
                              className="capitalize text-[10px]"
                            >
                              {creator.tier}
                            </Badge>
                          )}
                          {creator.matchScore != null && (
                            <Badge className="text-[10px]">
                              {creator.matchScore}% match
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected creators preview */}
          {selectedCreators.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Selected Creators ({selectedCreators.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCreators.map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      @{c.handle}
                      <button
                        type="button"
                        onClick={() => toggleCreator(c)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
                {totalEstimated > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Estimated total: <span className="font-semibold text-foreground">{"\u20B9"}{totalEstimated.toLocaleString("en-IN")}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button onClick={() => setStep(3)} size="lg">
              Next: Review
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Create ── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Campaign Summary */}
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Campaign Summary</h2>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{form.name}</h3>
                  {form.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {form.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Target className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Goal:</span>
                    <span className="font-medium capitalize">
                      {form.goal.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Budget:</span>
                    <span className="font-medium">
                      {form.totalBudget
                        ? `\u20B9${parseFloat(form.totalBudget).toLocaleString("en-IN")}`
                        : "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Per Creator:</span>
                    <span className="font-medium">
                      {form.budgetPerCreatorMin || form.budgetPerCreatorMax
                        ? `\u20B9${form.budgetPerCreatorMin || "0"} – \u20B9${form.budgetPerCreatorMax || "0"}`
                        : "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Dates:</span>
                    <span className="font-medium">
                      {form.startDate
                        ? new Date(form.startDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "TBD"}
                      {form.endDate &&
                        ` – ${new Date(form.endDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Film className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Format:</span>
                    <span className="font-medium capitalize">
                      {form.contentFormat}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Creators:</span>
                    <span className="font-medium">
                      {selectedCreators.length} selected
                    </span>
                  </div>
                </div>
              </div>

              {(form.targetRegions.length > 0 || form.targetNiches.length > 0 || form.creatorTiers.length > 0) && (
                <div className="space-y-2">
                  {form.targetRegions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">
                        Regions:
                      </span>
                      {form.targetRegions.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {form.targetNiches.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">
                        Niches:
                      </span>
                      {form.targetNiches.map((n) => (
                        <Badge key={n} variant="secondary" className="text-[10px]">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {form.creatorTiers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">
                        Tiers:
                      </span>
                      {form.creatorTiers.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] capitalize">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Creators Table */}
          {selectedCreators.length > 0 && (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    Creators ({selectedCreators.length})
                  </h2>
                  {totalEstimated > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Est. total:{" "}
                      <span className="font-semibold text-foreground">
                        {"\u20B9"}{totalEstimated.toLocaleString("en-IN")}
                      </span>
                    </p>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">
                          Creator
                        </th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">
                          Tier
                        </th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">
                          Followers
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground">
                          Match
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCreators.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6">
                                {c.avatar_url && (
                                  <AvatarImage
                                    src={c.avatar_url}
                                    alt={c.handle}
                                  />
                                )}
                                <AvatarFallback className="text-[10px]">
                                  {c.handle.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-handle">@{c.handle}</span>
                                {c.display_name && (
                                  <span className="text-xs text-muted-foreground block">
                                    {c.display_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge
                              variant="secondary"
                              className="capitalize text-[10px]"
                            >
                              {c.tier ?? "--"}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4">
                            {c.followers != null
                              ? formatFollowers(c.followers)
                              : "--"}
                          </td>
                          <td className="py-2.5">
                            {c.matchScore != null ? `${c.matchScore}%` : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSubmit("draft")}
                disabled={saving}
                size="lg"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save as Draft"
                )}
              </Button>
              <Button
                onClick={() => handleSubmit("active")}
                disabled={saving}
                size="lg"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Launch Campaign
                    <Zap className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
