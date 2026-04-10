"use client";

import { useState, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Sparkles,
  Globe,
  Database,
  Play,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────── */

interface ParamDef {
  key: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

interface SkillFormData {
  name: string;
  label: string;
  description: string;
  category: string;
  risk_level: "low" | "medium" | "high";
  params: ParamDef[];
  execution_type: "prompt" | "api" | "query";
  // Prompt config
  system_prompt: string;
  user_template: string;
  // API config
  api_method: string;
  api_url: string;
  api_headers: string;
  api_body_template: string;
  // Query config
  query_table: string;
  query_select: string;
  query_filters: Array<{ column: string; op: string; param: string }>;
  query_order: string;
  query_limit: number;
}

interface SkillBuilderProps {
  onClose: () => void;
  onSave: () => void;
  editSkill?: {
    id: string;
    name: string;
    label: string;
    description: string;
    category: string;
    risk_level: string;
    input_schema: Record<string, unknown>;
    execution_type: string;
    execution_config: Record<string, unknown>;
  };
}

/* ── Constants ──────────────────────────────────────────── */

const STEPS = ["Basic Info", "Parameters", "Execution", "Test & Save"];

const CATEGORIES = [
  { value: "custom", label: "Custom" },
  { value: "discovery", label: "Discovery" },
  { value: "outreach", label: "Outreach" },
  { value: "negotiation", label: "Negotiation" },
  { value: "campaign", label: "Campaign" },
  { value: "tracking", label: "Tracking" },
  { value: "relationship", label: "Relationship" },
];

const EXECUTION_TYPES = [
  {
    value: "prompt",
    label: "Prompt (LLM Sub-call)",
    description: "Runs a Claude prompt with your template and parameters. Best for analysis, formatting, and reasoning tasks.",
    icon: Sparkles,
    color: "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30",
  },
  {
    value: "api",
    label: "API Call",
    description: "Calls an external HTTP endpoint. Use for connecting to your CRM, analytics tools, or webhooks.",
    icon: Globe,
    color: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
  },
  {
    value: "query",
    label: "Database Query",
    description: "Queries your platform data with filters. Build custom searches or reports not covered by built-in skills.",
    icon: Database,
    color: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
  },
];

const QUERY_TABLES = [
  "creators",
  "campaigns",
  "campaign_creators",
  "creator_brand_matches",
  "agent_episodes",
  "agent_knowledge",
  "approval_queue",
  "notifications",
];

const FILTER_OPS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: ">= " },
  { value: "lt", label: "less than" },
  { value: "lte", label: "<=" },
  { value: "like", label: "contains" },
  { value: "ilike", label: "contains (case-insensitive)" },
];

/* ── Helpers ─────────────────────────────────────────────── */

function extractParamsFromSchema(schema: Record<string, unknown>): ParamDef[] {
  const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required || []) as string[];
  return Object.entries(properties).map(([key, prop]) => ({
    key,
    type: (prop.type as ParamDef["type"]) || "string",
    description: (prop.description as string) || "",
    required: required.includes(key),
  }));
}

function buildJsonSchema(params: ParamDef[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const p of params) {
    properties[p.key] = {
      type: p.type,
      description: p.description || `The ${p.key} parameter`,
    };
    if (p.required) required.push(p.key);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

/* ── Component ───────────────────────────────────────────── */

export function SkillBuilder({ onClose, onSave, editSkill }: SkillBuilderProps) {
  const isEditing = !!editSkill;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<SkillFormData>(() => {
    if (editSkill) {
      const ec = editSkill.execution_config;
      return {
        name: editSkill.name,
        label: editSkill.label,
        description: editSkill.description,
        category: editSkill.category,
        risk_level: editSkill.risk_level as "low" | "medium" | "high",
        params: extractParamsFromSchema(editSkill.input_schema),
        execution_type: editSkill.execution_type as "prompt" | "api" | "query",
        system_prompt: (ec.system_prompt as string) || "",
        user_template: (ec.user_template as string) || "",
        api_method: (ec.method as string) || "GET",
        api_url: (ec.url as string) || "",
        api_headers: ec.headers ? JSON.stringify(ec.headers, null, 2) : "",
        api_body_template: ec.body_template ? JSON.stringify(ec.body_template, null, 2) : "",
        query_table: (ec.table as string) || "",
        query_select: (ec.select as string) || "*",
        query_filters: (ec.filters as Array<{ column: string; op: string; param: string }>) || [],
        query_order: (ec.order as string) || "",
        query_limit: (ec.limit as number) || 20,
      };
    }
    return {
      name: "",
      label: "",
      description: "",
      category: "custom",
      risk_level: "medium",
      params: [],
      execution_type: "prompt",
      system_prompt: "",
      user_template: "",
      api_method: "GET",
      api_url: "",
      api_headers: "",
      api_body_template: "",
      query_table: "",
      query_select: "*",
      query_filters: [],
      query_order: "",
      query_limit: 20,
    };
  });

  const updateForm = useCallback((patch: Partial<SkillFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  // Auto-generate name from label
  const handleLabelChange = (label: string) => {
    updateForm({ label, ...(!isEditing ? { name: toSnakeCase(label) } : {}) });
  };

  // Build execution config from form
  function buildExecutionConfig(): Record<string, unknown> {
    switch (form.execution_type) {
      case "prompt":
        return {
          system_prompt: form.system_prompt,
          user_template: form.user_template,
          model: "claude-sonnet-4-20250514",
        };
      case "api": {
        let headers: Record<string, string> = {};
        let bodyTemplate: Record<string, unknown> | undefined;
        try {
          if (form.api_headers.trim()) headers = JSON.parse(form.api_headers);
        } catch { /* invalid JSON, skip */ }
        try {
          if (form.api_body_template.trim()) bodyTemplate = JSON.parse(form.api_body_template);
        } catch { /* invalid JSON, skip */ }
        return {
          method: form.api_method,
          url: form.api_url,
          headers,
          ...(bodyTemplate ? { body_template: bodyTemplate } : {}),
        };
      }
      case "query":
        return {
          table: form.query_table,
          select: form.query_select,
          filters: form.query_filters,
          order: form.query_order || undefined,
          limit: form.query_limit,
        };
      default:
        return {};
    }
  }

  // Test
  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);

    // Build sample params from param definitions
    const testParams: Record<string, unknown> = {};
    for (const p of form.params) {
      if (p.type === "number") testParams[p.key] = 10;
      else if (p.type === "boolean") testParams[p.key] = true;
      else testParams[p.key] = `sample_${p.key}`;
    }

    try {
      const res = await fetch("/api/agent/custom-skills/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          execution_type: form.execution_type,
          execution_config: buildExecutionConfig(),
          test_params: testParams,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult(data.result);
      } else {
        setError(data.error || "Test failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    }
    setTesting(false);
  }

  // Save
  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      label: form.label,
      description: form.description,
      category: form.category,
      risk_level: form.risk_level,
      input_schema: buildJsonSchema(form.params),
      execution_type: form.execution_type,
      execution_config: buildExecutionConfig(),
    };

    try {
      const url = isEditing
        ? `/api/agent/custom-skills/${editSkill!.id}`
        : "/api/agent/custom-skills";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSave();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  }

  // Params helpers
  const addParam = () => {
    updateForm({
      params: [...form.params, { key: "", type: "string", description: "", required: false }],
    });
  };

  const removeParam = (idx: number) => {
    updateForm({ params: form.params.filter((_, i) => i !== idx) });
  };

  const updateParam = (idx: number, patch: Partial<ParamDef>) => {
    const updated = form.params.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    updateForm({ params: updated });
  };

  // Query filter helpers
  const addFilter = () => {
    updateForm({
      query_filters: [...form.query_filters, { column: "", op: "eq", param: "" }],
    });
  };

  const removeFilter = (idx: number) => {
    updateForm({ query_filters: form.query_filters.filter((_, i) => i !== idx) });
  };

  const updateFilter = (idx: number, patch: Partial<{ column: string; op: string; param: string }>) => {
    const updated = form.query_filters.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    updateForm({ query_filters: updated });
  };

  // Step validation
  const canProceed = () => {
    switch (step) {
      case 0:
        return form.name && form.label && form.description;
      case 1:
        return form.params.every((p) => p.key && p.type);
      case 2:
        if (form.execution_type === "prompt") return form.user_template.length > 0;
        if (form.execution_type === "api") return form.api_url.length > 0;
        if (form.execution_type === "query") return form.query_table.length > 0;
        return true;
      default:
        return true;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      <div className="w-full max-w-2xl bg-background border rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">
              {isEditing ? "Edit Skill" : "Create Custom Skill"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-6 py-3 border-b bg-muted/30">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <button
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-primary/10 text-primary cursor-pointer"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 min-h-[340px]">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Skill Name *</Label>
                <Input
                  value={form.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g. Analyze Creator Content Style"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Tool key:</span>
                  <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                    {form.name || "..."}
                  </code>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Description *</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder="Describe what this skill does. Claude uses this to decide when to call it."
                  rows={3}
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Be specific — this is the main routing signal for when the agent should use this skill.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(val) => updateForm({ category: val as string })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Risk Level</Label>
                  <Select
                    value={form.risk_level}
                    onValueChange={(val) => updateForm({ risk_level: val as "low" | "medium" | "high" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Parameters */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Input Parameters</p>
                  <p className="text-xs text-muted-foreground">
                    Define what inputs this skill accepts. Use {`{{param_name}}`} in templates.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addParam}>
                  <Plus className="h-3 w-3" />
                  Add Parameter
                </Button>
              </div>

              {form.params.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No parameters yet. Add one to define inputs for your skill.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addParam}>
                    <Plus className="h-3 w-3" />
                    Add First Parameter
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {form.params.map((param, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={param.key}
                          onChange={(e) =>
                            updateParam(idx, { key: toSnakeCase(e.target.value) })
                          }
                          placeholder="param_name"
                          className="flex-1 font-mono text-xs"
                        />
                        <Select
                          value={param.type}
                          onValueChange={(val) =>
                            updateParam(idx, { type: val as ParamDef["type"] })
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() =>
                            updateParam(idx, { required: !param.required })
                          }
                        >
                          <Badge
                            variant={param.required ? "default" : "outline"}
                            className="text-[9px] px-1 py-0"
                          >
                            {param.required ? "Required" : "Optional"}
                          </Badge>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeParam(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        value={param.description}
                        onChange={(e) => updateParam(idx, { description: e.target.value })}
                        placeholder="Description (helps Claude understand this parameter)"
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Execution Config */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {/* Execution type selector */}
              <div className="grid grid-cols-3 gap-3">
                {EXECUTION_TYPES.map((et) => {
                  const Icon = et.icon;
                  const selected = form.execution_type === et.value;
                  return (
                    <button
                      key={et.value}
                      onClick={() => updateForm({ execution_type: et.value as SkillFormData["execution_type"] })}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all",
                        selected
                          ? cn("ring-2 ring-primary", et.color)
                          : "hover:border-primary/30"
                      )}
                    >
                      <Icon className="h-4 w-4 mb-1.5" />
                      <p className="text-xs font-medium">{et.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        {et.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Prompt config */}
              {form.execution_type === "prompt" && (
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>System Prompt (optional)</Label>
                    <Textarea
                      value={form.system_prompt}
                      onChange={(e) => updateForm({ system_prompt: e.target.value })}
                      placeholder="You are an expert at analyzing influencer content styles..."
                      rows={3}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>User Prompt Template *</Label>
                    <Textarea
                      value={form.user_template}
                      onChange={(e) => updateForm({ user_template: e.target.value })}
                      placeholder={`Analyze the content style of creator {{creator_handle}}. Focus on {{criteria}}.`}
                      rows={5}
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Use {`{{param_name}}`} to reference parameters.
                      Available: {form.params.map((p) => `{{${p.key}}}`).join(", ") || "none defined"}
                    </p>
                  </div>
                </div>
              )}

              {/* API config */}
              {form.execution_type === "api" && (
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={form.api_method}
                      onValueChange={(val) => updateForm({ api_method: val as string })}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={form.api_url}
                      onChange={(e) => updateForm({ api_url: e.target.value })}
                      placeholder="https://api.example.com/endpoint/{{param}}"
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Headers (JSON)</Label>
                    <Textarea
                      value={form.api_headers}
                      onChange={(e) => updateForm({ api_headers: e.target.value })}
                      placeholder={`{"Authorization": "Bearer your-api-key"}`}
                      rows={2}
                      className="text-xs font-mono"
                    />
                  </div>
                  {form.api_method !== "GET" && (
                    <div className="flex flex-col gap-1.5">
                      <Label>Body Template (JSON)</Label>
                      <Textarea
                        value={form.api_body_template}
                        onChange={(e) => updateForm({ api_body_template: e.target.value })}
                        placeholder={`{"handle": "{{creator_handle}}", "action": "analyze"}`}
                        rows={4}
                        className="text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Query config */}
              {form.execution_type === "query" && (
                <div className="flex flex-col gap-3 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Table *</Label>
                      <Select
                        value={form.query_table}
                        onValueChange={(val) => updateForm({ query_table: val as string })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select table" />
                        </SelectTrigger>
                        <SelectContent>
                          {QUERY_TABLES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Select Fields</Label>
                      <Input
                        value={form.query_select}
                        onChange={(e) => updateForm({ query_select: e.target.value })}
                        placeholder="* or column1, column2"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Filters */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Filters</Label>
                      <Button variant="outline" size="sm" onClick={addFilter}>
                        <Plus className="h-3 w-3" />
                        Add Filter
                      </Button>
                    </div>
                    {form.query_filters.map((filter, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <Input
                          value={filter.column}
                          onChange={(e) => updateFilter(idx, { column: e.target.value })}
                          placeholder="column"
                          className="flex-1 font-mono text-xs"
                        />
                        <Select
                          value={filter.op}
                          onValueChange={(val) => updateFilter(idx, { op: val as string })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={filter.param}
                          onChange={(e) => updateFilter(idx, { param: e.target.value })}
                          placeholder="param_name"
                          className="flex-1 font-mono text-xs"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeFilter(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Order By</Label>
                      <Input
                        value={form.query_order}
                        onChange={(e) => updateForm({ query_order: e.target.value })}
                        placeholder="column_name"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Limit</Label>
                      <Input
                        type="number"
                        value={form.query_limit}
                        onChange={(e) => updateForm({ query_limit: Number(e.target.value) || 20 })}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Test & Save */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              {/* Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Skill Summary</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <code className="font-mono">{form.name}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Label</span>
                    <span>{form.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="secondary" className="text-[10px]">{form.execution_type}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Parameters</span>
                    <span>{form.params.length} defined</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Level</span>
                    <Badge variant="outline" className="text-[10px]">{form.risk_level}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Test button */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {testing ? "Running test..." : "Test with sample data"}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Runs the skill with placeholder values to verify it works.
                </p>
              </div>

              {/* Test result */}
              {testResult !== null && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-green-600">
                      <Check className="h-3 w-3" />
                      Test Passed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-[10px] font-mono bg-muted rounded-lg p-3 overflow-auto max-h-48">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 mt-4">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
          >
            <ChevronLeft className="h-3 w-3" />
            {step > 0 ? "Back" : "Cancel"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {saving ? "Saving..." : isEditing ? "Update Skill" : "Create Skill"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
