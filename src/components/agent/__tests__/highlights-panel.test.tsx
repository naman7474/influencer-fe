import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HighlightsPanel } from "../highlights-panel";
import type { Highlight } from "@/lib/agent/highlights";

/**
 * Wraps HighlightsPanel in a minimal HighlightFocusProvider.
 * We import the real provider so context works correctly.
 */
import { HighlightFocusProvider } from "../highlight-focus-context";

function renderPanel(highlights: Highlight[]) {
  return render(
    <HighlightFocusProvider>
      <HighlightsPanel highlights={highlights} />
    </HighlightFocusProvider>
  );
}

function makeHighlight(overrides: Partial<Highlight>): Highlight {
  return {
    id: "tc-1",
    kind: "generic",
    title: "Test highlight",
    handles: [],
    timestamp: 0,
    toolName: "test_tool",
    toolOutput: {},
    ...overrides,
  };
}

/* ── Empty state ─────────────────────────────────────────── */

describe("HighlightsPanel — empty state", () => {
  it("shows empty message when no highlights", () => {
    renderPanel([]);
    expect(screen.getByText("No actions yet")).toBeInTheDocument();
  });
});

/* ── Outreach drafted — success ──────────────────────────── */

describe("HighlightsPanel — outreach_drafted (success)", () => {
  it("renders the outreach draft with approve & send button", () => {
    renderPanel([
      makeHighlight({
        kind: "outreach_drafted",
        title: "Outreach drafted for @fit_priya",
        subtitle: "Collab opportunity",
        toolName: "outreach_drafter",
        toolOutput: {
          draft_id: "msg-123",
          creator_handle: "fit_priya",
          creator_email: "priya@email.com",
          subject: "Collab opportunity",
          body: "Hi Priya, we love your content and think you'd be a great fit.",
        },
      }),
    ]);
    // The Approve & Send button should be present
    expect(screen.getByText(/Approve & Send/)).toBeInTheDocument();
    // The View in Outreach link should be present
    expect(screen.getByText(/View in Outreach/)).toBeInTheDocument();
    // Creator handle should appear
    expect(screen.getByText("@fit_priya")).toBeInTheDocument();
    // Email body preview should appear
    expect(screen.getByText(/we love your content/)).toBeInTheDocument();
  });
});

/* ── Outreach drafted — error (the bug!) ─────────────────── */

describe("HighlightsPanel — outreach_drafted (error)", () => {
  it("renders error message when tool returns error", () => {
    renderPanel([
      makeHighlight({
        kind: "outreach_drafted",
        title: "Outreach draft ready",
        toolName: "outreach_drafter",
        toolOutput: {
          error: "Creator @fit_priya does not have a contact email on file.",
        },
      }),
    ]);
    // Should display the error — previously this rendered nothing!
    expect(
      screen.getByText(/does not have a contact email/)
    ).toBeInTheDocument();
    // Should show a "failed" label
    expect(screen.getByText(/outreach drafter failed/)).toBeInTheDocument();
  });

  it("renders error for Gmail not connected", () => {
    renderPanel([
      makeHighlight({
        kind: "outreach_drafted",
        title: "Outreach draft ready",
        toolName: "outreach_drafter",
        toolOutput: {
          error:
            "Gmail is not connected. Please connect Gmail in Settings → Integrations before sending outreach.",
        },
      }),
    ]);
    expect(screen.getByText(/Gmail is not connected/)).toBeInTheDocument();
  });
});

/* ── creators_found — error ──────────────────────────────── */

describe("HighlightsPanel — creators_found (error)", () => {
  it("renders error message when creator_search fails", () => {
    renderPanel([
      makeHighlight({
        kind: "creators_found",
        title: "Found 0 creators",
        toolName: "creator_search",
        toolOutput: {
          error: "Database connection timeout",
        },
      }),
    ]);
    expect(
      screen.getByText(/Database connection timeout/)
    ).toBeInTheDocument();
    expect(screen.getByText(/creator search failed/)).toBeInTheDocument();
  });
});

/* ── approval_pending — renders approve button ──────────── */

describe("HighlightsPanel — approval_pending", () => {
  it("renders Approve button and View in Approvals link", () => {
    renderPanel([
      makeHighlight({
        kind: "approval_pending",
        title: "Awaiting approval",
        toolName: "propose_outreach",
        toolOutput: {
          approval_id: "ap-123",
          status: "pending",
          message: "Outreach to @fit_priya submitted",
          action_type: "send_outreach",
        },
      }),
    ]);
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("View in Approvals")).toBeInTheDocument();
  });
});

/* ── rate_benchmark — error ──────────────────────────────── */

describe("HighlightsPanel — rate_benchmark (error)", () => {
  it("renders error when rate_benchmarker fails", () => {
    renderPanel([
      makeHighlight({
        kind: "rate_benchmark",
        title: "Rate benchmark",
        toolName: "rate_benchmarker",
        toolOutput: {
          error: "No data available for this tier",
        },
      }),
    ]);
    expect(
      screen.getByText(/No data available/)
    ).toBeInTheDocument();
  });
});

/* ── Generic tool — message field ────────────────────────── */

describe("HighlightsPanel — generic with message", () => {
  it("renders message in generic fallback", () => {
    renderPanel([
      makeHighlight({
        kind: "generic",
        title: "utm generator",
        toolName: "utm_generator",
        toolOutput: {
          message: "UTM link generated successfully",
        },
      }),
    ]);
    expect(
      screen.getByText("UTM link generated successfully")
    ).toBeInTheDocument();
  });
});

/* ── Generic tool — error field ──────────────────────────── */

describe("HighlightsPanel — generic with error", () => {
  it("renders error in generic fallback", () => {
    renderPanel([
      makeHighlight({
        kind: "generic",
        title: "utm generator",
        toolName: "utm_generator",
        toolOutput: {
          error: "Missing campaign_id parameter",
        },
      }),
    ]);
    expect(
      screen.getByText(/Missing campaign_id parameter/)
    ).toBeInTheDocument();
  });
});

/* ── campaign_created — renders without error ────────────── */

describe("HighlightsPanel — campaign_created (success)", () => {
  it("renders campaign name and status", () => {
    renderPanel([
      makeHighlight({
        kind: "campaign_created",
        title: "Campaign drafted: Summer Drop",
        toolName: "campaign_builder",
        toolOutput: {
          name: "Summer Drop",
          status: "draft",
          goal: "Boost summer awareness",
          total_budget: 100000,
        },
      }),
    ]);
    expect(screen.getByText("Summer Drop")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });
});

/* ── Multiple highlights in order ────────────────────────── */

describe("HighlightsPanel — ordering", () => {
  it("renders multiple highlights", () => {
    renderPanel([
      makeHighlight({
        id: "tc-1",
        kind: "creators_found",
        title: "Found 5 creators",
        toolName: "creator_search",
        toolOutput: {
          results: [
            { id: "c1", handle: "alpha", followers: 10000, tier: "micro" },
          ],
          count: 5,
        },
      }),
      makeHighlight({
        id: "tc-2",
        kind: "outreach_drafted",
        title: "Outreach drafted for @alpha",
        toolName: "outreach_drafter",
        toolOutput: {
          draft_id: "d-1",
          creator_handle: "alpha",
          subject: "Hey",
          body: "Hello there",
        },
      }),
    ]);
    expect(screen.getAllByText(/Found 5 creators/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Outreach drafted for @alpha")).toBeInTheDocument();
  });
});
