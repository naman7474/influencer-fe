"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Mail,
  Camera,
  Check,
  Shield,
  ArrowRight,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function IntegrationsPage() {
  const router = useRouter();
  const supabase = createClient();

  // Shopify state
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showStoreInput, setShowStoreInput] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Load connection status from DB on mount
  useEffect(() => {
    async function loadStatus() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("brands")
        .select("shopify_connected, gmail_connected")
        .eq("auth_user_id", user.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const brand = data as any;
      if (brand?.shopify_connected) setShopifyConnected(true);
      if (brand?.gmail_connected) setGmailConnected(true);
    }
    loadStatus();
  }, [supabase]);

  // Listen for Gmail OAuth popup result
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "gmail_connected") {
        setGmailConnected(true);
        setConnectingGmail(false);
      }
      if (event.data?.type === "gmail_error") {
        setGmailError(event.data.error || "Gmail connection failed.");
        setConnectingGmail(false);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function handleConnectShopify() {
    if (!showStoreInput) {
      setShowStoreInput(true);
      return;
    }

    if (!storeUrl.trim()) {
      setError("Please enter your Shopify store URL.");
      return;
    }

    if (!clientId.trim()) {
      setError("Please enter your Client ID.");
      return;
    }

    if (!clientSecret.trim()) {
      setError("Please enter your Client Secret.");
      return;
    }

    setError(null);
    setConnecting(true);

    try {
      const res = await fetch("/api/integrations/shopify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_url: storeUrl.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to connect. Please try again.");
        setConnecting(false);
        return;
      }

      setShopifyConnected(true);
      setConnecting(false);
    } catch {
      setError("Network error. Please try again.");
      setConnecting(false);
    }
  }

  async function handleConnectGmail() {
    setGmailError(null);
    setConnectingGmail(true);

    try {
      const res = await fetch("/api/integrations/gmail/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setGmailError(data.error || "Failed to connect. Please try again.");
        setConnectingGmail(false);
        return;
      }

      if (data.redirect_url) {
        // Open Google OAuth in a new tab
        const popup = window.open(data.redirect_url, "_blank", "noopener");
        if (!popup) {
          // Popup blocked — fall back to same-tab redirect
          window.location.href = data.redirect_url;
        }
        // connectingGmail stays true until postMessage arrives
        return;
      }

      setGmailConnected(true);
      setConnectingGmail(false);
    } catch {
      setGmailError("Network error. Please try again.");
      setConnectingGmail(false);
    }
  }

  async function advanceToPreferences() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("brands")
        .update({ onboarding_step: 3 } as never)
        .eq("auth_user_id", user.id);
    }
    router.push("/onboarding/preferences");
  }

  const accessItems = [
    { label: "Orders by region", note: "read-only" },
    { label: "Product catalog", note: "read-only" },
    { label: "Discount code creation", note: "write" },
    { label: "Analytics sessions", note: "read-only" },
  ];

  const setupSteps = [
    "Go to your Shopify Partners Dashboard or Shopify Admin → Settings → Apps and sales channels → Develop apps",
    'Click "Create an app" and give it a name (e.g. "Influencer Platform")',
    "Under Configuration → Admin API scopes, select: read_orders, read_products, write_price_rules, write_discounts, write_draft_orders, read_analytics",
    "Install the app on your store",
    "Go to the app's API credentials page — copy the Client ID and Client Secret",
    "Paste them below along with your store URL (e.g. your-store.myshopify.com)",
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">
          Connect your tools
        </h1>
        <p className="text-muted-foreground">
          Integrations supercharge your influencer campaigns with real data.
          Connect what you use today — you can always add more later.
        </p>
      </div>

      {/* Card grid */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Card A — Shopify (highlighted, recommended) */}
        <div
          className={cn(
            "relative flex flex-col rounded-xl border-2 bg-card p-5 transition-all md:col-span-3",
            shopifyConnected
              ? "border-success/50 bg-success/5"
              : "border-primary/30 bg-primary/[0.02]"
          )}
        >
          {/* Badge */}
          {shopifyConnected ? (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              <Check className="size-3" />
              CONNECTED
            </span>
          ) : (
            <Badge className="absolute right-4 top-4 bg-success/10 text-success border-0 hover:bg-success/10">
              RECOMMENDED
            </Badge>
          )}

          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            {/* Icon + Title */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-[#96bf48]/10">
                  <ShoppingBag className="size-5 text-[#96bf48]" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-base">
                    Connect Shopify
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    E-commerce integration via OAuth
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Unlock geographic intelligence, auto-create discount codes,
                track influencer-driven sales in real-time.
              </p>

              {/* What we access */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  What we access
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {accessItems.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="size-3.5 text-success shrink-0" />
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({item.note})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Connect action */}
            <div className="flex flex-col gap-3 md:w-80 md:pt-1">
              {!shopifyConnected && (
                <>
                  {showStoreInput && (
                    <div className="space-y-3">
                      {/* Setup guide toggle */}
                      <button
                        type="button"
                        onClick={() => setShowSetupGuide(!showSetupGuide)}
                        className="flex w-full items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span>How to get your Shopify credentials</span>
                        {showSetupGuide ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </button>

                      {showSetupGuide && (
                        <ol className="space-y-1.5 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
                          {setupSteps.map((step, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="shrink-0 font-semibold text-foreground">
                                {i + 1}.
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Store URL
                        </label>
                        <input
                          type="text"
                          placeholder="your-store.myshopify.com"
                          value={storeUrl}
                          onChange={(e) => setStoreUrl(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Client ID
                        </label>
                        <input
                          type="text"
                          placeholder="Your app's Client ID (API key)"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          placeholder="Your app's Client Secret (API secret key)"
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleConnectShopify();
                          }}
                          className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
                        />
                      </div>
                    </div>
                  )}
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <Button
                    onClick={handleConnectShopify}
                    disabled={connecting}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {connecting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                    {connecting ? "Connecting..." : "Connect Shopify"}
                  </Button>
                </>
              )}

              {shopifyConnected && (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                  <Check className="size-4" />
                  <span className="font-medium">Shopify connected</span>
                </div>
              )}

              {/* Trust note */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  Your data is encrypted. We never modify your products or
                  orders.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card B — Email */}
        <div
          className={cn(
            "flex flex-col rounded-xl border bg-card p-5",
            gmailConnected ? "border-success/50 bg-success/5" : ""
          )}
        >
          {gmailConnected && (
            <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              <Check className="size-3" />
              CONNECTED
            </span>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/5">
              <Mail className="size-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm">
                Connect Gmail
              </h3>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted-foreground leading-relaxed flex-1">
            Send outreach from your own domain. We never read your inbox —
            only send on your behalf.
          </p>
          {gmailError && (
            <p className="mb-2 text-xs text-destructive">{gmailError}</p>
          )}
          {gmailConnected ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              <Check className="size-4" />
              <span className="font-medium">Gmail connected</span>
            </div>
          ) : (
            <Button
              onClick={handleConnectGmail}
              disabled={connectingGmail}
              variant="secondary"
              className="w-full gap-2"
              size="lg"
            >
              {connectingGmail ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              {connectingGmail ? "Connecting..." : "Connect Gmail"}
            </Button>
          )}
        </div>

        {/* Card C — Instagram (disabled) */}
        <div className="flex flex-col rounded-xl border bg-card p-5 opacity-70">
          <span className="mb-3 inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            COMING SOON
          </span>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-pink-500/5">
              <Camera className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm">
                Connect Instagram
              </h3>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted-foreground leading-relaxed flex-1">
            Track brand mentions automatically.
          </p>
          <Button disabled variant="secondary" className="w-full" size="lg">
            Coming in Phase 6
          </Button>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between border-t pt-6">
        <button
          onClick={advanceToPreferences}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Skip for now
        </button>
        <Button
          onClick={advanceToPreferences}
          size="lg"
          className="gap-2"
        >
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
