"use client";

import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Brand } from "@/lib/types/database";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { InstagramIntegrationCard } from "@/components/settings/instagram-integration-card";
import { DisplayNameCard } from "@/components/settings/display-name-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Plug,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FallbackImg } from "@/components/ui/fallback-img";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INDUSTRIES = [
  "Fashion & Apparel",
  "Beauty & Cosmetics",
  "Health & Wellness",
  "Food & Beverage",
  "Technology",
  "Travel & Hospitality",
  "Fitness & Sports",
  "Home & Living",
  "Education",
  "Finance",
  "Entertainment",
  "Automotive",
  "Other",
] as const;

const CAMPAIGN_GOALS: { value: string; label: string }[] = [
  { value: "awareness", label: "Brand Awareness" },
  { value: "conversion", label: "Conversion / Sales" },
  { value: "ugc_generation", label: "UGC Generation" },
];

const CONTENT_FORMATS: { value: string; label: string }[] = [
  { value: "reels", label: "Reels" },
  { value: "static", label: "Static Posts" },
  { value: "carousel", label: "Carousel" },
  { value: "any", label: "Any Format" },
];

/* ------------------------------------------------------------------ */
/*  Tag Input                                                          */
/* ------------------------------------------------------------------ */

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addTag = useCallback(
    (value: string) => {
      const trimmed = value.trim().replace(/^@/, "");
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
      setInputValue("");
    },
    [tags, onChange]
  );

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {tags.map((tag, i) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          @{tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="size-2.5" />
          </button>
        </Badge>
      ))}
      <input
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue);
        }}
        placeholder={tags.length === 0 ? placeholder : "Add more..."}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Settings Client Component                                     */
/* ------------------------------------------------------------------ */

interface SettingsClientProps {
  brand: Brand | null;
  userEmail: string;
}

export function SettingsClient({ brand, userEmail }: SettingsClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // ---- Profile state ----
  const [brandName, setBrandName] = useState(brand?.brand_name ?? "");
  const [website, setWebsite] = useState(brand?.website ?? "");
  const [industry, setIndustry] = useState(brand?.industry ?? "");
  const [logoUrl, setLogoUrl] = useState(brand?.logo_url ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // ---- Preferences state ----
  const [campaignGoal, setCampaignGoal] = useState(
    brand?.default_campaign_goal ?? ""
  );
  const [budgetMin, setBudgetMin] = useState(
    brand?.budget_per_creator_min?.toString() ?? ""
  );
  const [budgetMax, setBudgetMax] = useState(
    brand?.budget_per_creator_max?.toString() ?? ""
  );
  const [contentFormat, setContentFormat] = useState(
    brand?.content_format_pref ?? ""
  );
  const [pastCollabs, setPastCollabs] = useState<string[]>(
    brand?.past_collaborations ?? []
  );
  const [competitors, setCompetitors] = useState<string[]>(
    brand?.competitor_brands ?? []
  );
  // Derive target regions from shipping_zones
  const ZONE_LABEL_MAP: Record<string, string> = {
    "North India": "north",
    "South India": "south",
    "East India": "east",
    "West India": "west",
  };
  const ZONE_KEY_MAP: Record<string, string> = {
    north: "North India",
    south: "South India",
    east: "East India",
    west: "West India",
  };
  const [settingsTargetRegions, setSettingsTargetRegions] = useState<string[]>(
    () => {
      const zones = brand?.shipping_zones ?? [];
      return zones
        .map((z) => ZONE_LABEL_MAP[z])
        .filter((z): z is string => !!z);
    }
  );
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);

  // ---- Brand Safety state ----
  const [brandDescription, setBrandDescription] = useState(brand?.brand_description ?? "");
  const [brandValues, setBrandValues] = useState<string[]>(brand?.brand_values ?? []);
  const [targetAudience, setTargetAudience] = useState(brand?.target_audience ?? "");
  const [brandVoicePref, setBrandVoicePref] = useState(brand?.brand_voice_preference ?? "");
  const [instagramHandle, setInstagramHandle] = useState(brand?.instagram_handle ?? "");
  const [minAudienceAge, setMinAudienceAge] = useState(brand?.min_audience_age?.toString() ?? "");
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>([]);
  const [contentDos, setContentDos] = useState<string[]>([]);
  const [contentDonts, setContentDonts] = useState<string[]>([]);
  const [contentRating, setContentRating] = useState("general");
  const [requirePartnershipLabel, setRequirePartnershipLabel] = useState(true);
  const [safetySaving, setSafetySaving] = useState(false);
  const [safetyMessage, setSafetyMessage] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);

  // Load brand guidelines on mount
  useEffect(() => {
    if (!brand?.id) return;
    fetch(`/api/brands/${brand.id}/guidelines`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          const g = res.data;
          setForbiddenTopics(g.forbidden_topics ?? []);
          setContentDos(g.content_dos ?? []);
          setContentDonts(g.content_donts ?? []);
          setContentRating(g.content_rating ?? "general");
          setRequirePartnershipLabel(g.require_paid_partnership_label ?? true);
        }
      })
      .catch(() => {}); // guidelines may not exist yet
  }, [brand?.id]);

  // ---- Account state ----
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  async function handleSaveProfile() {
    if (!brand) return;
    setProfileSaving(true);
    setProfileMessage(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
      .from("brands") as any)
      .update({
        brand_name: brandName,
        website: website || null,
        industry: industry || null,
        logo_url: logoUrl || null,
      })
      .eq("id", brand.id);

    setProfileSaving(false);
    if (error) {
      setProfileMessage("Failed to save profile. Please try again.");
    } else {
      setProfileMessage("Profile saved successfully.");
      router.refresh();
    }
  }

  async function handleSavePreferences() {
    if (!brand) return;
    setPrefsSaving(true);
    setPrefsMessage(null);

    // Merge target region zone labels into shipping_zones
    const existingNonZones = (brand?.shipping_zones ?? []).filter(
      (z) => !ZONE_LABEL_MAP[z]
    );
    const regionLabels = settingsTargetRegions.map((r) => ZONE_KEY_MAP[r] ?? r);
    const mergedZones = [...existingNonZones, ...regionLabels];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
      .from("brands") as any)
      .update({
        default_campaign_goal: (campaignGoal || null) as Brand["default_campaign_goal"],
        budget_per_creator_min: budgetMin ? Number(budgetMin) : null,
        budget_per_creator_max: budgetMax ? Number(budgetMax) : null,
        content_format_pref: (contentFormat || null) as Brand["content_format_pref"],
        shipping_zones: mergedZones.length > 0 ? mergedZones : null,
        past_collaborations: pastCollabs.length > 0 ? pastCollabs : null,
        competitor_brands: competitors.length > 0 ? competitors : null,
      })
      .eq("id", brand.id);

    setPrefsSaving(false);
    if (error) {
      setPrefsMessage("Failed to save preferences. Please try again.");
    } else {
      setPrefsMessage("Preferences saved successfully.");
      router.refresh();
    }
  }

  async function handleDisconnectShopify() {
    if (!brand) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase
      .from("brands") as any)
      .update({
        shopify_connected: false,
        shopify_store_url: null,
      })
      .eq("id", brand.id);
    router.refresh();
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters.");
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setPasswordSaving(false);
    if (error) {
      setPasswordMessage(error.message);
    } else {
      setPasswordMessage("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleDeleteAccount() {
    // In a real app, this would call a server-side function to delete the account
    // For now, sign out and show a message
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !brand) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${brand.id}/logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setProfileMessage("Failed to upload logo. Please try again.");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("brand-assets").getPublicUrl(filePath);

    setLogoUrl(publicUrl);
    setProfileMessage("Logo uploaded. Click Save to apply.");
  }

  async function handleSaveBrandSafety() {
    if (!brand) return;
    setSafetySaving(true);
    setSafetyMessage(null);

    // Save brand identity fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: brandError } = await (supabase.from("brands") as any)
      .update({
        brand_description: brandDescription || null,
        brand_values: brandValues.length ? brandValues : null,
        target_audience: targetAudience || null,
        brand_voice_preference: brandVoicePref || null,
        instagram_handle: instagramHandle || null,
        min_audience_age: minAudienceAge ? parseInt(minAudienceAge, 10) : null,
      })
      .eq("id", brand.id);

    if (brandError) {
      setSafetySaving(false);
      setSafetyMessage("Failed to save brand identity.");
      return;
    }

    // Save guidelines
    const guidelinesRes = await fetch(`/api/brands/${brand.id}/guidelines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forbidden_topics: forbiddenTopics,
        content_dos: contentDos,
        content_donts: contentDonts,
        content_rating: contentRating,
        require_paid_partnership_label: requirePartnershipLabel,
      }),
    });

    if (!guidelinesRes.ok) {
      setSafetySaving(false);
      setSafetyMessage("Failed to save content guidelines.");
      return;
    }

    // Trigger match recomputation with updated brand safety config
    fetch("/api/matching/compute", { method: "POST" }).catch(() => {});

    setSafetySaving(false);
    setSafetyMessage("Brand safety settings saved. Match scores are being recomputed.");
    router.refresh();
  }

  async function handleRescrapeWebsite() {
    if (!brand) return;
    setScraping(true);
    setSafetyMessage(null);

    try {
      const res = await fetch(`/api/brands/${brand.id}/scrape`, {
        method: "POST",
      });
      const result = await res.json();

      if (!res.ok || result.error) {
        setSafetyMessage(result.error || "Failed to analyze website.");
      } else if (result.data) {
        // Auto-fill from extraction
        if (result.data.description && !brandDescription) {
          setBrandDescription(result.data.description);
        }
        if (result.data.brand_values?.length && !brandValues.length) {
          setBrandValues(result.data.brand_values);
        }
        if (result.data.target_audience && !targetAudience) {
          setTargetAudience(result.data.target_audience);
        }
        setSafetyMessage("Website analyzed. Review the extracted data and save.");
      }
    } catch {
      setSafetyMessage("Failed to analyze website.");
    }
    setScraping(false);
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const [activeSection, setActiveSection] = useState("workspace");

  const NAV_ITEMS = [
    { value: "workspace", label: "Workspace", icon: User },
    { value: "integrations", label: "Integrations", icon: Plug },
    { value: "brand-safety", label: "Brand Safety", icon: ShieldCheck },
  ] as const;

  return (
    <div className="flex gap-6 min-h-0">
      {/* ── Vertical sidebar nav ───────────────────────────────── */}
      <nav className="hidden md:flex w-[200px] shrink-0 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setActiveSection(item.value)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                active
                  ? "bg-[var(--db-clay-soft)] text-[var(--db-clay)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
        <Link
          href="/settings/team"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
            "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Users className="size-4 shrink-0" />
          Team
        </Link>
      </nav>

      {/* ── Mobile dropdown (visible below md) ─────────────────── */}
      <div className="md:hidden w-full mb-4">
        <Select value={activeSection} onValueChange={(val) => { if (val) setActiveSection(val); }}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NAV_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Content area ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">

      {/* ============================================================= */}
      {/*  Workspace (Profile + Preferences + Account)                    */}
      {/* ============================================================= */}
      {activeSection === "workspace" && (
        <div className="flex flex-col gap-6">
        <DisplayNameCard />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Brand Profile
            </CardTitle>
            <CardDescription>
              Update your brand information visible across the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5 max-w-lg">
              {/* Logo */}
              <div className="flex flex-col gap-1.5">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex size-16 items-center justify-center rounded-lg border border-border bg-muted overflow-hidden">
                    {logoUrl ? (
                      <FallbackImg
                        src={logoUrl}
                        alt="Brand logo"
                        className="size-full object-cover"
                        fallback={<ImageIcon className="size-6 text-muted-foreground" />}
                      />
                    ) : (
                      <ImageIcon className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <label htmlFor="logo-upload">
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        render={<span />}
                      >
                        <Upload className="size-3.5" />
                        Upload
                      </Button>
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG, JPG up to 2MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Brand Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand-name">Brand Name</Label>
                <Input
                  id="brand-name"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Your brand name"
                />
              </div>

              {/* Website */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="website">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Industry */}
              <div className="flex flex-col gap-1.5">
                <Label>Industry</Label>
                <Select
                  value={industry}
                  onValueChange={(val) => setIndustry(val as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select industry" />
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

              {/* Feedback + Save */}
              {profileMessage && (
                <p
                  className={`text-sm ${
                    profileMessage.includes("success")
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {profileMessage}
                </p>
              )}
              <Button
                onClick={handleSaveProfile}
                disabled={profileSaving || !brandName}
                className="w-fit"
              >
                <Save className="size-3.5" />
                {profileSaving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Preferences (within Workspace)                                 */}
      {/* ============================================================= */}
      {activeSection === "workspace" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              Campaign Preferences
            </CardTitle>
            <CardDescription>
              Set your default campaign preferences. These are used as defaults
              when creating new campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5 max-w-lg">
              {/* Default Campaign Goal */}
              <div className="flex flex-col gap-1.5">
                <Label>Default Campaign Goal</Label>
                <Select
                  value={campaignGoal}
                  onValueChange={(val) => setCampaignGoal(val as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_GOALS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Budget Range */}
              <div className="flex flex-col gap-1.5">
                <Label>Budget per Creator (USD)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="Min"
                    className="w-full"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="Max"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Content Format Preference */}
              <div className="flex flex-col gap-1.5">
                <Label>Content Format Preference</Label>
                <Select
                  value={contentFormat}
                  onValueChange={(val) => setContentFormat(val as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Regions */}
              <div className="flex flex-col gap-1.5">
                <Label>Target Regions</Label>
                <div className="flex flex-wrap gap-2">
                  {(["north", "south", "east", "west"] as const).map((zone) => {
                    const selected = settingsTargetRegions.includes(zone);
                    return (
                      <button
                        key={zone}
                        type="button"
                        onClick={() =>
                          setSettingsTargetRegions((prev) =>
                            selected
                              ? prev.filter((r) => r !== zone)
                              : [...prev, zone]
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary/40 hover:bg-primary/[0.02]"
                        }`}
                      >
                        {ZONE_KEY_MAP[zone]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Regions where you want to grow. Used for creator-brand geo matching.
                </p>
              </div>

              {/* Past Collaborations */}
              <div className="flex flex-col gap-1.5">
                <Label>Past Collaborations</Label>
                <TagInput
                  tags={pastCollabs}
                  onChange={setPastCollabs}
                  placeholder="@handle, press Enter to add"
                />
                <p className="text-xs text-muted-foreground">
                  Add creator handles you have previously worked with.
                </p>
              </div>

              {/* Competitor Brands */}
              <div className="flex flex-col gap-1.5">
                <Label>Competitor Brands</Label>
                <TagInput
                  tags={competitors}
                  onChange={setCompetitors}
                  placeholder="Brand name, press Enter to add"
                />
                <p className="text-xs text-muted-foreground">
                  Helps the matching engine filter creators who work with
                  competitors.
                </p>
              </div>

              {/* Feedback + Save */}
              {prefsMessage && (
                <p
                  className={`text-sm ${
                    prefsMessage.includes("success")
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {prefsMessage}
                </p>
              )}
              <Button
                onClick={handleSavePreferences}
                disabled={prefsSaving}
                className="w-fit"
              >
                <Save className="size-3.5" />
                {prefsSaving ? "Saving..." : "Save Preferences"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================= */}
      {/*  Integrations                                                   */}
      {/* ============================================================= */}
      {activeSection === "integrations" && (
        <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="size-4 text-primary" />
              Shopify Integration
            </CardTitle>
            <CardDescription>
              Connect your Shopify store to enable geo-based insights and
              conversion tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brand?.shopify_connected ? (
              <div className="flex flex-col gap-4 max-w-lg">
                <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-success/10">
                    <ShoppingBag className="size-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Connected</p>
                    <p className="text-xs text-muted-foreground">
                      Your Shopify store is connected and syncing data.
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-success">
                    Active
                  </Badge>
                </div>

                {brand.shopify_store_url && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-muted-foreground">Store URL</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <LinkIcon className="size-3.5 text-muted-foreground" />
                      <span className="font-handle">
                        {brand.shopify_store_url}
                      </span>
                    </div>
                  </div>
                )}

                <Separator />

                <Button
                  variant="destructive"
                  className="w-fit"
                  onClick={handleDisconnectShopify}
                >
                  Disconnect Shopify
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-lg">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <ShoppingBag className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Not Connected</p>
                    <p className="text-xs text-muted-foreground">
                      Connect your Shopify store to unlock geo-based insights
                      and conversion tracking.
                    </p>
                  </div>
                </div>

                <Button
                  className="w-fit"
                  onClick={() => {
                    // In a real app, this would initiate Shopify OAuth
                    window.location.href = "/api/integrations/shopify/connect";
                  }}
                >
                  <ShoppingBag className="size-3.5" />
                  Connect Shopify
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gmail Integration */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="size-4 text-primary" />
              Email (Gmail)
            </CardTitle>
            <CardDescription>
              Connect your Gmail to send outreach emails from your own address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GmailIntegrationCard brand={brand} />
          </CardContent>
        </Card>

        {/* Instagram Integration */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="size-4 text-primary" />
              Instagram
            </CardTitle>
            <CardDescription>
              Connect a Business or personal Instagram account to sync DMs and
              reply from the outreach inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InstagramIntegrationCard />
          </CardContent>
        </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Brand Safety                                                   */}
      {/* ============================================================= */}
      {activeSection === "brand-safety" && (
        <div className="flex flex-col gap-6">
          {/* Website Analysis */}
          {brand?.website && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" />
                  Website Analysis
                </CardTitle>
                <CardDescription>
                  Extract brand identity from your website automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handleRescrapeWebsite}
                  disabled={scraping}
                >
                  {scraping ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3.5" />
                      Analyze Website
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Brand Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Brand Identity
              </CardTitle>
              <CardDescription>
                Define your brand identity to improve creator matching accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 max-w-2xl">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brand-description">Brand Description</Label>
                  <textarea
                    id="brand-description"
                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    value={brandDescription}
                    onChange={(e) => setBrandDescription(e.target.value)}
                    placeholder="A brief description of your brand and what you do..."
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Brand Values</Label>
                  <TagInput
                    tags={brandValues}
                    onChange={setBrandValues}
                    placeholder="e.g. sustainable, premium, family-friendly"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <textarea
                    id="target-audience"
                    className="flex min-h-[60px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. Health-conscious women aged 25-35 in urban India"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Brand Voice</Label>
                    <Select value={brandVoicePref} onValueChange={(val) => setBrandVoicePref(val as string)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="funny">Funny</SelectItem>
                        <SelectItem value="emotional">Emotional</SelectItem>
                        <SelectItem value="educational">Educational</SelectItem>
                        <SelectItem value="inspirational">Inspirational</SelectItem>
                        <SelectItem value="polished">Polished</SelectItem>
                        <SelectItem value="raw">Raw / Authentic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="min-audience-age">Min Audience Age</Label>
                    <Input
                      id="min-audience-age"
                      type="number"
                      min={0}
                      max={99}
                      value={minAudienceAge}
                      onChange={(e) => setMinAudienceAge(e.target.value)}
                      placeholder="e.g. 18"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="instagram-handle">Instagram Handle</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">@</span>
                    <Input
                      id="instagram-handle"
                      value={instagramHandle}
                      onChange={(e) => setInstagramHandle(e.target.value.replace(/^@/, ""))}
                      placeholder="yourbrand"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Content Guidelines
              </CardTitle>
              <CardDescription>
                Set rules for what creators should and shouldn&apos;t do. These guidelines affect brand safety scoring.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 max-w-2xl">
                <div className="flex flex-col gap-1.5">
                  <Label>Forbidden Topics</Label>
                  <TagInput
                    tags={forbiddenTopics}
                    onChange={setForbiddenTopics}
                    placeholder="e.g. politics, gambling, adult content"
                  />
                  <p className="text-xs text-muted-foreground">
                    Creators discussing these topics will receive a lower brand safety score.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Content Dos</Label>
                  <TagInput
                    tags={contentDos}
                    onChange={setContentDos}
                    placeholder="e.g. show product in use, mention key benefits"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Content Don&apos;ts</Label>
                  <TagInput
                    tags={contentDonts}
                    onChange={setContentDonts}
                    placeholder="e.g. no competitor comparisons, no health claims"
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Content Rating</Label>
                    <Select value={contentRating} onValueChange={(val) => setContentRating(val as string)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General (All ages)</SelectItem>
                        <SelectItem value="teen">Teen (13+)</SelectItem>
                        <SelectItem value="mature">Mature (18+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3 pt-5">
                    <Switch
                      checked={requirePartnershipLabel}
                      onCheckedChange={setRequirePartnershipLabel}
                    />
                    <Label>Require paid partnership label</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          {safetyMessage && (
            <p
              className={`text-sm ${
                safetyMessage.includes("saved") || safetyMessage.includes("analyzed")
                  ? "text-success"
                  : "text-destructive"
              }`}
            >
              {safetyMessage}
            </p>
          )}

          <Button
            onClick={handleSaveBrandSafety}
            disabled={safetySaving}
            className="w-fit"
          >
            {safetySaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Brand Safety Settings
              </>
            )}
          </Button>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Account (within Workspace)                                     */}
      {/* ============================================================= */}
      {activeSection === "workspace" && (
        <div className="flex flex-col gap-6">
          {/* Email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-4 text-primary" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5 max-w-lg">
                <Label className="text-muted-foreground">Email Address</Label>
                <Input value={userEmail} disabled />
                <p className="text-xs text-muted-foreground">
                  Contact support to change your email address.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 max-w-lg">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </div>

                {passwordMessage && (
                  <p
                    className={`text-sm ${
                      passwordMessage.includes("success")
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {passwordMessage}
                  </p>
                )}

                <Button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !newPassword || !confirmPassword}
                  className="w-fit"
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="size-4 text-primary" />
                Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="size-3.5" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="size-4" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
              >
                <DialogTrigger
                  render={
                    <Button variant="destructive">Delete Account</Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Account</DialogTitle>
                    <DialogDescription>
                      This will permanently delete your account, brand profile,
                      campaigns, and all associated data. This action is
                      irreversible.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 py-2">
                    <Label htmlFor="delete-confirm" className="text-sm">
                      Type <strong>DELETE</strong> to confirm
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDeleteConfirmOpen(false);
                        setDeleteText("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={deleteText !== "DELETE"}
                      onClick={handleDeleteAccount}
                    >
                      Delete My Account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gmail integration card                                             */
/* ------------------------------------------------------------------ */

function GmailIntegrationCard({ brand }: { brand: Brand | null }) {
  const [connected, setConnected] = useState<boolean>(
    Boolean(brand?.gmail_connected),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const res = await fetch("/api/integrations/gmail/status");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setConnected(Boolean(json?.connected));
      } catch {
        // ignore
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "gmail_connected") {
        setConnected(true);
        setBusy(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function handleConnect() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/gmail/connect", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to start Gmail connection");
      const { url } = await res.json();
      if (!url) throw new Error("Missing OAuth URL");
      window.open(url, "gmail-oauth", "width=520,height=640");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/gmail/disconnect", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to disconnect Gmail");
      setConnected(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={cn(
            "inline-flex h-2 w-2 rounded-full",
            connected ? "bg-success" : "bg-muted-foreground/50",
          )}
        />
        <span className="font-medium">
          {connected ? "Gmail connected" : "Not connected"}
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        {connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />}
            Connect Gmail
          </Button>
        )}
      </div>
    </div>
  );
}

