"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCampaign, addCreatorToCampaign } from "@/lib/queries/campaigns";
import { getLists, getListItems } from "@/lib/queries/lists";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CreatorList, Brand } from "@/lib/types/database";

import {
  INITIAL_WIZARD_STATE,
  type WizardState,
  type SelectedCreator,
  type CreatorSource,
} from "./wizard-types";
import { StepSetup } from "./step-setup";
import { StepCreators } from "./step-creators";
import { StepReview } from "./step-review";

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
  const [form, setForm] = useState<WizardState>(INITIAL_WIZARD_STATE);

  // Step 2: Add creators
  const [creatorSource, setCreatorSource] = useState<CreatorSource | null>(null);
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreator[]>([]);
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

  function updateForm<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSourceChange(source: CreatorSource) {
    setCreatorSource(source);
    setSearchResults([]);
    setSearchQuery("");
    if (source !== "saved_list") {
      setSelectedListId(null);
    }
  }

  // Submit
  async function handleSubmit(status: "draft" | "active") {
    if (!brand) return;

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

  const totalEstimated =
    selectedCreators.length * (parseFloat(form.budgetPerCreatorMax) || 0);

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

      {/* Step content */}
      {step === 1 && (
        <StepSetup
          form={form}
          updateForm={updateForm}
          hasBudgetDefaults={
            brand != null &&
            (brand.budget_per_creator_min != null || brand.budget_per_creator_max != null)
          }
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepCreators
          creatorSource={creatorSource}
          setCreatorSource={handleSourceChange}
          selectedCreators={selectedCreators}
          toggleCreator={toggleCreator}
          isSelected={isSelected}
          searchResults={searchResults}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchLoading={searchLoading}
          searchCreators={searchCreators}
          lists={lists}
          selectedListId={selectedListId}
          setSelectedListId={setSelectedListId}
          totalEstimated={totalEstimated}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepReview
          form={form}
          selectedCreators={selectedCreators}
          totalEstimated={totalEstimated}
          saving={saving}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
