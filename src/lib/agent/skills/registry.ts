/* ------------------------------------------------------------------ */
/*  Skill Registry                                                     */
/*  Declarative system for registering and loading agent skills        */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { tool } from "ai";
import type { AgentConfig } from "@/lib/types/database";
import type { SkillDefinition, SkillPermission } from "./types";

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
 */
export function buildToolset(
  brandId: string,
  supabase: SupabaseClient,
  agentConfig: AgentConfig
): Record<string, ReturnType<typeof tool>> {
  const tools: Record<string, ReturnType<typeof tool>> = {};

  for (const skill of registry) {
    if (isPermissionEnabled(agentConfig, skill.permission)) {
      tools[skill.name] = skill.factory(brandId, supabase);
    }
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
