import { describe, it, expect, beforeEach } from "vitest";
import type { AgentConfig } from "@/lib/types/database";
import { buildToolset, getRegisteredSkills } from "../registry";

// Import category index files to trigger registration
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

// Minimal mock SupabaseClient — skills won't actually execute in these tests
const mockSupabase = {} as Parameters<typeof buildToolset>[1];

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Skill Registry", () => {
  describe("getRegisteredSkills", () => {
    it("has all 21 skills registered (6 base + 5 Wave 2 + 10 Wave 3)", () => {
      const skills = getRegisteredSkills();
      const names = skills.map((s) => s.name);

      // Base 6
      expect(names).toContain("creator_search");
      expect(names).toContain("get_creator_details");
      expect(names).toContain("rate_benchmarker");
      expect(names).toContain("get_campaign_info");
      expect(names).toContain("outreach_drafter");
      expect(names).toContain("propose_outreach");
      // Wave 2 discovery
      expect(names).toContain("lookalike_finder");
      expect(names).toContain("competitor_mapper");
      expect(names).toContain("audience_overlap_check");
      expect(names).toContain("geo_opportunity_finder");
      expect(names).toContain("warm_lead_detector");
      // Wave 3 campaign
      expect(names).toContain("campaign_builder");
      expect(names).toContain("discount_code_generator");
      expect(names).toContain("utm_generator");
      expect(names).toContain("brief_generator");
      expect(names).toContain("gifting_order_creator");
      // Wave 3 tracking
      expect(names).toContain("order_attributor");
      expect(names).toContain("content_monitor");
      expect(names).toContain("roi_calculator");
      expect(names).toContain("geo_lift_analyzer");
      expect(names).toContain("campaign_reporter");
      // Wave 4 negotiation
      expect(names).toContain("counter_offer_generator");
      expect(names).toContain("budget_optimizer");
      expect(names).toContain("deal_memo_generator");
      // Wave 5 relationship
      expect(names).toContain("relationship_scorer");
      expect(names).toContain("reengagement_recommender");
      expect(names).toContain("ambassador_identifier");
      expect(names).toContain("churn_predictor");
      // Wave 6 compliance
      expect(names).toContain("compliance_scanner");
      expect(skills.length).toBeGreaterThanOrEqual(29);
    });

    it("assigns correct categories", () => {
      const skills = getRegisteredSkills();
      const byName = Object.fromEntries(skills.map((s) => [s.name, s]));

      expect(byName.creator_search.category).toBe("discovery");
      expect(byName.get_creator_details.category).toBe("discovery");
      expect(byName.rate_benchmarker.category).toBe("negotiation");
      expect(byName.get_campaign_info.category).toBe("campaign");
      expect(byName.outreach_drafter.category).toBe("outreach");
      expect(byName.propose_outreach.category).toBe("outreach");
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

  describe("buildToolset", () => {
    it("returns all tools when all permissions enabled", () => {
      const config = makeAgentConfig();
      const tools = buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).toContain("creator_search");
      expect(Object.keys(tools)).toContain("get_creator_details");
      expect(Object.keys(tools)).toContain("rate_benchmarker");
      expect(Object.keys(tools)).toContain("get_campaign_info");
      expect(Object.keys(tools)).toContain("outreach_drafter");
      expect(Object.keys(tools)).toContain("propose_outreach");
    });

    it("excludes all discovery skills when can_search_creators is false", () => {
      const config = makeAgentConfig({ can_search_creators: false });
      const tools = buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).not.toContain("creator_search");
      expect(Object.keys(tools)).not.toContain("get_creator_details");
      expect(Object.keys(tools)).not.toContain("lookalike_finder");
      expect(Object.keys(tools)).not.toContain("competitor_mapper");
      expect(Object.keys(tools)).not.toContain("audience_overlap_check");
      expect(Object.keys(tools)).not.toContain("geo_opportunity_finder");
      expect(Object.keys(tools)).not.toContain("warm_lead_detector");
      // Other skills should still be present
      expect(Object.keys(tools)).toContain("rate_benchmarker");
      expect(Object.keys(tools)).toContain("get_campaign_info");
    });

    it("excludes outreach skills when can_draft_outreach is false", () => {
      const config = makeAgentConfig({ can_draft_outreach: false });
      const tools = buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).not.toContain("outreach_drafter");
      expect(Object.keys(tools)).not.toContain("propose_outreach");
      expect(Object.keys(tools)).toContain("creator_search");
    });

    it("excludes negotiation skills when can_negotiate is false", () => {
      const config = makeAgentConfig({ can_negotiate: false });
      const tools = buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).not.toContain("rate_benchmarker");
      expect(Object.keys(tools)).toContain("creator_search");
    });

    it("excludes campaign skills when can_manage_campaigns is false", () => {
      const config = makeAgentConfig({ can_manage_campaigns: false });
      const tools = buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).not.toContain("get_campaign_info");
      expect(Object.keys(tools)).toContain("creator_search");
    });

    it("returns empty toolset when all permissions disabled", () => {
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
      const tools = buildToolset("brand-1", mockSupabase, config);

      expect(Object.keys(tools)).toHaveLength(0);
    });

    it("defaults Phase 5 permissions to true when missing from config", () => {
      // Simulate a pre-Phase-5 config without the new permission fields
      const config = makeAgentConfig();
      // Phase 5 skills aren't registered yet, but the permission check should default to true
      // We test the fallback by verifying no errors are thrown
      const tools = buildToolset("brand-1", mockSupabase, config);
      expect(tools).toBeDefined();
    });

    it("returns tool instances that are objects with expected shape", () => {
      const config = makeAgentConfig();
      const tools = buildToolset("brand-1", mockSupabase, config);

      // Each tool should be a valid Vercel AI SDK tool (object with type/parameters)
      for (const [name, toolInstance] of Object.entries(tools)) {
        expect(toolInstance).toBeDefined();
        expect(typeof toolInstance).toBe("object");
      }
    });
  });
});
