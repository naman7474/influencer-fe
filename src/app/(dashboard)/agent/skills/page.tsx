"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Mail,
  Handshake,
  Target,
  BarChart3,
  Heart,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Wrench,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Globe,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SkillCategory, SkillPermission } from "@/lib/agent/skills/types";
import { CATEGORY_META } from "@/lib/agent/skills/catalog";
import { SkillBuilder } from "@/components/agent/skill-builder";

/* ── Types ──────────────────────────────────────────────── */

interface SkillItem {
  name: string;
  label: string;
  description: string;
  category: SkillCategory;
  permission: SkillPermission;
  riskLevel: "low" | "medium" | "high";
  enabled: boolean;
  permissionEnabled: boolean;
  skillDisabled: boolean;
}

interface CustomSkillItem {
  id: string;
  name: string;
  label: string;
  description: string;
  category: string;
  input_schema: Record<string, unknown>;
  execution_type: "prompt" | "api" | "query";
  execution_config: Record<string, unknown>;
  risk_level: string;
  is_active: boolean;
  created_at: string;
}

const EXEC_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  prompt: { label: "Prompt", icon: Sparkles, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  api: { label: "API", icon: Globe, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  query: { label: "Query", icon: Database, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

/* ── Category icon mapping ─────────────────────────────── */

const CATEGORY_ICONS: Record<SkillCategory, React.ComponentType<{ className?: string }>> = {
  discovery: Search,
  outreach: Mail,
  negotiation: Handshake,
  campaign: Target,
  tracking: BarChart3,
  relationship: Heart,
};

const CATEGORY_COLORS: Record<string, string> = {
  blue: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
  violet: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
  rose: "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900",
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
  cyan: "text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900",
};

const RISK_BADGES: Record<string, { label: string; className: string }> = {
  low: { label: "Low Risk", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  medium: { label: "Medium Risk", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  high: { label: "High Risk", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const RISK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  low: ShieldCheck,
  medium: Shield,
  high: ShieldAlert,
};

/* ── Permission labels ──────────────────────────────────── */

const PERMISSION_LABELS: Record<SkillPermission, string> = {
  can_search_creators: "Creator Search",
  can_draft_outreach: "Draft Outreach",
  can_send_outreach: "Send Outreach",
  can_manage_campaigns: "Campaign Management",
  can_negotiate: "Negotiation",
  can_track_performance: "Performance Tracking",
  can_manage_relationships: "Relationship Management",
  can_manage_budget: "Budget Management",
  can_scan_content: "Content Scanning",
  can_generate_reports: "Report Generation",
};

/* ── Main Page ──────────────────────────────────────────── */

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(CATEGORY_META))
  );

  // Custom skills state
  const [customSkills, setCustomSkills] = useState<CustomSkillItem[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSkill, setEditingSkill] = useState<CustomSkillItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCustomSkills = useCallback(() => {
    fetch("/api/agent/custom-skills")
      .then((r) => r.json())
      .then((data) => setCustomSkills(data.skills || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/agent/skills")
      .then((r) => r.json())
      .then((data) => {
        setSkills(data.skills || []);
        setPermissions(data.permissions || {});
      })
      .finally(() => setLoading(false));

    loadCustomSkills();
  }, [loadCustomSkills]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleTogglePermission = async (permission: SkillPermission, enabled: boolean) => {
    setToggling(permission);
    try {
      const res = await fetch("/api/agent/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission, enabled }),
      });
      if (res.ok) {
        setPermissions((prev) => ({ ...prev, [permission]: enabled }));
        setSkills((prev) =>
          prev.map((s) =>
            s.permission === permission
              ? { ...s, permissionEnabled: enabled, enabled: enabled && !s.skillDisabled }
              : s
          )
        );
      }
    } catch {
      // Error handled silently
    }
    setToggling(null);
  };

  const handleToggleSkill = async (skillName: string, enabled: boolean) => {
    setToggling(skillName);
    try {
      const res = await fetch("/api/agent/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName, enabled }),
      });
      if (res.ok) {
        setSkills((prev) =>
          prev.map((s) =>
            s.name === skillName
              ? { ...s, skillDisabled: !enabled, enabled: s.permissionEnabled && enabled }
              : s
          )
        );
      }
    } catch {
      // Error handled silently
    }
    setToggling(null);
  };

  // Group skills by category
  const grouped = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) acc[skill.category] = [];
      acc[skill.category].push(skill);
      return acc;
    },
    {} as Record<string, SkillItem[]>
  );

  const categoryOrder: SkillCategory[] = [
    "discovery",
    "outreach",
    "negotiation",
    "campaign",
    "tracking",
    "relationship",
  ];

  const totalSkills = skills.length + customSkills.filter((s) => s.is_active).length;
  const enabledSkills = skills.filter((s) => s.enabled).length + customSkills.filter((s) => s.is_active).length;

  // Custom skill handlers
  const handleToggleCustomSkill = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/agent/custom-skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      setCustomSkills((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: active } : s))
      );
    } catch {}
  };

  const handleDeleteCustomSkill = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/agent/custom-skills/${id}`, { method: "DELETE" });
      setCustomSkills((prev) => prev.filter((s) => s.id !== id));
    } catch {}
    setDeletingId(null);
  };

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
          <h1 className="font-serif italic text-2xl tracking-tight text-foreground">
            Skills
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your agent has {totalSkills} skills across {categoryOrder.length} categories.
            Toggle permissions to control what the agent can do.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {enabledSkills}/{totalSkills}
            </span>
            <span className="text-xs text-muted-foreground">active</span>
          </div>
          <Button onClick={() => { setEditingSkill(null); setShowBuilder(true); }}>
            <Plus className="h-4 w-4" />
            Create Skill
          </Button>
        </div>
      </div>

      {/* Permission toggles summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(PERMISSION_LABELS).map(([perm, label]) => {
          const enabled = permissions[perm] ?? true;
          const skillCount = skills.filter((s) => s.permission === perm).length;
          return (
            <div
              key={perm}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors",
                enabled
                  ? "bg-background border-border"
                  : "bg-muted/30 border-border/50"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs font-medium truncate", !enabled && "text-muted-foreground")}>
                  {label}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {skillCount} skill{skillCount !== 1 ? "s" : ""}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(val) =>
                  handleTogglePermission(perm as SkillPermission, val)
                }
                disabled={toggling === perm}
                className="shrink-0"
              />
            </div>
          );
        })}
      </div>

      {/* Custom Skills Section */}
      {customSkills.length > 0 && (
        <div className="rounded-xl border bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5">
                <Sparkles className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Custom Skills</h2>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {customSkills.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Skills you created for your agent</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customSkills.map((skill) => {
                const execMeta = EXEC_TYPE_META[skill.execution_type] || EXEC_TYPE_META.prompt;
                const ExecIcon = execMeta.icon;
                const riskBadge = RISK_BADGES[skill.risk_level] || RISK_BADGES.medium;
                const RiskIcon = RISK_ICONS[skill.risk_level] || RISK_ICONS.medium;
                const paramCount = Object.keys(
                  (skill.input_schema?.properties as Record<string, unknown>) || {}
                ).length;

                return (
                  <div
                    key={skill.id}
                    className={cn(
                      "group rounded-lg border p-4 transition-all",
                      skill.is_active
                        ? "bg-background hover:shadow-sm"
                        : "bg-muted/20 border-border/50 opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium">{skill.label}</h3>
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] px-1.5 py-0 gap-1", execMeta.color)}
                          >
                            <ExecIcon className="h-2.5 w-2.5" />
                            {execMeta.label}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] px-1.5 py-0 gap-1", riskBadge.className)}
                          >
                            <RiskIcon className="h-2.5 w-2.5" />
                            {riskBadge.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {skill.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono">{skill.name}</span>
                        {paramCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {paramCount} param{paramCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setEditingSkill(skill); setShowBuilder(true); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCustomSkill(skill.id)}
                          disabled={deletingId === skill.id}
                        >
                          {deletingId === skill.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                        <Switch
                          checked={skill.is_active}
                          onCheckedChange={(val) => handleToggleCustomSkill(skill.id, val)}
                          className="ml-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Built-in Skills by category */}
      <div className="flex flex-col gap-4">
        {categoryOrder.map((cat) => {
          const catMeta = CATEGORY_META[cat];
          const catSkills = grouped[cat] || [];
          if (catSkills.length === 0) return null;

          const Icon = CATEGORY_ICONS[cat];
          const colorClasses = CATEGORY_COLORS[catMeta.color];
          const isExpanded = expandedCategories.has(cat);
          const enabledCount = catSkills.filter((s) => s.enabled).length;

          return (
            <div key={cat} className="rounded-xl border bg-background">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-xl"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    colorClasses
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{catMeta.label}</h2>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {catSkills.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{catMeta.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {enabledCount}/{catSkills.length} active
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Skills grid */}
              {isExpanded && (
                <div className="border-t px-5 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catSkills.map((skill) => {
                      const RiskIcon = RISK_ICONS[skill.riskLevel];
                      const riskBadge = RISK_BADGES[skill.riskLevel];
                      const permOff = !skill.permissionEnabled;
                      return (
                        <div
                          key={skill.name}
                          className={cn(
                            "group rounded-lg border p-4 transition-all",
                            skill.enabled
                              ? "bg-background hover:shadow-sm"
                              : "bg-muted/20 border-border/50 opacity-60"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium">
                                  {skill.label}
                                </h3>
                                <Badge
                                  variant="secondary"
                                  className={cn("text-[10px] px-1.5 py-0 gap-1", riskBadge.className)}
                                >
                                  <RiskIcon className="h-2.5 w-2.5" />
                                  {riskBadge.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {skill.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {skill.name}
                            </span>
                            <div className="flex items-center gap-2">
                              {permOff && (
                                <span className="text-[10px] text-muted-foreground">
                                  Permission off
                                </span>
                              )}
                              <Switch
                                checked={skill.enabled}
                                onCheckedChange={(val) =>
                                  handleToggleSkill(skill.name, val)
                                }
                                disabled={permOff || toggling === skill.name}
                                className="shrink-0"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skill Builder Modal */}
      {showBuilder && (
        <SkillBuilder
          onClose={() => { setShowBuilder(false); setEditingSkill(null); }}
          onSave={() => {
            setShowBuilder(false);
            setEditingSkill(null);
            loadCustomSkills();
          }}
          editSkill={editingSkill || undefined}
        />
      )}
    </div>
  );
}
