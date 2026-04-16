"use client";

import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Brand } from "@/lib/types/database";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

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

  return (
    <Tabs defaultValue="profile">
      <TabsList variant="line" className="mb-6 w-full justify-start">
        <TabsTrigger value="profile" className="gap-1.5">
          <User className="size-3.5" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="preferences" className="gap-1.5">
          <Settings2 className="size-3.5" />
          Preferences
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-1.5">
          <Plug className="size-3.5" />
          Integrations
        </TabsTrigger>
        <TabsTrigger value="agent" className="gap-1.5">
          <Sparkles className="size-3.5" />
          AI Agent
        </TabsTrigger>
        <TabsTrigger value="brand-safety" className="gap-1.5">
          <ShieldCheck className="size-3.5" />
          Brand Safety
        </TabsTrigger>
        <TabsTrigger value="account" className="gap-1.5">
          <KeyRound className="size-3.5" />
          Account
        </TabsTrigger>
      </TabsList>

      {/* ============================================================= */}
      {/*  Profile Tab                                                    */}
      {/* ============================================================= */}
      <TabsContent value="profile">
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
                      <img
                        src={logoUrl}
                        alt="Brand logo"
                        className="size-full object-cover"
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
      </TabsContent>

      {/* ============================================================= */}
      {/*  Preferences Tab                                                */}
      {/* ============================================================= */}
      <TabsContent value="preferences">
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
      </TabsContent>

      {/* ============================================================= */}
      {/*  Integrations Tab                                               */}
      {/* ============================================================= */}
      <TabsContent value="integrations">
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
      </TabsContent>

      {/* ============================================================= */}
      {/*  AI Agent Tab — Redirect to dedicated config page               */}
      {/* ============================================================= */}
      <TabsContent value="agent">
        <AgentSettingsRedirect brand={brand} />
      </TabsContent>

      {/* ============================================================= */}
      {/*  Brand Safety Tab                                               */}
      {/* ============================================================= */}
      <TabsContent value="brand-safety">
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
      </TabsContent>

      {/* ============================================================= */}
      {/*  Account Tab                                                    */}
      {/* ============================================================= */}
      <TabsContent value="account">
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
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Agent Settings — Redirect to dedicated config page              */
/* ------------------------------------------------------------------ */

function AgentSettingsRedirect({ brand }: { brand: Brand | null }) {
  const router = useRouter();
  const [agentEnabled, setAgentEnabled] = useState(brand?.agent_enabled ?? false);

  async function handleToggleAgent() {
    const next = !agentEnabled;
    setAgentEnabled(next);

    if (next) {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autonomy_level: "suggest_only" }),
      });
      if (res.ok) {
        router.refresh();
      }
    } else {
      const supabase = createClient();
      await supabase
        .from("brands")
        .update({ agent_enabled: false } as never)
        .eq("id", brand!.id);
      router.refresh();
    }
  }

  if (!brand) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Complete your brand profile first to enable the AI Agent.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Enable / Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI Marketing Agent
          </CardTitle>
          <CardDescription>
            Enable a conversational AI agent that can search creators, draft
            outreach, benchmark rates, and give campaign recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between max-w-lg">
            <div>
              <p className="text-sm font-medium">
                {agentEnabled ? "Agent is active" : "Agent is disabled"}
              </p>
              <p className="text-xs text-muted-foreground">
                {agentEnabled
                  ? "The agent workspace is available in your sidebar."
                  : "Enable to start chatting with your AI agent."}
              </p>
            </div>
            <Switch
              checked={agentEnabled}
              onCheckedChange={handleToggleAgent}
            />
          </div>
        </CardContent>
      </Card>

      {agentEnabled && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Agent Configuration</p>
                <p className="text-xs text-muted-foreground">
                  Manage personality, skills, automations, and autonomy settings in the dedicated agent workspace.
                </p>
              </div>
              <Button onClick={() => router.push("/agent/config")}>
                <SlidersHorizontal className="size-3.5" />
                Open Agent Config
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gmail Integration Card                                             */
/* ------------------------------------------------------------------ */

function GmailIntegrationCard({ brand }: { brand: Brand | null }) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [senderName, setSenderName] = useState(
    (brand as Record<string, unknown>)?.email_sender_name as string || ""
  );
  const [savingSenderName, setSavingSenderName] = useState(false);
  const supabase = createClient();

  const gmailConnected = (brand as Record<string, unknown>)?.gmail_connected as boolean;
  const gmailEmail = (brand as Record<string, unknown>)?.gmail_email as string | null;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/gmail/connect", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }
      }
    } catch {
      // Error handled
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const res = await fetch("/api/integrations/gmail/disconnect", {
      method: "POST",
    });
    if (res.ok) {
      window.location.reload();
    }
    setDisconnecting(false);
  };

  const handleSaveSenderName = async () => {
    if (!brand) return;
    setSavingSenderName(true);
    await supabase
      .from("brands")
      .update({ email_sender_name: senderName } as never)
      .eq("id", brand.id);
    setSavingSenderName(false);
  };

  if (gmailConnected) {
    return (
      <div className="flex flex-col gap-4 max-w-lg">
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-success/10">
            <Plug className="size-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Connected</p>
            <p className="text-xs text-muted-foreground">
              {gmailEmail || "Gmail connected"}
            </p>
          </div>
          <Badge variant="secondary" className="text-success">
            Active
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Sender Name</Label>
          <div className="flex gap-2">
            <Input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your name (appears in From field)"
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveSenderName}
              disabled={savingSenderName}
            >
              <Save className="size-3.5" />
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This name appears in the &quot;From&quot; field of your outreach emails.
          </p>
        </div>

        <Separator />

        <Button
          variant="destructive"
          className="w-fit"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          Disconnect Gmail
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Plug className="size-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Not Connected</p>
          <p className="text-xs text-muted-foreground">
            Connect your Gmail to send outreach emails from your own address.
          </p>
        </div>
      </div>

      <Button className="w-fit" onClick={handleConnect} disabled={connecting}>
        <Plug className="size-3.5" />
        Connect Gmail
      </Button>
    </div>
  );
}
