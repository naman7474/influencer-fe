"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Instagram,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/shared/toast";

export function SettingsClient({
  brand,
  templates,
  hasAdminToken,
}: {
  brand: {
    brand_name: string | null;
    website: string | null;
    industry: string | null;
    default_campaign_goal: string | null;
    shopify_store_url: string | null;
    shopify_connected: boolean;
    shopify_connected_at: string | null;
    shopify_last_sync_at: string | null;
    shopify_sync_status: string | null;
    shopify_sync_error: string | null;
    instagram_connected: boolean;
    instagram_connected_at: string | null;
  };
  templates: Array<{
    id: string;
    name: string;
    channel: "email" | "whatsapp" | "instagram_dm";
    subject: string | null;
    body: string;
  }>;
  hasAdminToken: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [brandName, setBrandName] = useState(brand.brand_name || "");
  const [website, setWebsite] = useState(brand.website || "");
  const [industry, setIndustry] = useState(brand.industry || "");

  const [shopifyExpanded, setShopifyExpanded] = useState(false);
  const [storeUrl, setStoreUrl] = useState(brand.shopify_store_url || "");
  const [adminToken, setAdminToken] = useState("");

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateChannel, setTemplateChannel] = useState<"email" | "whatsapp" | "instagram_dm">("email");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const saveBrandProfile = () => {
    startTransition(async () => {
      const res = await fetch("/api/v1/settings/brand-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: brandName, website, industry }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message || "Unable to save profile.");
        return;
      }
      toast.success("Brand profile updated.");
      router.refresh();
    });
  };

  const saveShopify = () => {
    startTransition(async () => {
      const res = await fetch("/api/v1/settings/shopify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopify_store_url: storeUrl,
          shopify_admin_access_token: adminToken || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message || "Unable to save Shopify settings.");
        return;
      }
      toast.success("Shopify settings saved. Sync starting...");
      setAdminToken("");
      setShopifyExpanded(false);
      router.refresh();
    });
  };

  const disconnectShopify = () => {
    startTransition(async () => {
      const res = await fetch("/api/v1/settings/shopify", { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message || "Unable to disconnect.");
        return;
      }
      toast.success("Shopify disconnected.");
      setStoreUrl("");
      setAdminToken("");
      router.refresh();
    });
  };

  const loadTemplate = (nextId: string | null) => {
    if (!nextId) {
      setTemplateId(null);
      setTemplateName("");
      setTemplateChannel("email");
      setTemplateSubject("");
      setTemplateBody("");
      return;
    }
    const t = templates.find((item) => item.id === nextId);
    if (!t) return;
    setTemplateId(t.id);
    setTemplateName(t.name);
    setTemplateChannel(t.channel);
    setTemplateSubject(t.subject ?? "");
    setTemplateBody(t.body);
  };

  const saveTemplate = () => {
    startTransition(async () => {
      const res = await fetch(
        templateId ? `/api/v1/outreach/templates/${templateId}` : "/api/v1/outreach/templates",
        {
          method: templateId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName,
            channel: templateChannel,
            subject: templateSubject || null,
            body: templateBody,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message || "Unable to save template.");
        return;
      }
      toast.success("Template saved.");
      loadTemplate(null);
      router.refresh();
    });
  };

  const deleteTemplate = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/v1/outreach/templates/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message || "Unable to delete template.");
        return;
      }
      toast.success("Template deleted.");
      if (templateId === id) loadTemplate(null);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brand profile, integrations, and outreach templates.
        </p>
      </div>

      {/* ── Brand Profile ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Brand Profile
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Brand name</span>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand name" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Website</span>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourbrand.com" />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Industry</span>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Beauty, Fashion, Tech" />
        </label>
        <div className="flex items-center gap-3">
          <Button onClick={saveBrandProfile} disabled={isPending}>
            Save profile
          </Button>
          <Badge variant="secondary">{brand.default_campaign_goal || "awareness"}</Badge>
        </div>
      </section>

      <Separator />

      {/* ── Integrations ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Integrations
        </h2>

        {/* Shopify row */}
        <div className="rounded-lg border bg-card">
          <button
            onClick={() => setShopifyExpanded(!shopifyExpanded)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3">
              <Store className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Shopify</p>
                <p className="text-xs text-muted-foreground">
                  {brand.shopify_connected
                    ? brand.shopify_store_url || "Connected"
                    : "Not connected"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={brand.shopify_connected ? "secondary" : "outline"}>
                {brand.shopify_sync_status || (brand.shopify_connected ? "connected" : "disconnected")}
              </Badge>
              {shopifyExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {shopifyExpanded && (
            <div className="border-t px-4 py-4 space-y-3">
              {brand.shopify_sync_error && (
                <p className="text-xs text-rose-600">{brand.shopify_sync_error}</p>
              )}
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Store URL</span>
                <Input
                  placeholder="mystore.myshopify.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Admin access token</span>
                <Input
                  placeholder={hasAdminToken ? "Token stored — enter new to replace" : "shpat_xxxxx"}
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  type="password"
                />
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveShopify} disabled={isPending}>
                  Save &amp; sync
                </Button>
                {brand.shopify_connected && (
                  <Button size="sm" variant="outline" onClick={disconnectShopify} disabled={isPending}>
                    Disconnect
                  </Button>
                )}
              </div>
              {brand.shopify_last_sync_at && (
                <p className="text-xs text-muted-foreground">
                  Last synced {new Date(brand.shopify_last_sync_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Instagram row */}
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Instagram className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Instagram</p>
              <p className="text-xs text-muted-foreground">
                {brand.instagram_connected
                  ? `Connected ${brand.instagram_connected_at ? new Date(brand.instagram_connected_at).toLocaleDateString() : ""}`
                  : "Connect to scan inbound DMs"}
              </p>
            </div>
          </div>
          <Link
            href="/api/v1/instagram/auth"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {brand.instagram_connected ? "Reconnect" : "Connect"}
          </Link>
        </div>
      </section>

      <Separator />

      {/* ── Outreach Templates ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Outreach Templates
        </h2>

        <div className="flex gap-3">
          <select
            className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            value={templateId ?? ""}
            onChange={(e) => loadTemplate(e.target.value || null)}
          >
            <option value="">+ New template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Name</span>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Initial outreach" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Channel</span>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={templateChannel}
              onChange={(e) => setTemplateChannel(e.target.value as "email" | "whatsapp" | "instagram_dm")}
            >
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram_dm">Instagram DM</option>
            </select>
          </label>
        </div>

        {templateChannel === "email" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Subject</span>
            <Input value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} placeholder="Email subject line" />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Body</span>
          <textarea
            className="min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring"
            value={templateBody}
            onChange={(e) => setTemplateBody(e.target.value)}
            placeholder="Use {{creator_name}}, {{brand_name}}, {{handle}} as merge tags"
          />
        </label>

        <div className="flex gap-2">
          <Button size="sm" onClick={saveTemplate} disabled={isPending || !templateName.trim() || !templateBody.trim()}>
            {templateId ? "Update" : "Create"} template
          </Button>
          {templateId && (
            <Button size="sm" variant="outline" onClick={() => deleteTemplate(templateId)} disabled={isPending}>
              Delete
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
