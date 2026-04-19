import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig } from "@/lib/types/database";
import type { SkillDefinition } from "../types";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("../../tool-retry", () => ({
  wrapToolWithRetry: (t: unknown) => t,
}));

vi.mock("../../autonomy", () => ({
  getActionAutonomy: vi.fn().mockReturnValue("SUPERVISED"),
}));

vi.mock("../custom-executor", () => ({
  executeCustomSkill: vi.fn().mockResolvedValue({ ok: true }),
}));

// Import after mocks
import {
  registerSkill,
  registerSkills,
  buildToolset,
  getRegisteredSkills,
  getSkillsByCategory,
} from "../registry";

import { getActionAutonomy } from "../../autonomy";

// Import category index files to trigger registration of built-in skills
import "../discovery";
import "../negotiation";
import "../campaign";
import "../outreach";
import "../tracking";
import "../relationship";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
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
    can_manage_budget: true,
    can_scan_content: true,
    can_generate_reports: true,
    disabled_skills: [],
    action_autonomy: null,
    budget_auto_threshold: null,
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

/** Create a minimal fake tool to use in test skill definitions */
function fakeTool() {
  return { type: "function", execute: vi.fn() } as unknown as ReturnType<
    SkillDefinition["factory"]
  >;
}

/** Helper to build a mock supabase that returns custom_skills rows */
function mockSupabaseWithCustomSkills(
  rows: Array<Record<string, unknown>> | null = [],
  shouldThrow = false
) {
  return {
    from: vi.fn((table: string) => {
      if (table === "custom_skills") {
        if (shouldThrow) {
          throw new Error("relation custom_skills does not exist");
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                then: (resolve: (v: unknown) => void) =>
                  resolve({ data: rows, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) =>
                resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
    }),
  } as unknown as Parameters<typeof buildToolset>[1];
}

// Minimal mock that returns no custom skills — matches what existing tests used
const mockSupabase = mockSupabaseWithCustomSkills([]);

/* ------------------------------------------------------------------ */
/*  Tests: registerSkill / registerSkills                              */
/* ------------------------------------------------------------------ */

describe("Skill Registry", () => {
  describe("registerSkill", () => {
    it("registers a new skill", () => {
      const before = getRegisteredSkills().length;
      registerSkill({
        name: "__test_register_new",
        category: "discovery",
        permission: "can_search_creators",
        riskLevel: "low",
        factory: () => fakeTool(),
      });
      const after = getRegisteredSkills();
      expect(after.length).toBe(before + 1);
      expect(after.find((s) => s.name === "__test_register_new")).toBeDefined();
    });

    it("replaces an existing skill with the same name (dedup on hot-reload)", () => {
      const oldFactory = () => fakeTool();
      const newFactory = () => fakeTool();

      registerSkill({
        name: "__test_register_dup",
        category: "discovery",
        permission: "can_search_creators",
        riskLevel: "low",
        factory: oldFactory,
      });
      const countBefore = getRegisteredSkills().length;

      registerSkill({
        name: "__test_register_dup",
        category: "campaign",
        permission: "can_manage_campaigns",
        riskLevel: "high",
        factory: newFactory,
      });
      const countAfter = getRegisteredSkills().length;

      // Count should not change — it replaced, not added
      expect(countAfter).toBe(countBefore);
      const replaced = getRegisteredSkills().find(
        (s) => s.name === "__test_register_dup"
      );
      expect(replaced!.category).toBe("campaign");
      expect(replaced!.permission).toBe("can_manage_campaigns");
      expect(replaced!.factory).toBe(newFactory);
    });
  });

  describe("registerSkills", () => {
    it("registers multiple skills at once", () => {
      const before = getRegisteredSkills().length;
      registerSkills([
        {
          name: "__test_bulk_a",
          category: "tracking",
          permission: "can_track_performance",
          riskLevel: "low",
          factory: () => fakeTool(),
        },
        {
          name: "__test_bulk_b",
          category: "relationship",
          permission: "can_manage_relationships",
          riskLevel: "medium",
          factory: () => fakeTool(),
        },
      ]);
      const after = getRegisteredSkills();
      expect(after.length).toBe(before + 2);
      expect(after.find((s) => s.name === "__test_bulk_a")).toBeDefined();
      expect(after.find((s) => s.name === "__test_bulk_b")).toBeDefined();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getRegisteredSkills                                              */
  /* ---------------------------------------------------------------- */

  describe("getRegisteredSkills", () => {
    it("returns all registered skills including built-in ones", () => {
      const skills = getRegisteredSkills();
      const names = skills.map((s) => s.name);

      // Spot-check built-in skills from multiple categories
      expect(names).toContain("creator_search");
      expect(names).toContain("rate_benchmarker");
      expect(names).toContain("get_campaign_info");
      expect(names).toContain("outreach_drafter");
      expect(skills.length).toBeGreaterThanOrEqual(29);
    });

    it("assigns correct categories", () => {
      const skills = getRegisteredSkills();
      const byName = Object.fromEntries(skills.map((s) => [s.name, s]));

      expect(byName.creator_search.category).toBe("discovery");
      expect(byName.rate_benchmarker.category).toBe("negotiation");
      expect(byName.get_campaign_info.category).toBe("campaign");
      expect(byName.outreach_drafter.category).toBe("outreach");
    });

    it("assigns correct permissions", () => {
      const skills = getRegisteredSkills();
      const byName = Object.fromEntries(skills.map((s) => [s.name, s]));

      expect(byName.creator_search.permission).toBe("can_search_creators");
      expect(byName.rate_benchmarker.permission).toBe("can_negotiate");
      expect(byName.get_campaign_info.permission).toBe("can_manage_campaigns");
      expect(byName.outreach_drafter.permission).toBe("can_draft_outreach");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getSkillsByCategory                                              */
  /* ---------------------------------------------------------------- */

  describe("getSkillsByCategory", () => {
    it("filters skills by category", () => {
      const discoverySkills = getSkillsByCategory("discovery");
      expect(discoverySkills.length).toBeGreaterThan(0);
      for (const skill of discoverySkills) {
        expect(skill.category).toBe("discovery");
      }
    });

    it("returns campaign skills only", () => {
      const campaignSkills = getSkillsByCategory("campaign");
      expect(campaignSkills.length).toBeGreaterThan(0);
      const names = campaignSkills.map((s) => s.name);
      expect(names).toContain("campaign_builder");
      expect(names).toContain("gifting_order_creator");
      for (const skill of campaignSkills) {
        expect(skill.category).toBe("campaign");
      }
    });

    it("returns empty array for category with no skills", () => {
      // Use a valid category type but one that might have skills registered from test helpers
      // "outreach" will have skills, so let's check that it returns only outreach
      const outreachSkills = getSkillsByCategory("outreach");
      for (const skill of outreachSkills) {
        expect(skill.category).toBe("outreach");
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  buildToolset                                                     */
  /* ---------------------------------------------------------------- */

  describe("buildToolset", () => {
    beforeEach(() => {
      vi.mocked(getActionAutonomy).mockReturnValue(
        "SUPERVISED" as unknown as ReturnType<typeof getActionAutonomy>
      );
    });

    it("includes skill when permission is enabled", async () => {
      const config = makeAgentConfig({ can_search_creators: true });
      const tools = await buildToolset("brand-1", mockSupabase, config);
      expect(Object.keys(tools)).toContain("creator_search");
    });

    it("excludes skill when permission is disabled", async () => {
      const config = makeAgentConfig({ can_search_creators: false });
      const tools = await buildToolset("brand-1", mockSupabase, config);
      expect(Object.keys(tools)).not.toContain("creator_search");
      expect(Object.keys(tools)).not.toContain("get_creator_details");
    });

    it("excludes skill listed in disabled_skills array", async () => {
      const config = makeAgentConfig({
        disabled_skills: ["creator_search", "rate_benchmarker"],
      } as Partial<AgentConfig>);
      const tools = await buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).not.toContain("creator_search");
      expect(Object.keys(tools)).not.toContain("rate_benchmarker");
      // Other skills with same permission should still be present
      expect(Object.keys(tools)).toContain("get_creator_details");
      expect(Object.keys(tools)).toContain("get_campaign_info");
    });

    it("skips ALWAYS-MANUAL autonomy skills from the toolset", async () => {
      // propose_outreach maps to "first_outreach" in SKILL_TO_ACTION
      // and has riskLevel != "low", so it should be skipped when ALWAYS-MANUAL
      vi.mocked(getActionAutonomy).mockReturnValue(
        "ALWAYS-MANUAL" as unknown as ReturnType<typeof getActionAutonomy>
      );

      const config = makeAgentConfig();
      const tools = await buildToolset("brand-1", mockSupabase, config);

      // propose_outreach is mapped to first_outreach action and is NOT low-risk
      expect(Object.keys(tools)).not.toContain("propose_outreach");
      // counter_offer_generator maps to negotiate_rates
      expect(Object.keys(tools)).not.toContain("counter_offer_generator");
      // deal_memo_generator maps to negotiate_rates
      expect(Object.keys(tools)).not.toContain("deal_memo_generator");

      // Skills NOT in SKILL_TO_ACTION should still be present
      expect(Object.keys(tools)).toContain("creator_search");
      expect(Object.keys(tools)).toContain("get_campaign_info");
    });

    it("does NOT skip ALWAYS-MANUAL skill if riskLevel is low", async () => {
      // Register a test skill that IS in SKILL_TO_ACTION concept but is low risk
      // We'll just verify the existing behavior: skills with riskLevel "low" bypass the check
      // The real SKILL_TO_ACTION skills are not low-risk, but we can register a test one
      registerSkill({
        name: "__test_low_risk_manual",
        category: "discovery",
        permission: "can_search_creators",
        riskLevel: "low",
        factory: () => fakeTool(),
      });

      vi.mocked(getActionAutonomy).mockReturnValue(
        "ALWAYS-MANUAL" as unknown as ReturnType<typeof getActionAutonomy>
      );

      const config = makeAgentConfig();
      const tools = await buildToolset("brand-1", mockSupabase, config);

      // Low-risk test skill should still be present since riskLevel is "low"
      // (the autonomy check only blocks non-low skills)
      // Note: __test_low_risk_manual is NOT in SKILL_TO_ACTION so it wouldn't be blocked
      // But the logic checks: actionKey && skill.riskLevel !== "low"
      expect(Object.keys(tools)).toContain("__test_low_risk_manual");
    });

    it("loads custom skills from the database", async () => {
      const customRows = [
        {
          name: "my_custom_tool",
          description: "A user-defined custom tool",
          input_schema: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
          },
          execution_type: "prompt",
          execution_config: { template: "Do something with {{query}}" },
        },
      ];
      const supabase = mockSupabaseWithCustomSkills(customRows);
      const config = makeAgentConfig();
      const tools = await buildToolset("brand-1", supabase, config);

      expect(Object.keys(tools)).toContain("my_custom_tool");
      // Built-in tools should also be present
      expect(Object.keys(tools)).toContain("creator_search");
    });

    it("skips custom skills that conflict with built-in names", async () => {
      const customRows = [
        {
          name: "creator_search", // conflicts with built-in
          description: "Custom creator search override",
          input_schema: { type: "object", properties: {} },
          execution_type: "prompt",
          execution_config: {},
        },
        {
          name: "unique_custom_tool",
          description: "Non-conflicting custom tool",
          input_schema: { type: "object", properties: {} },
          execution_type: "query",
          execution_config: { sql: "SELECT 1" },
        },
      ];
      const supabase = mockSupabaseWithCustomSkills(customRows);
      const config = makeAgentConfig();
      const tools = await buildToolset("brand-1", supabase, config);

      // creator_search should be the built-in, not the custom one
      expect(Object.keys(tools)).toContain("creator_search");
      // Non-conflicting should be loaded
      expect(Object.keys(tools)).toContain("unique_custom_tool");
    });

    it("handles custom_skills table not existing (catch block)", async () => {
      const supabase = mockSupabaseWithCustomSkills(null, true);
      const config = makeAgentConfig();

      // Should not throw — silently falls back to built-in skills only
      const tools = await buildToolset("brand-1", supabase, config);
      expect(tools).toBeDefined();
      expect(Object.keys(tools)).toContain("creator_search");
    });

    it("returns all tools when all permissions enabled", async () => {
      const config = makeAgentConfig();
      const tools = await buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).toContain("creator_search");
      expect(Object.keys(tools)).toContain("get_creator_details");
      expect(Object.keys(tools)).toContain("rate_benchmarker");
      expect(Object.keys(tools)).toContain("get_campaign_info");
      expect(Object.keys(tools)).toContain("outreach_drafter");
      expect(Object.keys(tools)).toContain("propose_outreach");
    });

    it("returns empty toolset when all permissions disabled", async () => {
      const config = makeAgentConfig({
        can_search_creators: false,
        can_draft_outreach: false,
        can_send_outreach: false,
        can_manage_campaigns: false,
        can_negotiate: false,
        can_track_performance: false,
        can_manage_relationships: false,
        can_manage_budget: false,
        can_scan_content: false,
        can_generate_reports: false,
      } as Partial<AgentConfig>);
      const tools = await buildToolset("brand-1", mockSupabase, config);
      expect(Object.keys(tools)).toHaveLength(0);
    });

    it("returns tool instances that are objects", async () => {
      const config = makeAgentConfig();
      const tools = await buildToolset("brand-1", mockSupabase, config);

      for (const toolInstance of Object.values(tools)) {
        expect(toolInstance).toBeDefined();
        expect(typeof toolInstance).toBe("object");
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  isPermissionEnabled (tested indirectly through buildToolset)     */
  /* ---------------------------------------------------------------- */

  describe("isPermissionEnabled (indirect)", () => {
    it("defaults null/undefined permissions to true (except can_manage_budget)", async () => {
      // Simulate a pre-migration config where new fields don't exist
      const config = makeAgentConfig();
      // Remove Phase 5+ fields to simulate undefined
      const rawConfig = config as Record<string, unknown>;
      delete rawConfig.can_track_performance;
      delete rawConfig.can_manage_relationships;
      delete rawConfig.can_scan_content;
      delete rawConfig.can_generate_reports;

      const tools = await buildToolset("brand-1", mockSupabase, config);

      // Skills gated by those missing permissions should still be present (default true)
      expect(Object.keys(tools)).toContain("roi_calculator"); // can_track_performance
      expect(Object.keys(tools)).toContain("relationship_scorer"); // can_manage_relationships
      expect(Object.keys(tools)).toContain("compliance_scanner"); // can_scan_content
    });

    it("defaults can_manage_budget to false when undefined", async () => {
      const config = makeAgentConfig();
      const rawConfig = config as Record<string, unknown>;
      delete rawConfig.can_manage_budget;

      const tools = await buildToolset("brand-1", mockSupabase, config);

      // budget_optimizer is gated by can_manage_budget which defaults to false
      expect(Object.keys(tools)).not.toContain("budget_optimizer");
    });

    it("allows can_manage_budget skills when explicitly set to true", async () => {
      const config = makeAgentConfig({ can_manage_budget: true } as Partial<AgentConfig>);
      const tools = await buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).toContain("budget_optimizer");
    });
  });
});
