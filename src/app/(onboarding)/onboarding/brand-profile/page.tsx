"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Brand, BrandUpdate } from "@/lib/types/database";
import { ObPill } from "@/components/onboarding/ob-pill";
import { ObRow } from "@/components/onboarding/ob-row";
import { ObAgentTag } from "@/components/onboarding/ob-agent-tag";
import { ObTerminal, type TerminalLine } from "@/components/onboarding/ob-terminal";
import { ChipInput } from "@/components/onboarding/chip-input";
import {
  Loader2Icon,
  ImageIcon,
  XIcon,
  CheckIcon,
  ArrowRightIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  "Beauty",
  "Fashion",
  "Food & Beverage",
  "Fitness",
  "Tech",
  "Home",
  "Wellness",
  "Baby",
  "Pet",
  "Lifestyle",
  "Other",
] as const;

const PRODUCT_CATEGORY_PRESETS = [
  "Skincare",
  "Haircare",
  "Makeup",
  "Fashion",
  "Fitness",
  "Food",
  "Tech",
  "Home",
  "Wellness",
  "Baby",
  "Pet",
];

const PRICE_RANGES = [
  { label: "Under \u20B9500", value: "under_500" },
  { label: "\u20B9500\u20132,000", value: "500_2000" },
  { label: "\u20B92,000\u20135,000", value: "2000_5000" },
  { label: "\u20B95,000\u201315,000", value: "5000_15000" },
  { label: "\u20B915,000+", value: "15000_plus" },
] as const;

const CURRENCY_OPTIONS = [
  { label: "INR (\u20B9)", value: "INR" },
  { label: "USD ($)", value: "USD" },
  { label: "EUR (\u20AC)", value: "EUR" },
  { label: "GBP (\u00A3)", value: "GBP" },
];

const SHIPPING_ZONE_PRESETS = [
  "All India",
  "Delhi",
  "Mumbai",
  "Bangalore",
  "Chennai",
  "Hyderabad",
  "Kolkata",
  "Pune",
  "International",
];

type PriceRange = (typeof PRICE_RANGES)[number]["value"];

function priceRangeToNumber(range: PriceRange | null): number | null {
  switch (range) {
    case "under_500":
      return 250;
    case "500_2000":
      return 1250;
    case "2000_5000":
      return 3500;
    case "5000_15000":
      return 10000;
    case "15000_plus":
      return 20000;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomain(url: string): string | null {
  try {
    let normalised = url.trim();
    if (!/^https?:\/\//i.test(normalised)) {
      normalised = "https://" + normalised;
    }
    const parsed = new URL(normalised);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeInstagramHandle(raw: string): string {
  if (!raw) return "";
  let h = raw.trim().toLowerCase();
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  h = h.replace(/^instagram\.com\//i, "");
  h = h.replace(/^@/, "");
  h = h.replace(/\/$/, "");
  h = h.split("?")[0].split("#")[0];
  return h;
}

// Internal view states for the page
type ViewPhase = "url" | "scraping" | "review";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- form state ----
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");
  const [websiteDomain, setWebsiteDomain] = useState<string | null>(null);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null);
  const [currency, setCurrency] = useState("INR");

  const [shippingZones, setShippingZones] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- view phase ----
  const [phase, setPhase] = useState<ViewPhase>("url");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [scrapePercent, setScrapePercent] = useState(0);
  const [scrapeDescription, setScrapeDescription] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  // ---- load existing brand data ----
  useEffect(() => {
    async function loadBrand() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: brand } = (await (supabase.from("brands") as any)
        .select("*")
        .eq("auth_user_id", user.id)
        .single()) as { data: Brand | null };

      if (brand) {
        setBrandId(brand.id);
        setBrandName(brand.brand_name ?? "");
        setWebsite(brand.website ?? "");
        setWebsiteDomain(extractDomain(brand.website ?? ""));
        setInstagramHandle(brand.instagram_handle ?? "");
        setIndustry(brand.industry ?? null);
        setExistingLogoUrl(brand.logo_url ?? null);
        setProductCategories(brand.product_categories ?? []);
        setCurrency(brand.price_currency ?? "INR");
        setShippingZones(brand.shipping_zones ?? []);

        const price = brand.avg_product_price;
        if (price !== null && price !== undefined) {
          if (price < 500) setPriceRange("under_500");
          else if (price < 2000) setPriceRange("500_2000");
          else if (price < 5000) setPriceRange("2000_5000");
          else if (price < 15000) setPriceRange("5000_15000");
          else setPriceRange("15000_plus");
        }

        // If brand already has data, skip straight to review
        if (brand.website || brand.industry) {
          setPhase("review");
        }
      }
      setLoading(false);
    }
    loadBrand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- website scrape + terminal animation ----
  const handleScanWebsite = useCallback(() => {
    const domain = extractDomain(website);
    if (!domain) return;

    setWebsiteDomain(domain);
    setPhase("scraping");
    setTerminalLines([]);
    setScrapePercent(0);

    const normalizedUrl = website.startsWith("http")
      ? website
      : `https://${website}`;

    // Start the terminal animation
    const simLines: TerminalLine[] = [
      { type: "GET", path: domain, detail: "connecting..." },
      { type: "read", path: "/", detail: "homepage" },
      { type: "read", path: "/shop", detail: "scanning products" },
      { type: "parse", path: "brand voice", detail: "analyzing tone" },
    ];

    simLines.forEach((ln, i) => {
      setTimeout(() => {
        setTerminalLines((prev) => [...prev, ln]);
        setScrapePercent(Math.round(((i + 1) / (simLines.length + 2)) * 80));
      }, 400 + i * 600);
    });

    // Real API call
    fetch("/api/scrape/website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalizedUrl }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          const s = res.data;

          // Apply scrape results
          if (s.brand_name && !brandName) setBrandName(s.brand_name);
          if (s.description) setScrapeDescription(s.description);
          if (s.industry) {
            const industryStr = (s.industry as string).toLowerCase();
            const matched = INDUSTRIES.find(
              (i) =>
                i.toLowerCase().includes(industryStr) ||
                industryStr.includes(i.toLowerCase().split(" ")[0])
            );
            if (matched) setIndustry(matched);
          }
          if (
            (s.product_categories as string[] | undefined)?.length &&
            productCategories.length === 0
          ) {
            setProductCategories(s.product_categories as string[]);
          }
          if (typeof s.instagram_handle === "string" && !instagramHandle) {
            setInstagramHandle(normalizeInstagramHandle(s.instagram_handle));
          }
          if (s.price_range) {
            const pr = s.price_range as string;
            const matched = PRICE_RANGES.find(
              (r) =>
                r.value === pr ||
                r.label.toLowerCase().includes(pr.toLowerCase())
            );
            if (matched) setPriceRange(matched.value);
          }

          setAutoFilled(true);

          // Final terminal lines
          const detail = [
            s.industry && `industry: ${s.industry}`,
            s.product_categories?.length &&
              `${(s.product_categories as string[]).length} categories`,
            s.instagram_handle && `IG: @${s.instagram_handle}`,
          ]
            .filter(Boolean)
            .join(" · ");

          setTerminalLines((prev) => [
            ...prev,
            { type: "parse", path: "extracting data", detail: detail || "done" },
            { type: "\u2713", path: "ready", detail: "brand profile built" },
          ]);
          setScrapePercent(100);

          setTimeout(() => setPhase("review"), 900);
        } else {
          // Scrape returned no data, still go to review
          setTerminalLines((prev) => [
            ...prev,
            {
              type: "\u2713",
              path: "done",
              detail: "fill in your details below",
            },
          ]);
          setScrapePercent(100);
          setTimeout(() => setPhase("review"), 700);
        }
      })
      .catch(() => {
        setTerminalLines((prev) => [
          ...prev,
          {
            type: "\u2713",
            path: "done",
            detail: "could not reach site — fill in manually",
          },
        ]);
        setScrapePercent(100);
        setTimeout(() => setPhase("review"), 700);
      });
  }, [website, brandName, productCategories.length, instagramHandle]);

  // ---- logo upload ----
  const handleLogoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setError("Logo must be under 2 MB.");
        return;
      }
      if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
        setError("Logo must be PNG, JPG, or SVG.");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setError(null);
    },
    []
  );

  const removeLogo = useCallback(() => {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [logoPreview]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be under 2 MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      setError("Logo must be PNG, JPG, or SVG.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError(null);
  }, []);

  // ---- submit ----
  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      let logoUrl = existingLogoUrl;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop() ?? "png";
        const filePath = `brand-logos/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("brand-assets")
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) {
          setError("Failed to upload logo: " + uploadError.message);
          setSaving(false);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("brand-assets").getPublicUrl(filePath);
        logoUrl = publicUrl;
      }

      const payload: BrandUpdate = {
        brand_name: brandName || "My Brand",
        website: website || null,
        instagram_handle: instagramHandle || null,
        industry,
        logo_url: logoUrl,
        product_categories:
          productCategories.length > 0 ? productCategories : null,
        avg_product_price: priceRangeToNumber(priceRange),
        price_currency: currency,
        shipping_zones: shippingZones.length > 0 ? shippingZones : null,
        onboarding_step: 2,
        updated_at: new Date().toISOString(),
      };

      if (brandId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from("brands") as any)
          .update(payload)
          .eq("id", brandId);

        if (updateError) {
          setError("Failed to save: " + updateError.message);
          setSaving(false);
          return;
        }
      } else {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase.from("brands") as any).insert(
          {
            auth_user_id: currentUser!.id,
            ...payload,
          }
        );

        if (insertError) {
          setError("Failed to save: " + insertError.message);
          setSaving(false);
          return;
        }
      }

      router.push("/onboarding/integrations");
    } catch (err) {
      setError("An unexpected error occurred.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ---- loading state ----
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <svg
          className="h-5 w-5"
          viewBox="0 0 16 16"
          fill="none"
          style={{ animation: "obSpin 0.8s linear infinite" }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="var(--ob-clay)"
            strokeOpacity="0.2"
            strokeWidth="1.6"
          />
          <path
            d="M8 2a6 6 0 016 6"
            stroke="var(--ob-clay)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // =====================================================================
  // PHASE 1: URL Input — centered hero
  // =====================================================================
  if (phase === "url") {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center"
        style={{ animation: "obRise 0.4s ease-out" }}
      >
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[1.4px] text-[var(--ob-clay)]">
          &#x25CF; step 1 of 3 &middot; discover
        </div>

        <h1 className="mx-auto max-w-2xl font-serif text-5xl leading-[1.06] tracking-tight md:text-6xl">
          Drop a link.
          <br />
          <span className="italic text-[var(--ob-clay)]">
            We&rsquo;ll do the rest.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-lg text-base text-[var(--ob-ink2)]">
          Paste your website and we&rsquo;ll read your pages to understand your
          brand &mdash; products, pricing, positioning, voice.
        </p>

        <div className="mt-10 flex w-full max-w-xl items-center gap-0 rounded-xl border-[1.5px] border-[var(--ob-line2)] bg-[var(--ob-card)] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <span className="flex items-center pl-3 pr-1 font-mono text-[13px] text-[var(--ob-ink3)]">
            https://
          </span>
          <input
            autoFocus
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && website.length > 3) handleScanWebsite();
            }}
            placeholder="yourbrand.com"
            className="flex-1 border-none bg-transparent px-1 py-3 font-mono text-[17px] text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)]"
          />
          <button
            onClick={handleScanWebsite}
            disabled={website.length < 3}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ob-ink)] px-5 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Scan
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={() => setPhase("review")}
          className="mt-4 text-[13px] text-[var(--ob-ink3)] underline underline-offset-[3px] transition-colors hover:text-[var(--ob-clay)]"
        >
          Skip &mdash; I&rsquo;ll fill it in myself
        </button>

        <div className="mt-8 flex gap-5 font-mono text-[11px] text-[var(--ob-ink3)]">
          <span>&crarr; enter to scan</span>
          <span>&middot; safe &middot; nothing is saved yet</span>
        </div>
      </div>
    );
  }

  // =====================================================================
  // PHASE 2: Scraping terminal
  // =====================================================================
  if (phase === "scraping") {
    return (
      <div
        className="grid min-h-[60vh] items-center gap-8 md:grid-cols-2"
        style={{ animation: "obRise 0.35s ease-out" }}
      >
        {/* Left — copy */}
        <div className="flex flex-col justify-center">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.4px] text-[var(--ob-clay)]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--ob-clay)]"
              style={{ animation: "obPulse 1.2s infinite" }}
            />
            Reading your website
          </div>

          <h1 className="font-serif text-4xl leading-[1.1] tracking-tight md:text-5xl">
            One moment.
            <br />
            <span className="italic text-[var(--ob-clay)]">
              We&rsquo;re learning your brand.
            </span>
          </h1>

          <p className="mt-4 max-w-md text-[15px] text-[var(--ob-ink2)]">
            We&rsquo;re crawling your site, parsing product pages, and learning
            your voice. Usually takes about 10 seconds.
          </p>

          {/* Progress bar */}
          <div className="mt-8">
            <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px] text-[var(--ob-ink3)]">
              <span>progress</span>
              <span>{scrapePercent}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--ob-line)]">
              <div
                className="h-full rounded-full bg-[var(--ob-clay)] transition-[width] duration-300"
                style={{ width: `${scrapePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right — terminal */}
        <ObTerminal lines={terminalLines} className="h-full min-h-[300px]" />
      </div>
    );
  }

  // =====================================================================
  // PHASE 3: Review & edit form
  // =====================================================================
  return (
    <div style={{ animation: "obRise 0.35s ease-out" }}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {autoFilled && (
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.4px] text-[var(--ob-ok)]">
              <CheckIcon className="h-3 w-3" />
              website read &middot; brand profile built
            </div>
          )}
          <h1 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            {autoFilled ? (
              <>
                Here&rsquo;s what we found.{" "}
                <span className="italic text-[var(--ob-clay)]">
                  Does this look right?
                </span>
              </>
            ) : (
              <>
                Tell us about{" "}
                <span className="italic text-[var(--ob-clay)]">
                  your brand.
                </span>
              </>
            )}
          </h1>
          <p className="mt-2 text-sm text-[var(--ob-ink2)]">
            {autoFilled
              ? "Anything below is editable. Make it yours."
              : "Fill in your brand details to help us find the best creators."}
          </p>
        </div>

        {websiteDomain && (
          <div className="text-right font-mono text-[11px] text-[var(--ob-ink3)]">
            <div>source</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[var(--ob-ink)]">
              <img
                src={`https://www.google.com/s2/favicons?domain=${websiteDomain}&sz=16`}
                alt=""
                className="h-3.5 w-3.5 rounded-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {websiteDomain}
            </div>
          </div>
        )}
      </div>

      {/* Two-column form */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          {/* Brand name + logo */}
          <div className="flex items-center gap-3.5 rounded-xl border border-[var(--ob-line)] bg-[var(--ob-card)] p-3.5">
            {/* Logo area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
            >
              {logoPreview || existingLogoUrl ? (
                <>
                  <img
                    src={logoPreview ?? existingLogoUrl!}
                    alt="Brand logo"
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ob-ink)] text-white"
                  >
                    <XIcon className="h-2.5 w-2.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-full w-full items-center justify-center rounded-[10px] bg-[var(--ob-ink)] text-white transition-opacity hover:opacity-80"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoSelect}
                className="hidden"
              />
            </div>

            <div className="min-w-0 flex-1">
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Your Brand Name"
                className="w-full border-none bg-transparent font-serif text-2xl tracking-tight text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)]"
              />
              <div className="mt-0.5 font-mono text-[11px] text-[var(--ob-ink3)]">
                {websiteDomain
                  ? `detected from ${websiteDomain}`
                  : "enter your brand name"}
              </div>
            </div>

            {autoFilled && <ObAgentTag />}
          </div>

          {/* Website URL */}
          <ObRow label="Website" hint="we read this to build your profile">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] px-3 py-2.5">
              <span className="shrink-0 font-mono text-xs text-[var(--ob-ink3)]">
                https://
              </span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onBlur={() => setWebsiteDomain(extractDomain(website))}
                placeholder="yourbrand.com"
                className="flex-1 border-none bg-transparent font-mono text-sm text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)]"
              />
              {!autoFilled && website.length > 3 && (
                <button
                  onClick={handleScanWebsite}
                  className="shrink-0 rounded-md bg-[var(--ob-ink)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Scan
                </button>
              )}
            </div>
          </ObRow>

          {/* Instagram handle */}
          <ObRow label="Instagram" hint="we'll use this for creator matching">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] px-3 py-2.5">
              <span className="shrink-0 font-serif text-lg italic text-[var(--ob-ink3)]">
                @
              </span>
              <input
                value={instagramHandle}
                onChange={(e) =>
                  setInstagramHandle(normalizeInstagramHandle(e.target.value))
                }
                placeholder="yourbrand"
                className="flex-1 border-none bg-transparent font-mono text-sm text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)]"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </ObRow>

          {/* Industry */}
          <ObRow label="Industry" hint={autoFilled ? "inferred from your product pages" : undefined}>
            <ObPill
              options={INDUSTRIES.map((i) => i)}
              value={industry ?? ""}
              onChange={(val) => setIndustry(val as string)}
            />
          </ObRow>

          {/* Product categories */}
          <ObRow
            label="Product categories"
            hint={autoFilled ? "tap to remove / add" : "what do you sell?"}
          >
            <ChipInput
              value={productCategories}
              onChange={setProductCategories}
              presets={PRODUCT_CATEGORY_PRESETS}
              placeholder="Select or type categories..."
              allowCustom
            />
          </ObRow>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Description */}
          {scrapeDescription && (
            <ObRow label="Brand description" hint="one sentence, in your voice">
              <textarea
                value={scrapeDescription}
                onChange={(e) => setScrapeDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] px-3.5 py-3 text-sm leading-relaxed text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)] focus:border-[var(--ob-clay)]"
              />
            </ObRow>
          )}

          {/* Price range */}
          <ObRow
            label="Average price"
            hint={autoFilled ? "from product pages" : "your typical product price"}
          >
            <ObPill
              options={PRICE_RANGES.map((r) => ({
                value: r.value,
                label: r.label,
              }))}
              value={priceRange ?? ""}
              onChange={(val) => setPriceRange(val as PriceRange)}
            />
          </ObRow>

          {/* Currency */}
          <ObRow label="Currency">
            <ObPill
              options={CURRENCY_OPTIONS.map((c) => ({
                value: c.value,
                label: c.label,
              }))}
              value={currency}
              onChange={(val) => setCurrency(val as string)}
            />
          </ObRow>

          {/* Shipping zones */}
          <ObRow
            label="Shipping zones"
            hint="match creators whose audience you can reach"
          >
            <ObPill
              options={SHIPPING_ZONE_PRESETS}
              value={shippingZones}
              onChange={(val) => setShippingZones(val as string[])}
              multi
            />
          </ObRow>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-[var(--ob-line)] pt-5 pb-8">
        <button
          onClick={() => {
            if (autoFilled) {
              setPhase("url");
            }
          }}
          className={`text-[13px] font-medium text-[var(--ob-ink2)] transition-colors hover:text-[var(--ob-ink)] ${!autoFilled ? "invisible" : ""}`}
        >
          &larr; re-scan
        </button>

        <button
          onClick={handleSubmit}
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
              {autoFilled ? "Looks right \u00B7 continue" : "Continue"}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
