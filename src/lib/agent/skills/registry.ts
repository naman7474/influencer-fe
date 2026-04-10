/* ------------------------------------------------------------------ */
/*  Skill Registry                                                     */
/*  Declarative system for registering and loading agent skills        */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool } from "ai";
import { dynamicTool, jsonSchema } from "ai";
import type { AgentConfig } from "@/lib/types/database";
import type { SkillDefinition, SkillPermission } from "./types";
import { executeCustomSkill } from "./custom-executor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

// Central list of all registered skills
const registry: SkillDefinition[] = [];

/**
 * Register a skill definition. Called at module load time by each
 * category's index.ts barrel file.
 */
export function registerSkill(definition: SkillDefinition): void {
  // Prevent duplicate registrations (e.g. from hot-reload)
  const existing = registry.findIndex((s) => s.name === definition.name);
  if (existing >= 0) {
    registry[existing] = definition;
  } else {
    registry.push(definition);
  }
}

/**
 * Register multiple skill definitions at once.
 */
export function registerSkills(definitions: SkillDefinition[]): void {
  for (const def of definitions) {
    registerSkill(def);
  }
}

/**
 * Check if a permission is enabled on the agent config.
 * Falls back to true for Phase 5 permissions that may not exist yet
 * on older configs (can_track_performance, can_manage_relationships, etc.)
 */
function isPermissionEnabled(
  config: AgentConfig,
  permission: SkillPermission
): boolean {
  const value = (config as Record<string, unknown>)[permission];
  // If the field doesn't exist on the config yet (pre-migration), default to true
  // except can_manage_budget which defaults to false
  if (value === undefined || value === null) {
    return permission === "can_manage_budget" ? false : true;
  }
  return Boolean(value);
}

/**
 * Build the complete toolset for an agent session.
 * Iterates all registered skills, checks permissions, and returns
 * a Record<string, Tool> ready for streamText().
 *
 * Also loads user-defined custom skills from the database.
 */
export async function buildToolset(
  brandId: string,
  supabase: SupabaseClient,
  agentConfig: AgentConfig
): Promise<Record<string, AnyTool>> {
  const tools: Record<string, AnyTool> = {};

  // 1. Load built-in skills (permission-filtered + per-skill filter)
  const disabledSkills = new Set(
    (Array.isArray((agentConfig as Record<string, unknown>).disabled_skills)
      ? (agentConfig as Record<string, unknown>).disabled_skills as string[]
      : [])
  );

  for (const skill of registry) {
    if (
      isPermissionEnabled(agentConfig, skill.permission) &&
      !disabledSkills.has(skill.name)
    ) {
      tools[skill.name] = skill.factory(brandId, supabase);
    }
  }

  // 2. Load custom skills from database
  try {
    const { data: customRows } = await supabase
      .from("custom_skills")
      .select("*")
      .eq("brand_id", brandId)
      .eq("is_active", true);

    const customSkills = (customRows || []) as Array<{
      name: string;
      description: string;
      input_schema: Record<string, unknown>;
      execution_type: "prompt" | "api" | "query";
      execution_config: Record<string, unknown>;
    }>;

    for (const row of customSkills) {
      // Skip if name conflicts with built-in
      if (tools[row.name]) continue;

      tools[row.name] = dynamicTool({
        description: row.description,
        inputSchema: jsonSchema(row.input_schema as Parameters<typeof jsonSchema>[0]),
        execute: async (params) =>
          executeCustomSkill(
            { execution_type: row.execution_type, execution_config: row.execution_config },
            params as Record<string, unknown>,
            brandId,
            supabase
          ),
      });
    }
  } catch {
    // If custom_skills table doesn't exist yet, silently continue with built-in only
  }

  return tools;
}

/**
 * Get all registered skill definitions (for debugging/admin).
 */
export function getRegisteredSkills(): readonly SkillDefinition[] {
  return registry;
}

/**
 * Get registered skills filtered by category.
 */
export function getSkillsByCategory(
  category: SkillDefinition["category"]
): SkillDefinition[] {
  return registry.filter((s) => s.category === category);
}
