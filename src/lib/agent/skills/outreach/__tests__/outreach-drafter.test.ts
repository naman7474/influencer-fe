import { describe, it, expect, vi } from "vitest";
import { outreachDrafterTool } from "../outreach-drafter";

/* ── Supabase mock helpers (same pattern as discovery tests) ── */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(
  data: MockRow[] | null = [],
  error: unknown = null
) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike",
    "or", "order", "limit",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => {
    isSingle = true;
    return builder;
  });
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.then = (resolve: (v: unknown) => void) => {
    if (isSingle) {
      const singleData =
        Array.isArray(data) && data.length > 0 ? data[0] : null;
      resolve({ data: singleData, error });
    } else {
      resolve({ data, error });
    }
  };
  return builder;
}

const toolCtx = {
  toolCallId: "tc-1",
  messages: [],
  abortSignal: undefined as never,
};

/* ── Test data ─────────────────────────────────────────────── */

const creatorLb = {
  creator_id: "creator-1",
  handle: "fit_priya",
  followers: 38000,
  tier: "micro",
  cpi: 85,
  avg_engagement_rate: 5.1,
  primary_niche: "fitness",
  city: "Mumbai",
  country: "India",
};

const creatorFull = {
  contact_email: "priya@email.com",
  display_name: "Priya Sharma",
  biography: "Fitness enthusiast",
};

const brand = {
  id: "brand-1",
  brand_name: "FitBar",
  industry: "health food",
  website: "https://fitbar.in",
  gmail_connected: true,
  gmail_email: "naman@fitbar.in",
  email_sender_name: "Naman",
  product_categories: ["protein bars"],
  competitor_brands: ["Yoga Bar"],
};

const campaign = {
  id: "campaign-1",
  name: "Summer Drop",
  description: "Summer campaign",
  content_format: "reels",
  budget_per_creator: 15000,
  end_date: "2026-07-15",
};

/* ── Tests ──────────────────────────────────────────────────── */

describe("outreach_drafter", () => {
  it("returns error when creator not found in leaderboard", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder(null)),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "nonexistent" },
      toolCtx
    );
    expect(result).toHaveProperty("error", "Creator not found");
  });

  it("returns error when creator has no contact email", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return mockQueryBuilder([creatorLb]); // mv_creator_leaderboard
        if (callCount === 2)
          return mockQueryBuilder([
            { contact_email: null, display_name: "Priya", biography: "" },
          ]); // creators
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1" },
      toolCtx
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain(
      "does not have a contact email"
    );
  });

  it("returns error when Gmail is not connected", async () => {
    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) return mockQueryBuilder([creatorLb]);
        if (callCount === 2) return mockQueryBuilder([creatorFull]);
        if (callCount === 3)
          return mockQueryBuilder([{ ...brand, gmail_connected: false, gmail_email: null }]);
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1" },
      toolCtx
    );
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Gmail is not connected");
  });

  it("uses null campaign_id when campaign not found (FK safety)", async () => {
    // This is the bug: agent passes a campaign_id that doesn't exist,
    // the tool should fall back to null instead of inserting the bad id.
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: { id: "draft-1" }, error: null }),
        }),
      }),
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        // 1. mv_creator_leaderboard
        if (callCount === 1) return mockQueryBuilder([creatorLb]);
        // 2. creators
        if (callCount === 2) return mockQueryBuilder([creatorFull]);
        // 3. brands
        if (callCount === 3) return mockQueryBuilder([brand]);
        // 4. campaigns — NOT FOUND (bad campaign_id)
        if (callCount === 4 && table === "campaigns")
          return mockQueryBuilder(null);
        // 5. caption_intelligence
        if (callCount === 5) return mockQueryBuilder(null);
        // 6. posts
        if (callCount === 6) return mockQueryBuilder([]);
        // 7. outreach_templates
        if (callCount === 7) return mockQueryBuilder(null);
        // 8. outreach_messages INSERT
        if (table === "outreach_messages") {
          return { insert: insertSpy };
        }
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1", campaign_id: "nonexistent-campaign" },
      toolCtx
    );

    // Should succeed, not throw FK error
    expect(result).toHaveProperty("draft_id", "draft-1");

    // The insert should have been called with campaign_id: null
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const insertedRow = insertSpy.mock.calls[0][0];
    expect(insertedRow.campaign_id).toBeNull();
  });

  it("uses valid campaign_id when campaign exists", async () => {
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: { id: "draft-2" }, error: null }),
        }),
      }),
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1) return mockQueryBuilder([creatorLb]);
        if (callCount === 2) return mockQueryBuilder([creatorFull]);
        if (callCount === 3) return mockQueryBuilder([brand]);
        // Campaign exists
        if (callCount === 4 && table === "campaigns")
          return mockQueryBuilder([campaign]);
        if (callCount === 5) return mockQueryBuilder(null);
        if (callCount === 6) return mockQueryBuilder([]);
        if (callCount === 7) return mockQueryBuilder(null);
        if (table === "outreach_messages") {
          return { insert: insertSpy };
        }
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1", campaign_id: "campaign-1" },
      toolCtx
    );

    expect(result).toHaveProperty("draft_id", "draft-2");
    const insertedRow = insertSpy.mock.calls[0][0];
    expect(insertedRow.campaign_id).toBe("campaign-1");
  });

  it("uses fallback template when no template_id or default found", async () => {
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: { id: "draft-3" }, error: null }),
        }),
      }),
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1) return mockQueryBuilder([creatorLb]);
        if (callCount === 2) return mockQueryBuilder([creatorFull]);
        if (callCount === 3) return mockQueryBuilder([brand]);
        if (callCount === 4) return mockQueryBuilder(null); // caption_intelligence
        if (callCount === 5) return mockQueryBuilder([]); // posts
        if (callCount === 6) return mockQueryBuilder(null); // outreach_templates — no default
        if (table === "outreach_messages") {
          return { insert: insertSpy };
        }
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1" },
      toolCtx
    );

    const res = result as Record<string, unknown>;
    expect(res.draft_id).toBe("draft-3");
    expect(res.template_used).toBe("auto-generated");
    // Should contain subject with brand name and handle
    expect(res.subject).toContain("FitBar");
    expect(res.subject).toContain("fit_priya");
    // Body should contain creator first name
    expect(res.body).toContain("Priya");
    // Without campaign, uses generic message
    expect(res.body).toContain("your content would resonate");
  });

  it("uses template when template_id is provided", async () => {
    const templateRow = {
      id: "tmpl-1",
      name: "Custom Template",
      subject: "Hey {{creator_first_name}} — collab with {{brand_name}}?",
      body: "Hi {{creator_first_name}},\n\nWe love your {{creator_niche}} content!",
    };

    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: { id: "draft-4" }, error: null }),
        }),
      }),
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1) return mockQueryBuilder([creatorLb]);
        if (callCount === 2) return mockQueryBuilder([creatorFull]);
        if (callCount === 3) return mockQueryBuilder([brand]);
        if (callCount === 4) return mockQueryBuilder(null); // caption_intelligence
        if (callCount === 5) return mockQueryBuilder([]); // posts
        if (callCount === 6 && table === "outreach_templates")
          return mockQueryBuilder([templateRow]);
        if (table === "outreach_messages") {
          return { insert: insertSpy };
        }
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1", template_id: "tmpl-1" },
      toolCtx
    );

    const res = result as Record<string, unknown>;
    expect(res.draft_id).toBe("draft-4");
    expect(res.template_used).toBe("Custom Template");
  });

  it("returns error when draft insert fails", async () => {
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: { message: "FK constraint violated" } }),
        }),
      }),
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1) return mockQueryBuilder([creatorLb]);
        if (callCount === 2) return mockQueryBuilder([creatorFull]);
        if (callCount === 3) return mockQueryBuilder([brand]);
        if (callCount === 4) return mockQueryBuilder(null);
        if (callCount === 5) return mockQueryBuilder([]);
        if (callCount === 6) return mockQueryBuilder(null);
        if (table === "outreach_messages") {
          return { insert: insertSpy };
        }
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1" },
      toolCtx
    );

    const res = result as { error: string };
    expect(res.error).toContain("Failed to save draft");
    expect(res.error).toContain("FK constraint violated");
  });

  it("includes campaign name in fallback body when campaign exists", async () => {
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: { id: "draft-5" }, error: null }),
        }),
      }),
    });

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1) return mockQueryBuilder([creatorLb]);
        if (callCount === 2) return mockQueryBuilder([creatorFull]);
        if (callCount === 3) return mockQueryBuilder([brand]);
        if (callCount === 4 && table === "campaigns") return mockQueryBuilder([campaign]);
        if (callCount === 5) return mockQueryBuilder(null);
        if (callCount === 6) return mockQueryBuilder([]);
        if (callCount === 7) return mockQueryBuilder(null); // no template
        if (table === "outreach_messages") {
          return { insert: insertSpy };
        }
        return mockQueryBuilder([]);
      }),
    } as never;

    const tool = outreachDrafterTool("brand-1", supabase);
    const result = await tool.execute(
      { creator_id: "creator-1", campaign_id: "campaign-1" },
      toolCtx
    );

    const res = result as Record<string, unknown>;
    expect(res.body).toContain("Summer Drop");
  });
});
