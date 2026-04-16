"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Brand, BrandUpdate } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipInput } from "@/components/onboarding/chip-input";
import { TagInput } from "@/components/onboarding/tag-input";
import { SegmentedControl } from "@/components/onboarding/segmented-control";
import {
  GlobeIcon,
  XIcon,
  BuildingIcon,
  PackageIcon,
  MapPinIcon,
  ArrowRightIcon,
  Loader2Icon,
  ImageIcon,
  AtSignIcon,
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

// Map price-range key to a representative avg_product_price number for the DB
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

function priceRangeLabel(range: PriceRange | null): string {
  return PRICE_RANGES.find((r) => r.value === range)?.label ?? "Not set";
}

// ---------------------------------------------------------------------------
// Helper: extract domain from URL
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

/**
 * Normalize an Instagram handle input: strip @, URL prefixes, trailing slash,
 * lowercase. Returns empty string if nothing useful is left.
 */
function normalizeInstagramHandle(raw: string): string {
  if (!raw) return "";
  let h = raw.trim().toLowerCase();
  // Strip instagram.com URL prefix if user pasted one
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  h = h.replace(/^instagram\.com\//i, "");
  h = h.replace(/^@/, "");
  h = h.replace(/\/$/, "");
  // Strip query string / anchor
  h = h.split("?")[0].split("#")[0];
  return h;
}

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
  const [topRegions, setTopRegions] = useState<string[]>([]);
  const [growthRegions, setGrowthRegions] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- website scraping auto-fill ----
  const [scraping, setScraping] = useState(false);
  const [scrapeSuggestions, setScrapeSuggestions] = useState<Record<string, unknown> | null>(null);

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
      const { data: brand } = await (supabase
        .from("brands") as any)
        .select("*")
        .eq("auth_user_id", user.id)
        .single() as { data: Brand | null };

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

        // Reverse-map avg_product_price to range key
        const price = brand.avg_product_price;
        if (price !== null && price !== undefined) {
          if (price < 500) setPriceRange("under_500");
          else if (price < 2000) setPriceRange("500_2000");
          else if (price < 5000) setPriceRange("2000_5000");
          else if (price < 15000) setPriceRange("5000_15000");
          else setPriceRange("15000_plus");
        }
      }
      setLoading(false);
    }
    loadBrand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- website blur -> extract domain + trigger scrape ----
  const handleWebsiteBlur = useCallback(() => {
    const domain = extractDomain(website);
    setWebsiteDomain(domain);

    // Auto-fill: scrape website when URL is entered
    if (domain && website.length > 5) {
      const normalizedUrl = website.startsWith("http") ? website : `https://${website}`;
      setScraping(true);
      setScrapeSuggestions(null);
      fetch("/api/scrape/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.data) {
            setScrapeSuggestions(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setScraping(false));
    }
  }, [website]);

  // ---- logo upload preview ----
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

  // ---- drop handler ----
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
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
    },
    []
  );

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

      // Upload logo if new file selected
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (brandId) {
        const { error: updateError } = await (supabase
          .from("brands") as any)
          .update(payload)
          .eq("id", brandId);

        if (updateError) {
          setError("Failed to save: " + updateError.message);
          setSaving(false);
          return;
        }
      } else {
        // Create brand if it doesn't exist yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase
          .from("brands") as any)
          .insert({
            auth_user_id: user.id,
            brand_name: brandName || "My Brand",
            ...payload,
          });

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
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---- render ----
  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Brand Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us about your brand so we can find the best creators for you.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ---------- Left column: form ---------- */}
        <div className="space-y-6">
          {/* Section A — About Your Brand */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BuildingIcon className="h-4 w-4 text-primary" />
                About Your Brand
              </CardTitle>
              <CardDescription>
                Basic information about your brand and identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Website URL */}
              <div className="space-y-1.5">
                <Label htmlFor="website">Website URL</Label>
                <div className="relative">
                  <GlobeIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://yourbrand.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    onBlur={handleWebsiteBlur}
                    className="pl-8"
                  />
                </div>
                {websiteDomain && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${websiteDomain}&sz=16`}
                      alt=""
                      className="h-4 w-4 rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {websiteDomain}
                  </p>
                )}
              </div>

              {/* Instagram handle */}
              <div className="space-y-1.5">
                <Label htmlFor="instagram-handle">
                  Instagram Handle{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <div className="relative">
                  <AtSignIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="instagram-handle"
                    type="text"
                    placeholder="@yourbrand"
                    value={instagramHandle ? "@" + instagramHandle : ""}
                    onChange={(e) =>
                      setInstagramHandle(normalizeInstagramHandle(e.target.value))
                    }
                    className="pl-8"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll analyze your recent posts to find creators who match your content.
                </p>
              </div>

              {/* Website scraping indicator + suggestions */}
              {scraping && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Analyzing your website...
                </div>
              )}
              {scrapeSuggestions && !scraping && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-900/20">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    We found info about your brand
                  </p>
                  <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
                    {scrapeSuggestions.description ? "Description" : ""}
                    {scrapeSuggestions.industry ? ", Industry" : ""}
                    {(scrapeSuggestions.product_categories as string[] | undefined)?.length ? ", Products" : ""}
                    {scrapeSuggestions.instagram_handle ? ", Instagram" : ""}
                    {" detected."}
                  </p>
                  <button
                    type="button"
                    className="mt-1.5 text-xs font-medium text-green-800 underline underline-offset-2 hover:text-green-900 dark:text-green-300"
                    onClick={() => {
                      const s = scrapeSuggestions;
                      if (s.industry && !industry) {
                        // Match to closest INDUSTRIES option
                        const industryStr = (s.industry as string).toLowerCase();
                        const matched = INDUSTRIES.find((i) =>
                          i.toLowerCase().includes(industryStr) || industryStr.includes(i.toLowerCase().split(" ")[0])
                        );
                        if (matched) setIndustry(matched);
                      }
                      if ((s.product_categories as string[] | undefined)?.length && productCategories.length === 0) {
                        setProductCategories(s.product_categories as string[]);
                      }
                      if (typeof s.instagram_handle === "string" && !instagramHandle) {
                        setInstagramHandle(normalizeInstagramHandle(s.instagram_handle));
                      }
                      setScrapeSuggestions(null);
                    }}
                  >
                    Apply suggestions
                  </button>
                </div>
              )}

              {/* Industry */}
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select
                  value={industry ?? undefined}
                  onValueChange={(val: string | null) => setIndustry(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Logo upload */}
              <div className="space-y-1.5">
                <Label>Brand Logo</Label>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/30 px-4 py-6 transition-colors hover:border-primary/40 hover:bg-secondary/50"
                >
                  {logoPreview || existingLogoUrl ? (
                    <div className="relative">
                      <img
                        src={logoPreview ?? existingLogoUrl!}
                        alt="Brand logo preview"
                        className="h-20 w-20 rounded-lg object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-white shadow-sm transition-colors hover:bg-destructive/80"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drag & drop or{" "}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          browse
                        </button>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        PNG, JPG, or SVG — max 2 MB
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section B — Your Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageIcon className="h-4 w-4 text-primary" />
                Your Products
              </CardTitle>
              <CardDescription>
                Help us understand what you sell.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product categories */}
              <div className="space-y-1.5">
                <Label>Product Categories</Label>
                <ChipInput
                  value={productCategories}
                  onChange={setProductCategories}
                  presets={PRODUCT_CATEGORY_PRESETS}
                  placeholder="Select or type categories..."
                  allowCustom
                />
              </div>

              {/* Average price */}
              <div className="space-y-1.5">
                <Label>Average Product Price</Label>
                <SegmentedControl
                  value={priceRange}
                  onChange={setPriceRange}
                  options={[...PRICE_RANGES]}
                  className="w-full"
                />
              </div>

              {/* Currency */}
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(val: string | null) => { if (val) setCurrency(val); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Section C — Target Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-primary" />
                Target Customer
              </CardTitle>
              <CardDescription>
                Where are your customers and where do you want to grow?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shipping zones */}
              <div className="space-y-1.5">
                <Label>Shipping Zones</Label>
                <ChipInput
                  value={shippingZones}
                  onChange={setShippingZones}
                  presets={SHIPPING_ZONE_PRESETS}
                  placeholder="Select shipping zones..."
                  allowCustom={false}
                />
              </div>

              {/* Top-performing regions */}
              <div className="space-y-1.5">
                <Label>
                  Top-Performing Regions{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <TagInput
                  value={topRegions}
                  onChange={setTopRegions}
                  placeholder="e.g. Mumbai, Delhi NCR..."
                />
              </div>

              {/* Growth target regions */}
              <div className="space-y-1.5">
                <Label>
                  Growth Target Regions{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <TagInput
                  value={growthRegions}
                  onChange={setGrowthRegions}
                  placeholder="e.g. Bangalore, Hyderabad..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-2 pb-8">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Next
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ---------- Right column: live preview ---------- */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm">Live Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo / avatar */}
                <div className="flex items-center gap-3">
                  {logoPreview || existingLogoUrl ? (
                    <img
                      src={logoPreview ?? existingLogoUrl!}
                      alt="Logo"
                      className="h-10 w-10 rounded-lg object-contain ring-1 ring-border"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BuildingIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="font-heading text-sm font-semibold">
                      {brandName || "Your Brand"}
                    </p>
                    {websiteDomain && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${websiteDomain}&sz=16`}
                          alt=""
                          className="h-3 w-3 rounded-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        {websiteDomain}
                      </p>
                    )}
                  </div>
                </div>

                {/* Instagram handle */}
                {instagramHandle && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Instagram
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm">
                      <AtSignIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      @{instagramHandle}
                    </p>
                  </div>
                )}

                {/* Industry */}
                {industry && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Industry
                    </p>
                    <p className="mt-0.5 text-sm">{industry}</p>
                  </div>
                )}

                {/* Product categories */}
                {productCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Product Categories
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {productCategories.map((cat) => (
                        <span
                          key={cat}
                          className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price range */}
                {priceRange && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Price Range
                    </p>
                    <p className="mt-0.5 text-sm">
                      {priceRangeLabel(priceRange)}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({currency})
                      </span>
                    </p>
                  </div>
                )}

                {/* Shipping zones */}
                {shippingZones.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Shipping Zones
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {shippingZones.map((zone) => (
                        <span
                          key={zone}
                          className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {zone}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!industry &&
                  productCategories.length === 0 &&
                  !priceRange &&
                  !websiteDomain && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Fill in the form to see a preview of your brand profile.
                    </p>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
