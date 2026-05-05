"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Account = {
  id: string;
  account_type: "business" | "personal";
  ig_username: string | null;
  ig_business_account_id: string | null;
  last_dm_sync_at: string | null;
  token_expires_at: string | null;
  personal_token_kind: "graph_basic" | "session" | "apify_actor" | null;
};

type TokenKind = "graph_basic" | "session" | "apify_actor";

export function InstagramIntegrationCard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPersonal, setShowPersonal] = useState(false);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/integrations/instagram");
    const data = await res.json();
    setAccount(data.account ?? null);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function disconnect() {
    if (!confirm("Disconnect Instagram from this brand?")) return;
    const res = await fetch("/api/integrations/instagram", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to disconnect");
      return;
    }
    toast.success("Instagram disconnected");
    refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (account) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {account.account_type === "business" ? "Business" : "Personal"}
          </Badge>
          <span className="text-sm font-medium">
            @{account.ig_username ?? "unknown"}
          </span>
          {account.last_dm_sync_at && (
            <span className="text-xs text-muted-foreground">
              · Synced {new Date(account.last_dm_sync_at).toLocaleString()}
            </span>
          )}
        </div>
        {account.account_type === "personal" && (
          <p className="text-xs text-muted-foreground">
            Token kind: <code>{account.personal_token_kind ?? "—"}</code>.{" "}
            {account.personal_token_kind === "graph_basic"
              ? "Read-only — sending DMs requires a Business account."
              : "Sending depends on the worker for this token kind."}
          </p>
        )}
        <div>
          <Button variant="outline" size="sm" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          onClick={() => {
            window.location.href = "/api/integrations/instagram/oauth/connect";
          }}
        >
          Connect Business account
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Use Meta&apos;s Facebook Login if your IG account is on a Business or Creator plan.
        </p>
      </div>

      <div>
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => setShowPersonal((v) => !v)}
        >
          {showPersonal ? "Hide" : "Connect personal account using API access token"}
        </button>
        {showPersonal && <PersonalConnectForm onConnected={refresh} />}
      </div>
    </div>
  );
}

function PersonalConnectForm({ onConnected }: { onConnected: () => void }) {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [kind, setKind] = useState<TokenKind>("graph_basic");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const res = await fetch("/api/integrations/instagram/personal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, access_token: token, token_kind: kind }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Failed to connect");
      return;
    }
    setUsername("");
    setToken("");
    toast.success("Instagram connected");
    onConnected();
  }

  return (
    <div className="mt-3 grid gap-3 rounded-md border bg-muted/30 p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ig-username">Instagram username</Label>
        <Input
          id="ig-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@yourhandle"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ig-token">Access token</Label>
        <Input
          id="ig-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste token"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ig-kind">Token kind</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as TokenKind)}>
          <SelectTrigger id="ig-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="graph_basic">Instagram Graph user token</SelectItem>
            <SelectItem value="session">Session token (worker)</SelectItem>
            <SelectItem value="apify_actor">Apify actor input</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Graph user tokens are read-only. Sending DMs from a personal account
          relies on a separate worker (session / Apify) that you configure
          server-side.
        </p>
      </div>
      <div>
        <Button
          size="sm"
          onClick={submit}
          disabled={!username || !token || submitting}
        >
          {submitting ? "Connecting…" : "Connect"}
        </Button>
      </div>
    </div>
  );
}
