"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Save,
  RefreshCw,
  FileText,
  Building2,
  SlidersHorizontal,
  Brain,
  Cpu,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { AutonomySettings } from "@/components/agent/autonomy-settings";

/* ── Main Page ──────────────────────────────────────────── */

export default function AgentConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // Config state
  const [soulMd, setSoulMd] = useState("");
  const [brandMd, setBrandMd] = useState("");
  const [autonomyLevel, setAutonomyLevel] = useState("suggest_only");
  const [actionAutonomy, setActionAutonomy] = useState<Record<string, string>>({});
  const [budgetThreshold, setBudgetThreshold] = useState(25000);

  // Load config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/agent/config");
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setSoulMd(data.config.soul_md || "");
            setBrandMd(data.config.brand_md || "");
            setAutonomyLevel(data.config.autonomy_level || "suggest_only");
            if (data.config.action_autonomy) {
              setActionAutonomy(data.config.action_autonomy);
            }
            if (data.config.budget_auto_threshold != null) {
              setBudgetThreshold(data.config.budget_auto_threshold);
            }
          }
        }
      } catch {
        // Config may not exist yet
      }
      setLoading(false);
    }
    loadConfig();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soul_md: soulMd,
          autonomy_level: autonomyLevel,
          action_autonomy:
            Object.keys(actionAutonomy).length > 0 ? actionAutonomy : undefined,
          budget_auto_threshold: budgetThreshold,
        }),
      });
      if (res.ok) {
        setMessage("Configuration saved successfully.");
        router.refresh();
      } else {
        setMessage("Failed to save. Please try again.");
      }
    } catch {
      setMessage("Failed to save. Please try again.");
    }
    setSaving(false);
  }

  async function handleRegenerate(type: "brand" | "soul") {
    setRegenerating(type);
    try {
      const res = await fetch("/api/agent/generate-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        if (type === "brand") setBrandMd(data.brand_md || "");
        if (type === "soul") setSoulMd(data.soul_md || "");
      }
    } catch {
      // Error handled
    }
    setRegenerating(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Agent Configuration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize your agent&apos;s personality, autonomy levels, and behavior rules.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-3.5" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Feedback */}
      {message && (
        <p
          className={`text-sm ${
            message.includes("success") ? "text-success" : "text-destructive"
          }`}
        >
          {message}
        </p>
      )}

      <Tabs defaultValue="personality">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="personality" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Personality
          </TabsTrigger>
          <TabsTrigger value="autonomy" className="gap-1.5">
            <SlidersHorizontal className="size-3.5" />
            Autonomy
          </TabsTrigger>
          <TabsTrigger value="context" className="gap-1.5">
            <Building2 className="size-3.5" />
            Brand Context
          </TabsTrigger>
        </TabsList>

        {/* ── Personality Tab ──────────────────────────── */}
        <TabsContent value="personality" className="mt-4">
          <div className="flex flex-col gap-6">
            {/* SOUL.md editor */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="size-4 text-primary" />
                      SOUL.md — Agent Personality
                    </CardTitle>
                    <CardDescription>
                      This controls your agent&apos;s voice, tone, behavior rules, and
                      communication style. The agent evolves this over time with learned
                      rules.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRegenerate("soul")}
                    disabled={regenerating === "soul"}
                  >
                    <RefreshCw
                      className={`size-3.5 ${regenerating === "soul" ? "animate-spin" : ""}`}
                    />
                    Reset to Default
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={soulMd}
                  onChange={(e) => setSoulMd(e.target.value)}
                  rows={18}
                  className="font-mono text-xs leading-relaxed"
                  placeholder="Loading..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This file is automatically enriched by the soul-evolver with learned
                  behavior rules from your interactions.
                </p>
              </CardContent>
            </Card>

            {/* How soul evolution works */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="size-4 text-violet-500" />
                  Soul Evolution
                </CardTitle>
                <CardDescription>
                  Your agent learns from interactions and evolves its personality rules over time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex flex-col gap-1.5 rounded-lg border p-3">
                    <p className="font-medium text-xs">Base Rules</p>
                    <p className="text-[11px] text-muted-foreground">
                      Your hand-written personality rules above. Always preserved.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-lg border p-3">
                    <p className="font-medium text-xs">Learned Rules</p>
                    <p className="text-[11px] text-muted-foreground">
                      High-confidence knowledge (65%+, 3+ evidence) becomes behavior rules.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-lg border p-3">
                    <p className="font-medium text-xs">Evolution Cycle</p>
                    <p className="text-[11px] text-muted-foreground">
                      Runs on maintenance cron. Appends learned rules without changing your base.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Autonomy Tab ─────────────────────────────── */}
        <TabsContent value="autonomy" className="mt-4">
          <div className="flex flex-col gap-6">
            {/* Global autonomy level */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Global Autonomy Level</CardTitle>
                <CardDescription>
                  Set the overall autonomy mode. Per-action overrides below take precedence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 max-w-lg">
                  <Select
                    value={autonomyLevel}
                    onValueChange={(val) => setAutonomyLevel(val as string)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggest_only">
                        Suggest Only — Agent can only suggest, never act
                      </SelectItem>
                      <SelectItem value="draft_and_propose">
                        Draft &amp; Propose — Agent drafts, you approve
                      </SelectItem>
                      <SelectItem value="auto_with_guardrails">
                        Auto with Guardrails — Agent acts within limits
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Per-action autonomy */}
            <AutonomySettings
              actionAutonomy={
                actionAutonomy as Record<
                  string,
                  "AUTO" | "AUTO-DRAFT" | "APPROVAL-REQUIRED" | "ALWAYS-MANUAL"
                >
              }
              budgetThreshold={budgetThreshold}
              onChange={(newAutonomy, newThreshold) => {
                setActionAutonomy(newAutonomy);
                setBudgetThreshold(newThreshold);
              }}
            />
          </div>
        </TabsContent>

        {/* ── Brand Context Tab ────────────────────────── */}
        <TabsContent value="context" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="size-4 text-primary" />
                    BRAND.md — Brand Context
                  </CardTitle>
                  <CardDescription>
                    Auto-generated from your brand profile. The agent uses this to
                    understand your brand, products, and target market.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerate("brand")}
                  disabled={regenerating === "brand"}
                >
                  <RefreshCw
                    className={`size-3.5 ${regenerating === "brand" ? "animate-spin" : ""}`}
                  />
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={brandMd}
                readOnly
                rows={14}
                className="font-mono text-xs leading-relaxed bg-muted"
                placeholder="Update your brand profile in Settings, then regenerate."
              />
              <p className="text-xs text-muted-foreground mt-2">
                This file is read-only and auto-generated from your brand profile.
                Update your profile in Settings to change the content, then click Regenerate.
              </p>
            </CardContent>
          </Card>

          {/* Model info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="size-4 text-muted-foreground" />
                Model Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Claude Sonnet 4</Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Provider</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Anthropic</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
