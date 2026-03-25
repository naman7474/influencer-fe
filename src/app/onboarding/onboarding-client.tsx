"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  CampaignGoal,
  OnboardingState,
  SaveBrandPreferencesRequest,
  SaveBrandProfileRequest,
  ShopifySyncStatus,
} from "@/types/api";

interface Props {
  initialState: OnboardingState;
  initialBrandName: string;
}

const STEP_LABELS = [
  "Brand profile",
  "Shopify connection",
  "Campaign preferences",
] as const;

function toCurrencyInput(value: number | null): string {
  if (value == null) {
    return "";
  }

  return (value / 100).toString();
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function OnboardingClient({ initialState, initialBrandName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<number>(initialState.current_step);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brandProfile, setBrandProfile] = useState<SaveBrandProfileRequest>({
    brand_name: initialState.brand_profile.brand_name || initialBrandName,
    website: initialState.brand_profile.website,
    logo_url: initialState.brand_profile.logo_url,
    industry: initialState.brand_profile.industry,
  });
  const [storeUrl, setStoreUrl] = useState(initialState.shopify.store_url || "");
  const [adminAccessToken, setAdminAccessToken] = useState("");
  const [shopifySyncStatus, setShopifySyncStatus] = useState<ShopifySyncStatus>(
    initialState.shopify.sync_status
  );
  const [shopifySyncError, setShopifySyncError] = useState<string | null>(
    initialState.shopify.sync_error
  );
  const [preferences, setPreferences] =
    useState<SaveBrandPreferencesRequest>({
      default_campaign_goal:
        initialState.preferences.default_campaign_goal || "awareness",
      budget_per_creator_min_paise:
        initialState.preferences.budget_per_creator_min_paise,
      budget_per_creator_max_paise:
        initialState.preferences.budget_per_creator_max_paise,
      content_format_pref:
        initialState.preferences.content_format_pref.length > 0
          ? initialState.preferences.content_format_pref
          : ["any"],
      past_collaborations: initialState.preferences.past_collaborations,
      competitor_brands: initialState.preferences.competitor_brands,
    });
  const [budgetMinInput, setBudgetMinInput] = useState(
    toCurrencyInput(initialState.preferences.budget_per_creator_min_paise)
  );
  const [budgetMaxInput, setBudgetMaxInput] = useState(
    toCurrencyInput(initialState.preferences.budget_per_creator_max_paise)
  );
  const [pastCollaborationsInput, setPastCollaborationsInput] = useState(
    initialState.preferences.past_collaborations.join(", ")
  );
  const [competitorBrandsInput, setCompetitorBrandsInput] = useState(
    initialState.preferences.competitor_brands.join(", ")
  );

  const currentStepLabel = useMemo(
    () => STEP_LABELS[Math.max(step - 1, 0)] ?? STEP_LABELS[0],
    [step]
  );

  const handleProfileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/v1/onboarding/brand-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(brandProfile),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message || "Unable to save brand profile.");
        }

        setStep(2);
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Unable to save brand profile."
        );
      }
    });
  };

  const handleShopifyConnect = () => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/v1/onboarding/shopify-connect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            store_url: storeUrl,
            admin_access_token: adminAccessToken,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload.error?.message || "Unable to save Shopify credentials."
          );
        }

        setShopifySyncStatus("queued");
        setShopifySyncError(null);
        setNotice("Shopify credentials saved. Background sync started.");
        setAdminAccessToken("");
        setStep(3);
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Unable to save Shopify credentials."
        );
      }
    });
  };

  const handlePreferencesSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const payload: SaveBrandPreferencesRequest = {
      ...preferences,
      budget_per_creator_min_paise: budgetMinInput
        ? Math.round(Number.parseFloat(budgetMinInput) * 100)
        : null,
      budget_per_creator_max_paise: budgetMaxInput
        ? Math.round(Number.parseFloat(budgetMaxInput) * 100)
        : null,
      past_collaborations: parseCsv(pastCollaborationsInput),
      competitor_brands: parseCsv(competitorBrandsInput),
    };

    startTransition(async () => {
      try {
        const response = await fetch("/api/v1/onboarding/preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error?.message || "Unable to save preferences.");
        }

        router.replace("/dashboard");
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Unable to save preferences."
        );
      }
    });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fed7aa,transparent_30%),linear-gradient(180deg,#fff7ed_0%,#ffffff_45%,#f8fafc_100%)] px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[34px] border border-white/60 bg-white/90 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Brand Onboarding
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
            Set up commerce signals and campaign defaults.
          </h1>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {STEP_LABELS.map((label, index) => {
              const currentIndex = index + 1;
              const isComplete = step > currentIndex;
              const isActive = step === currentIndex;

              return (
                <div
                  key={label}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${
                        isComplete || isActive
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-500 ring-1 ring-slate-200"
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : currentIndex}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{label}</p>
                      <p className="text-xs text-slate-500">
                        {isComplete ? "Completed" : isActive ? "Current step" : "Upcoming"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <Card className="rounded-[30px] border border-slate-200 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-slate-950">
              {currentStepLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {notice}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="brand_name">
                    Brand name
                  </label>
                  <Input
                    id="brand_name"
                    value={brandProfile.brand_name}
                    onChange={(event) =>
                      setBrandProfile((current) => ({
                        ...current,
                        brand_name: event.target.value,
                      }))
                    }
                    className="h-11 rounded-2xl border-slate-300"
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="website">
                      Website
                    </label>
                    <Input
                      id="website"
                      value={brandProfile.website || ""}
                      onChange={(event) =>
                        setBrandProfile((current) => ({
                          ...current,
                          website: event.target.value,
                        }))
                      }
                      placeholder="https://brand.com"
                      className="h-11 rounded-2xl border-slate-300"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="logo_url">
                      Logo URL
                    </label>
                    <Input
                      id="logo_url"
                      value={brandProfile.logo_url || ""}
                      onChange={(event) =>
                        setBrandProfile((current) => ({
                          ...current,
                          logo_url: event.target.value,
                        }))
                      }
                      placeholder="https://cdn.brand.com/logo.png"
                      className="h-11 rounded-2xl border-slate-300"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="industry">
                    Industry
                  </label>
                  <select
                    id="industry"
                    value={brandProfile.industry || ""}
                    onChange={(event) =>
                      setBrandProfile((current) => ({
                        ...current,
                        industry: event.target.value,
                      }))
                    }
                    className="h-11 rounded-2xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
                  >
                    <option value="">Select industry</option>
                    <option value="beauty">Beauty & personal care</option>
                    <option value="fashion">Fashion</option>
                    <option value="health">Health</option>
                    <option value="food">Food & beverage</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="tech">Tech</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="lg" className="rounded-2xl" disabled={isPending}>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="font-semibold text-slate-950">Connect Shopify</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Enter your `.myshopify.com` store URL and admin access token. We will save both on the brand row and start a background sync for orders, sessions, and products.
                  </p>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="store_url">
                    Store URL
                  </label>
                  <Input
                    id="store_url"
                    value={storeUrl}
                    onChange={(event) => setStoreUrl(event.target.value)}
                    placeholder="northwind-care.myshopify.com"
                    className="h-11 rounded-2xl border-slate-300"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="admin_access_token"
                  >
                    Admin access token
                  </label>
                  <Input
                    id="admin_access_token"
                    value={adminAccessToken}
                    onChange={(event) => setAdminAccessToken(event.target.value)}
                    placeholder="shpat_..."
                    type="password"
                    className="h-11 rounded-2xl border-slate-300"
                  />
                </div>

                <div className="rounded-[24px] bg-slate-950/[0.035] px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">Sync status</p>
                  <p className="mt-1">
                    {shopifySyncStatus === "queued" || shopifySyncStatus === "running"
                      ? "Sync in progress. Geo and brand-fit pages will show loading until data lands."
                      : shopifySyncStatus === "failed"
                        ? shopifySyncError || "Last sync failed. Update credentials and retry."
                        : initialState.shopify.last_sync_at
                          ? `Last synced at ${new Date(initialState.shopify.last_sync_at).toLocaleString()}.`
                          : "No Shopify sync has run yet."}
                  </p>
                </div>

                <div className="flex flex-wrap justify-between gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="rounded-2xl"
                    onClick={handleShopifyConnect}
                    disabled={isPending}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {isPending ? "Saving and starting sync..." : "Save and start sync"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="rounded-2xl border-slate-300"
                    onClick={() => setStep(3)}
                  >
                    Skip for now
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <form className="grid gap-4" onSubmit={handlePreferencesSubmit}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="goal">
                    Campaign goal
                  </label>
                  <select
                    id="goal"
                    value={preferences.default_campaign_goal}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        default_campaign_goal: event.target.value as CampaignGoal,
                      }))
                    }
                    className="h-11 rounded-2xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
                  >
                    <option value="awareness">Awareness</option>
                    <option value="conversion">Conversion</option>
                    <option value="ugc">UGC</option>
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="budget_min">
                      Min budget per creator (INR)
                    </label>
                    <Input
                      id="budget_min"
                      type="number"
                      min="0"
                      step="0.01"
                      value={budgetMinInput}
                      onChange={(event) => setBudgetMinInput(event.target.value)}
                      className="h-11 rounded-2xl border-slate-300"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="budget_max">
                      Max budget per creator (INR)
                    </label>
                    <Input
                      id="budget_max"
                      type="number"
                      min="0"
                      step="0.01"
                      value={budgetMaxInput}
                      onChange={(event) => setBudgetMaxInput(event.target.value)}
                      className="h-11 rounded-2xl border-slate-300"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="content_format"
                  >
                    Preferred content format
                  </label>
                  <select
                    id="content_format"
                    value={preferences.content_format_pref[0] || "any"}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        content_format_pref: [event.target.value],
                      }))
                    }
                    className="h-11 rounded-2xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
                  >
                    <option value="any">Any</option>
                    <option value="reels">Reels</option>
                    <option value="static">Static</option>
                    <option value="carousel">Carousel</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="past_collaborations"
                  >
                    Past collaborations
                  </label>
                  <textarea
                    id="past_collaborations"
                    value={pastCollaborationsInput}
                    onChange={(event) =>
                      setPastCollaborationsInput(event.target.value)
                    }
                    placeholder="Brand A, Brand B"
                    className="min-h-28 rounded-[24px] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-950"
                  />
                </div>

                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="competitor_brands"
                  >
                    Competitor brands
                  </label>
                  <textarea
                    id="competitor_brands"
                    value={competitorBrandsInput}
                    onChange={(event) => setCompetitorBrandsInput(event.target.value)}
                    placeholder="Competitor X, Competitor Y"
                    className="min-h-28 rounded-[24px] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-950"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="lg" className="rounded-2xl" disabled={isPending}>
                    {isPending ? "Finishing setup..." : "Complete onboarding"}
                  </Button>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
