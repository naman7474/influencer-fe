"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CreditCard, Settings2, ShieldCheck, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SettingsClient({
  brand,
  products,
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
  };
  products: Array<{
    id: string;
    title: string;
    product_type: string | null;
    min_price: number | null;
    max_price: number | null;
  }>;
  hasAdminToken: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [brandName, setBrandName] = useState(brand.brand_name || "");
  const [website, setWebsite] = useState(brand.website || "");
  const [industry, setIndustry] = useState(brand.industry || "");
  const [storeUrl, setStoreUrl] = useState(brand.shopify_store_url || "");
  const [adminToken, setAdminToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveBrandProfile = () => {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/v1/settings/brand-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName,
          website,
          industry,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message || "Unable to save brand profile.");
        return;
      }
      setNotice("Brand profile updated.");
      router.refresh();
    });
  };

  const saveShopify = () => {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/v1/settings/shopify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopify_store_url: storeUrl,
          shopify_admin_access_token: adminToken || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message || "Unable to save Shopify settings.");
        return;
      }
      setNotice("Shopify settings updated.");
      setAdminToken("");
      router.refresh();
    });
  };

  const disconnectShopify = () => {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/v1/settings/shopify", {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message || "Unable to disconnect Shopify.");
        return;
      }
      setNotice("Shopify disconnected.");
      setStoreUrl("");
      setAdminToken("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-muted-foreground">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your brand profile, Shopify connection, and product catalogue.
          </p>
        </div>
      </section>

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Brand profile
            </CardTitle>
            <CardDescription>
              Primary brand identity and defaults.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Brand name</label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Website</label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourbrand.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Industry</label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Beauty, Fashion, Tech" />
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-3">
              <p className="text-xs text-muted-foreground">
                Default campaign goal
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{brand.default_campaign_goal || "awareness"}</Badge>
              </div>
            </div>
            <Button className="w-full" onClick={saveBrandProfile} disabled={isPending}>
              Save brand profile
            </Button>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Shopify connection
            </CardTitle>
            <CardDescription>
              Connect your Shopify store to enable geo intelligence and product matching.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {brand.shopify_sync_status === "running" ||
                    brand.shopify_sync_status === "queued"
                      ? "Sync in progress"
                      : brand.shopify_connected
                        ? "Store connected"
                        : "Store sync pending"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {brand.shopify_sync_status === "failed" && brand.shopify_sync_error
                      ? brand.shopify_sync_error
                      : brand.shopify_last_sync_at
                      ? `Last sync at ${new Date(brand.shopify_last_sync_at).toLocaleString()}`
                      : "No Shopify sync has run yet."}
                  </p>
                </div>
                <Badge variant="secondary">
                  {brand.shopify_sync_status || (brand.shopify_connected ? "connected" : "idle")}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Store URL</label>
              <Input
                placeholder="mystore.myshopify.com"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Admin access token</label>
              <Input
                placeholder={hasAdminToken ? "Token already stored" : "shpat_xxxxx"}
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                type="password"
              />
            </div>
            <Button className="w-full" onClick={saveShopify} disabled={isPending}>
              {isPending ? "Saving and starting sync..." : "Save and start sync"}
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="w-full border-border"
                onClick={disconnectShopify}
                disabled={isPending}
              >
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Synced products
            </CardTitle>
            <CardDescription>
              Products synced from your Shopify store.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {products.length > 0 ? (
              products.map((product) => (
                <div
                  key={product.id}
                  className="rounded-lg bg-muted/50 px-3 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{product.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.product_type || "Uncategorized"} · ₹{Math.round(Number(product.min_price ?? 0))}
                    {product.max_price && product.max_price !== product.min_price
                      ? ` - ₹${Math.round(Number(product.max_price))}`
                      : ""}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No products synced yet. Connect Shopify to import your catalogue.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Security
              </CardTitle>
              <CardDescription>
                Credential and connection status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-3">
                <p className="text-sm font-medium text-foreground">Sync state</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {brand.shopify_sync_status ?? "idle"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-3">
                <p className="text-sm font-medium text-foreground">Admin access token</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasAdminToken ? "Stored" : "Not stored"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
