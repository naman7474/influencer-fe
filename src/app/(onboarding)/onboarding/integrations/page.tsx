"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ObConnectorCard } from "@/components/onboarding/ob-connector-card";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

export default function IntegrationsPage() {
  const router = useRouter();
  const supabase = createClient();

  // Shopify state
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showShopifyForm, setShowShopifyForm] = useState(false);
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
    if (!showShopifyForm) {
      setShowShopifyForm(true);
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
      setShowShopifyForm(false);
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
        const popup = window.open(data.redirect_url, "_blank", "noopener");
        if (!popup) {
          window.location.href = data.redirect_url;
        }
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

  const setupSteps = [
    'Go to your Shopify Partners Dashboard or Admin \u2192 Settings \u2192 Apps \u2192 "Develop apps"',
    'Click "Create an app" and name it (e.g. "Influencer Platform")',
    "Under Configuration \u2192 Admin API scopes, select: read_orders, read_products, write_price_rules, write_discounts, write_draft_orders, read_analytics",
    "Install the app on your store",
    "Copy the Client ID and Client Secret from the API credentials page",
    "Paste them below along with your store URL",
  ];

  return (
    <div style={{ animation: "obRise 0.35s ease-out" }}>
      {/* Header */}
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[1.4px] text-[var(--ob-clay)]">
        &#x25CF; step 2 of 3 &middot; connect
      </div>
      <h1 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
        Last thing:{" "}
        <span className="italic text-[var(--ob-clay)]">
          plug in your tools.
        </span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--ob-ink2)]">
        Each connector unlocks something specific. You can always add these later
        &mdash; but you&rsquo;ll get better matches from day one.
      </p>

      {/* Connector cards */}
      <div className="mt-7 flex flex-col gap-3">
        {/* Shopify */}
        <div>
          <ObConnectorCard
            color="#96bf48"
            letter="S"
            name="Shopify"
            unlocks={[
              "Real sales per region",
              "Top-performing products",
              "Auto-issue discount codes",
            ]}
            connected={shopifyConnected}
            onConnect={handleConnectShopify}
            connecting={connecting}
            recommended
          />

          {/* Shopify credential form — slides in below the card */}
          {showShopifyForm && !shopifyConnected && (
            <div
              className="mx-4 rounded-b-xl border border-t-0 border-[var(--ob-line)] bg-[var(--ob-panel)] p-4"
              style={{ animation: "obFadeUp 0.25s ease-out" }}
            >
              {/* Setup guide toggle */}
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="mb-3 flex w-full items-center justify-between rounded-lg border border-dashed border-[var(--ob-clay)]/30 bg-[var(--ob-clay-soft)] px-3 py-2 text-xs font-medium text-[var(--ob-clay)] transition-colors hover:bg-[var(--ob-clay-soft)]/80"
              >
                <span>How to get your Shopify credentials</span>
                {showSetupGuide ? (
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                )}
              </button>

              {showSetupGuide && (
                <ol className="mb-3 space-y-1.5 rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] p-3 text-xs text-[var(--ob-ink2)]">
                  {setupSteps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-mono font-semibold text-[var(--ob-ink)]">
                        {i + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex flex-col gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ob-ink2)]">
                    Store URL
                  </label>
                  <input
                    type="text"
                    placeholder="your-store.myshopify.com"
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    className="w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] px-3 py-2 text-sm text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)] focus:border-[var(--ob-clay)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ob-ink2)]">
                    Client ID
                  </label>
                  <input
                    type="text"
                    placeholder="Your app's Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] px-3 py-2 text-sm text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)] focus:border-[var(--ob-clay)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ob-ink2)]">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    placeholder="Your app's Client Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConnectShopify();
                    }}
                    className="w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-card)] px-3 py-2 text-sm text-[var(--ob-ink)] outline-none placeholder:text-[var(--ob-ink4)] focus:border-[var(--ob-clay)]"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}

                <button
                  onClick={handleConnectShopify}
                  disabled={connecting}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#96bf48] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          stroke="currentColor"
                          strokeOpacity="0.3"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M8 2a6 6 0 016 6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    "Connect Shopify"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Gmail */}
        <div>
          <ObConnectorCard
            color="#ea4335"
            letter="G"
            name="Gmail"
            unlocks={[
              "Send outreach from your domain",
              "Track opens + replies",
              "Unified inbox per creator",
            ]}
            connected={gmailConnected}
            onConnect={handleConnectGmail}
            connecting={connectingGmail}
            recommended
          />
          {gmailError && (
            <p className="mx-4 mt-1 text-xs text-red-600">{gmailError}</p>
          )}
        </div>

        {/* Instagram — coming soon */}
        <ObConnectorCard
          color="#c74ca0"
          letter="I"
          name="Instagram"
          unlocks={[
            "Auto-DM approved creators",
            "Track story mentions",
            "Reel performance attribution",
          ]}
          connected={false}
          onConnect={() => {}}
          comingSoon
        />

        {/* Google Analytics — coming soon */}
        <ObConnectorCard
          color="#4285f4"
          letter="A"
          name="Google Analytics"
          unlocks={[
            "UTM attribution per creator",
            "On-site conversion events",
          ]}
          connected={false}
          onConnect={() => {}}
          comingSoon
        />
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-[var(--ob-line)] pt-5 pb-8">
        <button
          onClick={advanceToPreferences}
          className="text-[13px] text-[var(--ob-ink3)] underline underline-offset-[3px] transition-colors hover:text-[var(--ob-ink)]"
        >
          Skip for now
        </button>
        <button
          onClick={advanceToPreferences}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ob-ink)] px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
        >
          Continue
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
