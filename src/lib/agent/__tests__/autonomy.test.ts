import { describe, it, expect } from "vitest";
import type { AgentConfig } from "@/lib/types/database";
import {
  getActionAutonomy,
  getAllActionAutonomy,
  formatAutonomyForPrompt,
} from "../autonomy";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    id: "config-1",
    brand_id: "brand-1",
    soul_md: null,
    brand_md: null,
    autonomy_level: "semi_auto",
    can_search_creators: true,
    can_draft_outreach: true,
    can_send_outreach: true,
    can_manage_campaigns: true,
    can_negotiate: true,
    can_track_performance: true,
    can_manage_relationships: true,
    can_manage_budget: false,
    can_scan_content: true,
    can_generate_reports: true,
    action_autonomy: null,
    budget_auto_threshold: 25000,
    model_provider: "anthropic",
    model_name: "claude-sonnet-4-20250514",
    temperature: 0.7,
    max_tokens: 4096,
    daily_message_limit: 200,
    messages_today: 0,
    limit_reset_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as AgentConfig;
}

/* ------------------------------------------------------------------ */
/*  getActionAutonomy tests                                            */
/* ------------------------------------------------------------------ */

describe("getActionAutonomy", () => {
  it("returns default when action_autonomy is null", () => {
    const config = makeConfig({ action_autonomy: null });
    expect(getActionAutonomy(config, "first_outreach")).toBe("APPROVAL-REQUIRED");
    expect(getActionAutonomy(config, "negotiate_rates")).toBe("ALWAYS-MANUAL");
    expect(getActionAutonomy(config, "content_revision")).toBe("AUTO-DRAFT");
  });

  it("reads from action_autonomy JSONB when set", () => {
    const config = makeConfig({
      action_autonomy: {
        first_outreach: "AUTO",
        follow_up_no_response: "AUTO",
        follow_up_after_response: "AUTO-DRAFT",
        negotiate_rates: "APPROVAL-REQUIRED",
        send_brief: "AUTO-DRAFT",
        content_revision: "AUTO",
        gifting_order: "APPROVAL-REQUIRED",
        budget_commit_above_threshold: "ALWAYS-MANUAL",
      },
    });

    expect(getActionAutonomy(config, "first_outreach")).toBe("AUTO");
    expect(getActionAutonomy(config, "negotiate_rates")).toBe("APPROVAL-REQUIRED");
    expect(getActionAutonomy(config, "content_revision")).toBe("AUTO");
  });

  it("falls back to default for missing keys in partial config", () => {
    const config = makeConfig({
      action_autonomy: {
        first_outreach: "AUTO",
        // other keys missing
      },
    });

    expect(getActionAutonomy(config, "first_outreach")).toBe("AUTO");
    expect(getActionAutonomy(config, "negotiate_rates")).toBe("ALWAYS-MANUAL");
  });

  it("falls back to default for invalid values", () => {
    const config = makeConfig({
      action_autonomy: {
        first_outreach: "INVALID_VALUE",
      },
    });

    expect(getActionAutonomy(config, "first_outreach")).toBe("APPROVAL-REQUIRED");
  });
});

/* ------------------------------------------------------------------ */
/*  getAllActionAutonomy tests                                          */
/* ------------------------------------------------------------------ */

describe("getAllActionAutonomy", () => {
  it("returns all defaults when action_autonomy is null", () => {
    const config = makeConfig({ action_autonomy: null });
    const all = getAllActionAutonomy(config);

    expect(all.first_outreach).toBe("APPROVAL-REQUIRED");
    expect(all.follow_up_no_response).toBe("APPROVAL-REQUIRED");
    expect(all.negotiate_rates).toBe("ALWAYS-MANUAL");
    expect(all.content_revision).toBe("AUTO-DRAFT");
    expect(all.budget_commit_above_threshold).toBe("ALWAYS-MANUAL");
  });

  it("merges config with defaults", () => {
    const config = makeConfig({
      action_autonomy: {
        first_outreach: "AUTO",
        content_revision: "AUTO",
      },
    });
    const all = getAllActionAutonomy(config);

    expect(all.first_outreach).toBe("AUTO");
    expect(all.content_revision).toBe("AUTO");
    // Unset keys fall back to defaults
    expect(all.negotiate_rates).toBe("ALWAYS-MANUAL");
    expect(all.gifting_order).toBe("APPROVAL-REQUIRED");
  });
});

/* ------------------------------------------------------------------ */
/*  formatAutonomyForPrompt tests                                      */
/* ------------------------------------------------------------------ */

describe("formatAutonomyForPrompt", () => {
  it("generates a markdown table with all actions", () => {
    const config = makeConfig({
      action_autonomy: {
        first_outreach: "AUTO-DRAFT",
        follow_up_no_response: "AUTO",
        follow_up_after_response: "AUTO-DRAFT",
        negotiate_rates: "APPROVAL-REQUIRED",
        send_brief: "AUTO-DRAFT",
        content_revision: "AUTO",
        gifting_order: "APPROVAL-REQUIRED",
        budget_commit_above_threshold: "ALWAYS-MANUAL",
      },
    });

    const result = formatAutonomyForPrompt(config);

    expect(result).toContain("## Action Permissions");
    expect(result).toContain("| First outreach email | AUTO-DRAFT |");
    expect(result).toContain("| Follow-up (no response) | AUTO |");
    expect(result).toContain("| Negotiate rates | APPROVAL-REQUIRED |");
    expect(result).toContain("| Commit budget above threshold | ALWAYS-MANUAL |");
  });

  it("includes the rules legend", () => {
    const config = makeConfig({ action_autonomy: {} });
    const result = formatAutonomyForPrompt(config);

    expect(result).toContain("AUTO: Execute immediately");
    expect(result).toContain("APPROVAL-REQUIRED:");
    expect(result).toContain("ALWAYS-MANUAL:");
  });
});
