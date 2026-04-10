/* ------------------------------------------------------------------ */
/*  Per-Action Autonomy Resolver                                       */
/*  Maps action names to autonomy levels from agent_config             */
/* ------------------------------------------------------------------ */

import type { AgentConfig } from "@/lib/types/database";
import type { ActionAutonomyLevel, ActionAutonomyConfig } from "./skills/types";
import { DEFAULT_ACTION_AUTONOMY } from "./skills/types";

/** All supported action names */
export type ActionName = keyof ActionAutonomyConfig;

const ACTION_LABELS: Record<ActionName, string> = {
  first_outreach: "First outreach email",
  follow_up_no_response: "Follow-up (no response)",
  follow_up_after_response: "Follow-up (after response)",
  negotiate_rates: "Negotiate rates",
  send_brief: "Send campaign brief",
  content_revision: "Content revision request",
  gifting_order: "Create gifting order",
  budget_commit_above_threshold: "Commit budget above threshold",
};

/**
 * Get the autonomy level for a specific action.
 * Reads from action_autonomy JSONB if available, otherwise falls
 * back to mapping the global autonomy_level to per-action defaults.
 */
export function getActionAutonomy(
  agentConfig: AgentConfig,
  action: ActionName
): ActionAutonomyLevel {
  // Try per-action config first
  const actionAutonomy = agentConfig.action_autonomy as Record<string, string> | null;
  if (actionAutonomy && actionAutonomy[action]) {
    const level = actionAutonomy[action] as ActionAutonomyLevel;
    if (isValidLevel(level)) return level;
  }

  // Fall back to defaults
  return DEFAULT_ACTION_AUTONOMY[action];
}

/**
 * Get all action autonomy settings, merging config with defaults.
 */
export function getAllActionAutonomy(
  agentConfig: AgentConfig
): ActionAutonomyConfig {
  const config = (agentConfig.action_autonomy as Record<string, string>) || {};
  const result = { ...DEFAULT_ACTION_AUTONOMY };

  for (const key of Object.keys(result) as ActionName[]) {
    if (config[key] && isValidLevel(config[key] as ActionAutonomyLevel)) {
      result[key] = config[key] as ActionAutonomyLevel;
    }
  }

  return result;
}

/**
 * Format the action permissions table for the system prompt.
 */
export function formatAutonomyForPrompt(
  agentConfig: AgentConfig
): string {
  const autonomy = getAllActionAutonomy(agentConfig);

  const rows = (Object.entries(ACTION_LABELS) as [ActionName, string][])
    .map(([action, label]) => {
      const level = autonomy[action];
      return `| ${label} | ${formatLevel(level)} |`;
    })
    .join("\n");

  return `## Action Permissions
| Action | Level |
|--------|-------|
${rows}

Rules:
- AUTO: Execute immediately without asking
- AUTO-DRAFT: Draft and save, but show for review before executing
- APPROVAL-REQUIRED: Create approval request, wait for human approval
- ALWAYS-MANUAL: Do not perform this action; explain it requires manual execution`;
}

function formatLevel(level: ActionAutonomyLevel): string {
  return level;
}

function isValidLevel(level: string): level is ActionAutonomyLevel {
  return ["AUTO", "AUTO-DRAFT", "APPROVAL-REQUIRED", "ALWAYS-MANUAL"].includes(
    level
  );
}
