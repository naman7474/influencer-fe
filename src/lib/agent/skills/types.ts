/* ------------------------------------------------------------------ */
/*  Skill Registry Types                                               */
/*  Shared types for the declarative skill registry system             */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { tool } from "ai";

export type SkillCategory =
  | "discovery"
  | "negotiation"
  | "campaign"
  | "tracking"
  | "relationship"
  | "outreach";

export type RiskLevel = "low" | "medium" | "high";

/**
 * Permission keys on agent_config that gate skill registration.
 * Each skill declares which permission must be true for it to load.
 */
export type SkillPermission =
  | "can_search_creators"
  | "can_draft_outreach"
  | "can_send_outreach"
  | "can_manage_campaigns"
  | "can_negotiate"
  | "can_track_performance"
  | "can_manage_relationships"
  | "can_manage_budget"
  | "can_scan_content"
  | "can_generate_reports";

/**
 * A single skill definition for the registry.
 * Each skill file exports one of these alongside its factory function.
 */
export interface SkillDefinition {
  /** Tool key the LLM sees, e.g. "lookalike_finder" */
  name: string;
  /** Category for organization and logging */
  category: SkillCategory;
  /** Which agent_config boolean gates this skill */
  permission: SkillPermission;
  /** Risk level — high-risk skills may route through approval wrapper */
  riskLevel: RiskLevel;
  /** Factory that builds the Vercel AI SDK tool instance */
  factory: (brandId: string, supabase: SupabaseClient) => ReturnType<typeof tool>;
}

/**
 * Context passed to skills that need autonomy-aware behavior.
 * Populated from agent_config.action_autonomy JSONB.
 */
export type ActionAutonomyLevel =
  | "AUTO"
  | "AUTO-DRAFT"
  | "APPROVAL-REQUIRED"
  | "ALWAYS-MANUAL";

export interface ActionAutonomyConfig {
  first_outreach: ActionAutonomyLevel;
  follow_up_no_response: ActionAutonomyLevel;
  follow_up_after_response: ActionAutonomyLevel;
  negotiate_rates: ActionAutonomyLevel;
  send_brief: ActionAutonomyLevel;
  content_revision: ActionAutonomyLevel;
  gifting_order: ActionAutonomyLevel;
  budget_commit_above_threshold: ActionAutonomyLevel;
}

export const DEFAULT_ACTION_AUTONOMY: ActionAutonomyConfig = {
  first_outreach: "APPROVAL-REQUIRED",
  follow_up_no_response: "APPROVAL-REQUIRED",
  follow_up_after_response: "APPROVAL-REQUIRED",
  negotiate_rates: "ALWAYS-MANUAL",
  send_brief: "APPROVAL-REQUIRED",
  content_revision: "AUTO-DRAFT",
  gifting_order: "APPROVAL-REQUIRED",
  budget_commit_above_threshold: "ALWAYS-MANUAL",
};
