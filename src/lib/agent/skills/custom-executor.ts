/* ------------------------------------------------------------------ */
/*  Custom Skill Executor                                              */
/*  Handles runtime execution of user-defined skills (prompt/api/query)*/
/* ------------------------------------------------------------------ */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { SupabaseClient } from "@supabase/supabase-js";

interface SkillExecution {
  execution_type: "prompt" | "api" | "query";
  execution_config: Record<string, unknown>;
}

/**
 * Execute a custom skill based on its type and config.
 */
export async function executeCustomSkill(
  skill: SkillExecution,
  params: Record<string, unknown>,
  brandId: string,
  supabase: SupabaseClient
): Promise<unknown> {
  switch (skill.execution_type) {
    case "prompt":
      return executePromptSkill(skill.execution_config, params);
    case "api":
      return executeApiSkill(skill.execution_config, params);
    case "query":
      return executeQuerySkill(skill.execution_config, params, brandId, supabase);
    default:
      return { error: `Unknown execution type: ${skill.execution_type}` };
  }
}

/* ── Prompt Type ─────────────────────────────────────────── */

/**
 * Execute a prompt-type custom skill.
 * Runs a sub-LLM call with a user-defined template.
 * Template variables: {{param_name}} are replaced with actual values.
 */
async function executePromptSkill(
  config: Record<string, unknown>,
  params: Record<string, unknown>
): Promise<unknown> {
  const systemPrompt = (config.system_prompt as string) || "";
  const userTemplate = (config.user_template as string) || "";
  const model = (config.model as string) || "claude-sonnet-4-20250514";

  // Interpolate template variables
  const userMessage = interpolateTemplate(userTemplate, params);
  const interpolatedSystem = interpolateTemplate(systemPrompt, params);

  try {
    const { text, usage } = await generateText({
      model: anthropic(model),
      system: interpolatedSystem || undefined,
      prompt: userMessage,
      maxOutputTokens: 2048,
      temperature: 0.7,
    });

    return {
      result: text,
      tokens_used: usage?.totalTokens ?? 0,
      params_received: params,
    };
  } catch (err) {
    return {
      error: `Prompt execution failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      params_received: params,
    };
  }
}

/* ── API Type ────────────────────────────────────────────── */

/**
 * Execute an API-type custom skill.
 * Makes an HTTP request to a user-defined endpoint.
 * Runs server-side — credentials never exposed to client/LLM.
 */
async function executeApiSkill(
  config: Record<string, unknown>,
  params: Record<string, unknown>
): Promise<unknown> {
  const method = ((config.method as string) || "GET").toUpperCase();
  const urlTemplate = (config.url as string) || "";
  const headersConfig = (config.headers as Record<string, string>) || {};
  const bodyTemplate = config.body_template as Record<string, unknown> | string | undefined;

  if (!urlTemplate) {
    return { error: "No URL configured for this skill" };
  }

  // Interpolate URL and headers
  const url = interpolateTemplate(urlTemplate, params);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(headersConfig)) {
    headers[key] = interpolateTemplate(value, params);
  }

  // Build body
  let body: string | undefined;
  if (bodyTemplate && method !== "GET") {
    if (typeof bodyTemplate === "string") {
      body = interpolateTemplate(bodyTemplate, params);
    } else {
      // Deep interpolate object values
      const interpolated = deepInterpolate(bodyTemplate, params);
      body = JSON.stringify(interpolated);
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    const contentType = response.headers.get("content-type") || "";
    let data: unknown;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      params_received: params,
    };
  } catch (err) {
    return {
      error: `API call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      url,
      params_received: params,
    };
  }
}

/* ── Query Type ──────────────────────────────────────────── */

/**
 * Execute a query-type custom skill.
 * Runs a parameterized Supabase query.
 */
async function executeQuerySkill(
  config: Record<string, unknown>,
  params: Record<string, unknown>,
  brandId: string,
  supabase: SupabaseClient
): Promise<unknown> {
  const table = config.table as string;
  const selectFields = (config.select as string) || "*";
  const filters = (config.filters as Array<{ column: string; op: string; param: string }>) || [];
  const orderBy = config.order as string | undefined;
  const orderAsc = (config.order_ascending as boolean) ?? false;
  const limit = Math.min((config.limit as number) || 20, 50);

  if (!table) {
    return { error: "No table configured for this skill" };
  }

  // Whitelist allowed tables to prevent SQL injection
  const ALLOWED_TABLES = [
    "creators",
    "campaigns",
    "campaign_creators",
    "creator_brand_matches",
    "agent_episodes",
    "agent_knowledge",
    "approval_queue",
    "notifications",
    "mv_creator_relationship_summary",
  ];

  if (!ALLOWED_TABLES.includes(table)) {
    return { error: `Table "${table}" is not accessible. Allowed: ${ALLOWED_TABLES.join(", ")}` };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabase.from(table).select(selectFields) as any;

    // Always scope to brand where possible
    const BRAND_SCOPED_TABLES = [
      "campaigns",
      "campaign_creators",
      "creator_brand_matches",
      "agent_episodes",
      "agent_knowledge",
      "approval_queue",
      "notifications",
      "mv_creator_relationship_summary",
    ];
    if (BRAND_SCOPED_TABLES.includes(table)) {
      query = query.eq("brand_id", brandId);
    }

    // Apply filters
    for (const filter of filters) {
      const value = params[filter.param];
      if (value === undefined || value === null) continue;

      switch (filter.op) {
        case "eq":
          query = query.eq(filter.column, value);
          break;
        case "neq":
          query = query.neq(filter.column, value);
          break;
        case "gt":
          query = query.gt(filter.column, value);
          break;
        case "gte":
          query = query.gte(filter.column, value);
          break;
        case "lt":
          query = query.lt(filter.column, value);
          break;
        case "lte":
          query = query.lte(filter.column, value);
          break;
        case "like":
          query = query.like(filter.column, `%${value}%`);
          break;
        case "ilike":
          query = query.ilike(filter.column, `%${value}%`);
          break;
        case "in":
          query = query.in(filter.column, Array.isArray(value) ? value : [value]);
          break;
        default:
          break;
      }
    }

    if (orderBy) {
      query = query.order(orderBy, { ascending: orderAsc });
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      return { error: `Query failed: ${error.message}`, params_received: params };
    }

    return {
      results: data || [],
      count: (data || []).length,
      params_received: params,
    };
  } catch (err) {
    return {
      error: `Query execution failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      params_received: params,
    };
  }
}

/* ── Template Helpers ────────────────────────────────────── */

/**
 * Replace {{variable}} placeholders with actual values.
 */
function interpolateTemplate(
  template: string,
  params: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

/**
 * Deep-interpolate an object's string values.
 */
function deepInterpolate(
  obj: Record<string, unknown>,
  params: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = interpolateTemplate(value, params);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepInterpolate(value as Record<string, unknown>, params);
    } else {
      result[key] = value;
    }
  }
  return result;
}
