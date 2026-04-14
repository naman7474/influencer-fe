import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import {
  extractHighlights,
  indexHighlights,
  findHighlightByHandle,
  type Highlight,
} from "../highlights";

/* ── Helpers ──────────────────────────────────────────────── */

/**
 * Build a minimal UIMessage with tool parts using the Vercel AI SDK v6
 * shape: type = "tool-<name>", state = "output-available", output = {...}
 */
function makeToolMessage(
  tools: Array<{
    toolCallId: string;
    toolName: string;
    output: Record<string, unknown>;
    state?: string;
  }>
): UIMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "",
    parts: tools.map((t) => ({
      type: `tool-${t.toolName}`,
      toolCallId: t.toolCallId,
      toolName: t.toolName,
      state: t.state ?? "output-available",
      output: t.output,
    })) as never,
  };
}

/** Shortcut: single-tool message. */
function singleTool(
  toolName: string,
  output: Record<string, unknown>,
  state?: string
): UIMessage[] {
  return [
    makeToolMessage([
      { toolCallId: "tc-1", toolName, output, state },
    ]),
  ];
}

/* ── extractHighlights — tool → kind mapping ─────────────── */

describe("extractHighlights", () => {
  it("returns empty array for no messages", () => {
    expect(extractHighlights([])).toEqual([]);
  });

  it("ignores user messages", () => {
    const msgs: UIMessage[] = [
      { id: "u1", role: "user", content: "hi", parts: [] },
    ];
    expect(extractHighlights(msgs)).toEqual([]);
  });

  it("ignores in-flight tool calls (input-streaming)", () => {
    const result = extractHighlights(
      singleTool("creator_search", { results: [] }, "input-streaming")
    );
    expect(result).toHaveLength(0);
  });

  it("ignores in-flight tool calls (input-available)", () => {
    const result = extractHighlights(
      singleTool("creator_search", { results: [] }, "input-available")
    );
    expect(result).toHaveLength(0);
  });

  it("extracts creator_search → creators_found", () => {
    const output = {
      results: [
        { id: "c1", handle: "fit_priya", followers: 38000, tier: "micro" },
        { id: "c2", handle: "yoga_dude", followers: 12000, tier: "nano" },
      ],
      count: 2,
      total_in_database: 50,
    };
    const highlights = extractHighlights(singleTool("creator_search", output));
    expect(highlights).toHaveLength(1);
    expect(highlights[0].kind).toBe("creators_found");
    expect(highlights[0].title).toBe("Found 2 creators");
    expect(highlights[0].subtitle).toBe("50 total");
    expect(highlights[0].toolName).toBe("creator_search");
    expect(highlights[0].handles).toContain("fit_priya");
    expect(highlights[0].handles).toContain("yoga_dude");
  });

  it("extracts lookalike_finder → creators_found", () => {
    const output = { results: [{ handle: "neo" }], count: 1 };
    const h = extractHighlights(singleTool("lookalike_finder", output));
    expect(h[0].kind).toBe("creators_found");
    expect(h[0].title).toBe("Found 1 similar creators");
  });

  it("extracts get_creator_details → creator_profile", () => {
    const output = {
      creator: {
        handle: "neeshicorner",
        display_name: "Neeshi",
        niche: "beauty",
      },
    };
    const h = extractHighlights(singleTool("get_creator_details", output));
    expect(h[0].kind).toBe("creator_profile");
    expect(h[0].title).toBe("@neeshicorner");
    expect(h[0].subtitle).toBe("Neeshi");
  });

  it("extracts campaign_builder → campaign_created", () => {
    const output = { name: "Summer Drop", status: "draft" };
    const h = extractHighlights(singleTool("campaign_builder", output));
    expect(h[0].kind).toBe("campaign_created");
    expect(h[0].title).toContain("Summer Drop");
  });

  it("extracts outreach_drafter → outreach_drafted (success)", () => {
    const output = {
      draft_id: "msg-123",
      creator_handle: "fit_priya",
      creator_email: "priya@email.com",
      subject: "Collab opportunity",
      body: "Hi Priya, we love your content...",
    };
    const h = extractHighlights(singleTool("outreach_drafter", output));
    expect(h).toHaveLength(1);
    expect(h[0].kind).toBe("outreach_drafted");
    expect(h[0].title).toBe("Outreach drafted for @fit_priya");
    expect(h[0].subtitle).toBe("Collab opportunity");
    expect(h[0].toolOutput.draft_id).toBe("msg-123");
  });

  it("extracts outreach_drafter → outreach_drafted (error)", () => {
    const output = { error: "Creator not found" };
    const h = extractHighlights(singleTool("outreach_drafter", output));
    expect(h).toHaveLength(1);
    expect(h[0].kind).toBe("outreach_drafted");
    expect(h[0].title).toBe("Outreach draft ready");
    // toolOutput carries the error string for the card to display
    expect(h[0].toolOutput.error).toBe("Creator not found");
  });

  it("extracts propose_outreach → approval_pending (via status:pending)", () => {
    const output = {
      approval_id: "ap-1",
      status: "pending",
      message: "Outreach to @fit_priya submitted for approval",
      creator_handle: "fit_priya",
      subject: "Collab",
    };
    const h = extractHighlights(singleTool("propose_outreach", output));
    expect(h).toHaveLength(1);
    expect(h[0].kind).toBe("approval_pending");
    expect(h[0].toolOutput.approval_id).toBe("ap-1");
  });

  it("extracts rate_benchmarker → rate_benchmark", () => {
    const output = { tier: "micro", market_rate: { min: 5000, median: 12000, max: 25000 } };
    const h = extractHighlights(singleTool("rate_benchmarker", output));
    expect(h[0].kind).toBe("rate_benchmark");
    expect(h[0].title).toContain("micro");
  });

  it("extracts roi_calculator → roi", () => {
    const output = { campaign: "Summer", kpis: { roi: 3.2 } };
    const h = extractHighlights(singleTool("roi_calculator", output));
    expect(h[0].kind).toBe("roi");
    expect(h[0].subtitle).toBe("3.2x");
  });

  it("extracts brief_generator → brief_generated", () => {
    const output = { title: "Summer Brief", brief: "Create a reel..." };
    const h = extractHighlights(singleTool("brief_generator", output));
    expect(h[0].kind).toBe("brief_generated");
    expect(h[0].subtitle).toBe("Summer Brief");
  });

  it("falls back to generic for unknown tools", () => {
    const output = { message: "Done" };
    const h = extractHighlights(singleTool("utm_generator", output));
    expect(h[0].kind).toBe("generic");
    expect(h[0].title).toBe("utm generator");
  });

  it("returns newest-first ordering", () => {
    const msgs: UIMessage[] = [
      makeToolMessage([
        {
          toolCallId: "tc-1",
          toolName: "creator_search",
          output: { results: [], count: 0 },
        },
        {
          toolCallId: "tc-2",
          toolName: "outreach_drafter",
          output: { draft_id: "d1", subject: "Hi" },
        },
      ]),
    ];
    const h = extractHighlights(msgs);
    expect(h).toHaveLength(2);
    // Newest first = last tool call is at index 0
    expect(h[0].toolName).toBe("outreach_drafter");
    expect(h[1].toolName).toBe("creator_search");
  });

  it("supports legacy state 'result' for backward compat", () => {
    const h = extractHighlights(
      singleTool("creator_search", { results: [], count: 0 }, "result")
    );
    expect(h).toHaveLength(1);
  });

  it("supports legacy state 'output' for backward compat", () => {
    const h = extractHighlights(
      singleTool("creator_search", { results: [], count: 0 }, "output")
    );
    expect(h).toHaveLength(1);
  });

  it("overrides kind to approval_pending when any tool returns pending+approval_id", () => {
    // campaign_builder that's wrapped in approval
    const output = {
      approval_id: "ap-x",
      status: "pending",
      message: "Campaign creation needs approval",
    };
    const h = extractHighlights(singleTool("campaign_builder", output));
    expect(h[0].kind).toBe("approval_pending");
  });
});

/* ── indexHighlights ─────────────────────────────────────── */

describe("indexHighlights", () => {
  it("creates id → highlight map", () => {
    const highlights: Highlight[] = [
      {
        id: "tc-1",
        kind: "creators_found",
        title: "Found 5 creators",
        handles: [],
        timestamp: 0,
        toolName: "creator_search",
        toolOutput: {},
      },
    ];
    const idx = indexHighlights(highlights);
    expect(idx.get("tc-1")).toBe(highlights[0]);
    expect(idx.get("nonexistent")).toBeUndefined();
  });
});

/* ── findHighlightByHandle ───────────────────────────────── */

describe("findHighlightByHandle", () => {
  const highlights: Highlight[] = [
    {
      id: "tc-1",
      kind: "creators_found",
      title: "Found 2",
      handles: ["fit_priya", "yoga_dude"],
      timestamp: 1,
      toolName: "creator_search",
      toolOutput: {},
    },
    {
      id: "tc-2",
      kind: "creator_profile",
      title: "@neeshicorner",
      handles: ["neeshicorner"],
      timestamp: 0,
      toolName: "get_creator_details",
      toolOutput: {},
    },
  ];

  it("finds by exact handle (case-insensitive)", () => {
    expect(findHighlightByHandle(highlights, "Fit_Priya")?.id).toBe("tc-1");
  });

  it("finds by lowercase", () => {
    expect(findHighlightByHandle(highlights, "neeshicorner")?.id).toBe("tc-2");
  });

  it("returns null when not found", () => {
    expect(findHighlightByHandle(highlights, "unknown")).toBeNull();
  });

  it("returns first match (list order)", () => {
    // Both tc-1 and tc-2 don't share handles so each returns unique match
    expect(findHighlightByHandle(highlights, "yoga_dude")?.id).toBe("tc-1");
  });
});

/* ── collectHandles (tested indirectly) ──────────────────── */

describe("handle collection from tool output", () => {
  it("extracts handles from nested results array", () => {
    const output = {
      results: [
        { id: "1", handle: "alpha" },
        { id: "2", handle: "beta" },
      ],
    };
    const h = extractHighlights(singleTool("creator_search", output));
    expect(h[0].handles).toEqual(expect.arrayContaining(["alpha", "beta"]));
  });

  it("extracts handle from creator object", () => {
    const output = { creator: { handle: "deep_nested" } };
    const h = extractHighlights(singleTool("get_creator_details", output));
    expect(h[0].handles).toContain("deep_nested");
  });

  it("ignores non-handle keys", () => {
    const output = { name: "not_a_handle", display_name: "also_not" };
    const h = extractHighlights(singleTool("brief_generator", output));
    expect(h[0].handles).toEqual([]);
  });
});
