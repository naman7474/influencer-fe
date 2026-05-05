"use client";

import { useEffect, useState } from "react";
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
import { User } from "lucide-react";
import { toast } from "sonner";

export function DisplayNameCard() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState("");

  useEffect(() => {
    fetch("/api/me/profile")
      .then((r) => r.json())
      .then((d) => {
        const name = d.display_name ?? "";
        setDisplayName(name);
        setInitial(name);
        setEmail(d.email ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Failed to save");
      return;
    }
    toast.success("Saved");
    setInitial(displayName);
  }

  const dirty = displayName !== initial && displayName.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4 text-primary" />
          Your name
        </CardTitle>
        <CardDescription>
          Shown to teammates on outreach threads, assignments, and the dashboard greeting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 max-w-lg">
          <div className="grid gap-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={loading ? "Loading…" : "e.g. Naman Jain"}
              disabled={loading}
            />
            {email && (
              <p className="text-xs text-muted-foreground">
                Account email: {email}
              </p>
            )}
          </div>
          <div>
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
