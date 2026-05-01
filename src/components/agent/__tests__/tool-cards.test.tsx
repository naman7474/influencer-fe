import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock the NegotiationCard dependency ────────────────────────────────
vi.mock("./negotiation-card", () => ({
  NegotiationCard: () => <div data-testid="negotiation-card" />,
}));

// Vitest resolves relative to the test file; re-map to the actual module path
vi.mock("../negotiation-card", () => ({
  NegotiationCard: () => <div data-testid="negotiation-card" />,
}));

// AddToCampaignDialog opens a Supabase-backed dialog; stub for tests.
vi.mock("@/components/creators/add-to-campaign-dialog", () => ({
  AddToCampaignDialog: () => null,
}));

// next/link renders children with an anchor — stub to a plain anchor.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(rest as object)}>
      {children}
    </a>
  ),
}));

import {
  ToolResultCard,
  CreatorSearchCard,
  OutreachDraftCard,
  ApprovalPendingCard,
  RateBenchmarkCard,
  BudgetCard,
  DealMemoCard,
  ROICard,
  CampaignOverviewCard,
  ContentTrackerCard,
} from "../tool-cards";

/* ================================================================== */
/*  Fixtures                                                           */
/* ================================================================== */

function makeTool(overrides: Record<string, unknown> = {}) {
  return {
    state: "result",
    toolName: "creator_search",
    output: null,
    result: null,
    ...overrides,
  };
}

// Brief shape produced by the new creator-search RPC + tool wrapper.
// Match scores in this shape are 0–1 decimals (per creator_brand_matches
// schema) — the UI multiplies by 100 for display.
const creatorSearchResult = {
  results: [
    {
      id: "c1",
      handle: "fit_priya",
      display_name: "Priya Sharma",
      platform: "instagram",
      avatar_url: null,
      followers: 45200,
      tier: "micro",
      is_verified: true,
      summary: "Fitness · English · India · 0.78 hook",
      why: "hook 78/100 · India audience",
      scores: {
        cpi: 82,
        er: 0.041,
        hook_quality: 0.78,
        audience_authenticity: 0.92,
        brand_match: 0.91,
      },
      hits: { tier: "micro" },
    },
    {
      id: "c2",
      handle: "foodie_raj",
      display_name: "Raj Kumar",
      platform: "youtube",
      avatar_url: null,
      followers: 120000,
      tier: "mid",
      is_verified: false,
      summary: "Food · Hindi · North India",
      why: "",
      scores: {
        cpi: null,
        er: 0.025,
        hook_quality: null,
        audience_authenticity: null,
        brand_match: 0.65,
      },
      hits: {},
    },
    {
      id: "c3",
      handle: "yoga_anita",
      display_name: "Anita Desai",
      platform: "instagram",
      avatar_url: null,
      followers: 8500,
      tier: "nano",
      is_verified: false,
      summary: "Wellness · English",
      why: "",
      scores: {
        cpi: 95,
        er: 0.058,
        hook_quality: null,
        audience_authenticity: null,
        brand_match: null,
      },
      hits: {},
    },
  ],
  count: 3,
  filters: {},
  total_in_database: 42,
};

const outreachDraftResult = {
  draft_id: "msg-abc",
  creator_email: "priya@example.com",
  subject: "Collab opportunity with BrandX",
  body: "Hi Priya, we love your fitness content and think you would be an amazing fit for our upcoming summer campaign. Let us know if you are interested in a collaboration.",
};

const rateBenchmarkResult = {
  tier: "micro",
  market_rate: {
    min: 5000,
    median: 12000,
    max: 25000,
  },
  brand_historical: {
    avg_rate_paid: 10500,
  },
};

const budgetResult = {
  campaign: "Summer Drop 2026",
  budget_summary: {
    total_budget: 500000,
    confirmed_spend: 150000,
    available_for_negotiation: 350000,
    budget_used_percent: 30,
  },
  warnings: ["Budget is 80% allocated", "2 deals pending approval"],
};

const dealMemoResult = {
  deal_memo: {
    creator: { handle: "fit_priya" },
    terms: {
      agreed_rate: 15000,
      usage_rights: "6 months",
      payment_terms: "Net 30",
    },
  },
};

const roiResult = {
  campaign: "Summer Drop 2026",
  kpis: {
    total_revenue: 2500000,
    total_spend: 500000,
    total_orders: 1250,
    roi: 5.0,
  },
};

function makeCampaigns(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `camp-${i + 1}`,
    name: `Campaign ${i + 1}`,
    status: i % 2 === 0 ? "active" : "draft",
    total_budget: (i + 1) * 100000,
  }));
}

function makePosts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    caption: `Post caption ${i + 1}`,
    url: `https://instagram.com/p/${i + 1}`,
    likes: (i + 1) * 100,
    comments: (i + 1) * 10,
  }));
}

/* ================================================================== */
/*  ToolResultCard — dispatcher                                        */
/* ================================================================== */

describe("ToolResultCard", () => {
  /* ── Null returns ─────────────────────────────────────────── */

  it("returns null when state is not 'result' or 'output'", () => {
    const { container } = render(
      <ToolResultCard tool={makeTool({ state: "pending" })} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when state is 'call'", () => {
    const { container } = render(
      <ToolResultCard tool={makeTool({ state: "call" })} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when result/output is null", () => {
    const { container } = render(
      <ToolResultCard tool={makeTool({ state: "result", output: null, result: null })} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when tool name doesn't match and result has no special fields", () => {
    const { container } = render(
      <ToolResultCard
        tool={makeTool({
          toolName: "unknown_tool",
          output: { some_data: 123 },
        })}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  /* ── state: 'output' also works ──────────────────────────── */

  it("works when state is 'output'", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          state: "output",
          toolName: "creator_search",
          output: creatorSearchResult,
        })}
      />
    );
    expect(screen.getByText("Found 3 creators")).toBeInTheDocument();
  });

  /* ── Uses tool.result when tool.output is absent ─────────── */

  it("falls back to tool.result when tool.output is undefined", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "creator_search",
          output: undefined,
          result: creatorSearchResult,
        })}
      />
    );
    expect(screen.getByText("Found 3 creators")).toBeInTheDocument();
  });

  /* ── name extraction from type field ─────────────────────── */

  it("extracts tool name from type field (tool-creator_search)", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: undefined,
          type: "tool-creator_search",
          output: creatorSearchResult,
        })}
      />
    );
    expect(screen.getByText("Found 3 creators")).toBeInTheDocument();
  });

  /* ── Dispatches to CreatorSearchCard ─────────────────────── */

  it("dispatches to CreatorSearchCard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "creator_search",
          output: creatorSearchResult,
        })}
      />
    );
    expect(screen.getByText("Found 3 creators")).toBeInTheDocument();
    expect(screen.getByText("42 matches in database")).toBeInTheDocument();
  });

  /* ── Dispatches to OutreachDraftCard ─────────────────────── */

  it("dispatches to OutreachDraftCard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "outreach_drafter",
          output: outreachDraftResult,
        })}
      />
    );
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  /* ── Dispatches to ApprovalPendingCard for propose_outreach ─ */

  it("dispatches to ApprovalPendingCard for propose_outreach", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "propose_outreach",
          output: { approval_id: "ap-1" },
        })}
      />
    );
    expect(screen.getByText("Awaiting your approval")).toBeInTheDocument();
    expect(
      screen.getByText("Outreach awaiting your approval")
    ).toBeInTheDocument();
  });

  /* ── Dispatches to RateBenchmarkCard ─────────────────────── */

  it("dispatches to RateBenchmarkCard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "rate_benchmarker",
          output: rateBenchmarkResult,
        })}
      />
    );
    expect(screen.getByText(/Rate benchmark/)).toBeInTheDocument();
  });

  /* ── Dispatches to NegotiationCard ──────────────────────── */

  it("dispatches to NegotiationCard for counter_offer_generator", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "counter_offer_generator",
          output: { negotiation: { terms: {} } },
        })}
      />
    );
    expect(screen.getByTestId("negotiation-card")).toBeInTheDocument();
  });

  /* ── Dispatches to BudgetCard ────────────────────────────── */

  it("dispatches to BudgetCard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "budget_optimizer",
          output: budgetResult,
        })}
      />
    );
    expect(screen.getByText(/Budget — Summer Drop 2026/)).toBeInTheDocument();
  });

  /* ── Dispatches to DealMemoCard ──────────────────────────── */

  it("dispatches to DealMemoCard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "deal_memo_generator",
          output: dealMemoResult,
        })}
      />
    );
    expect(screen.getByText(/Deal Memo/)).toBeInTheDocument();
  });

  /* ── Dispatches to ROICard ──────────────────────────────── */

  it("dispatches to ROICard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "roi_calculator",
          output: roiResult,
        })}
      />
    );
    expect(screen.getByText(/ROI — Summer Drop 2026/)).toBeInTheDocument();
  });

  /* ── Dispatches to CampaignOverviewCard ──────────────────── */

  it("dispatches to CampaignOverviewCard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "campaign_overview",
          output: { campaigns: makeCampaigns(2) },
        })}
      />
    );
    expect(screen.getByText("2 Campaigns")).toBeInTheDocument();
  });

  /* ── Dispatches to ContentTrackerCard ────────────────────── */

  it("dispatches to ContentTrackerCard", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "content_tracker",
          output: { posts: makePosts(2) },
        })}
      />
    );
    expect(screen.getByText("2 Posts tracked")).toBeInTheDocument();
  });

  /* ── Generic approval pending fallback ──────────────────── */

  it("falls back to generic approval pending card", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "some_other_tool",
          output: {
            approval_id: "ap-9",
            status: "pending",
            message: "Custom approval message",
          },
        })}
      />
    );
    expect(screen.getByText("Awaiting your approval")).toBeInTheDocument();
    expect(screen.getByText("Custom approval message")).toBeInTheDocument();
  });

  it("uses default message for generic approval when message is absent", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "some_other_tool",
          output: {
            approval_id: "ap-9",
            status: "pending",
          },
        })}
      />
    );
    // "Review in Approvals" appears both as the default message and as the link text
    const els = screen.getAllByText("Review in Approvals");
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  /* ── Generic message fallback ────────────────────────────── */

  it("falls back to generic message card", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "random_tool",
          output: { message: "Operation completed successfully" },
        })}
      />
    );
    expect(
      screen.getByText("Operation completed successfully")
    ).toBeInTheDocument();
  });

  it("ignores non-string message field", () => {
    const { container } = render(
      <ToolResultCard
        tool={makeTool({
          toolName: "random_tool",
          output: { message: 42 },
        })}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  /* ── compact prop forwarding ─────────────────────────────── */

  it("passes compact=true to child cards", () => {
    render(
      <ToolResultCard
        tool={makeTool({
          toolName: "creator_search",
          output: {
            ...creatorSearchResult,
            results: Array.from({ length: 8 }, (_, i) => ({
              id: `c${i}`,
              handle: `handle_${i}`,
              followers: 10000 * (i + 1),
              tier: "micro",
            })),
            count: 8,
          },
        })}
        compact
      />
    );
    // In compact mode, limit is 5, so 8 creators should show "+3 more …".
    expect(
      screen.getByText("+3 more — refine the search to see them"),
    ).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  CreatorSearchCard                                                   */
/* ================================================================== */

describe("CreatorSearchCard", () => {
  it("renders creator count and total-in-database hint", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(screen.getByText("Found 3 creators")).toBeInTheDocument();
    expect(screen.getByText("42 matches in database")).toBeInTheDocument();
  });

  it("singularizes 'creator' for count of 1", () => {
    const oneResult = {
      ...creatorSearchResult,
      results: creatorSearchResult.results.slice(0, 1),
      count: 1,
    };
    render(<CreatorSearchCard result={oneResult} compact={false} />);
    expect(screen.getByText("Found 1 creator")).toBeInTheDocument();
  });

  it("hides total-in-database hint when not greater than count", () => {
    render(
      <CreatorSearchCard
        result={{ ...creatorSearchResult, total_in_database: 3 }}
        compact={false}
      />
    );
    expect(screen.queryByText(/matches in database/)).not.toBeInTheDocument();
  });

  it("renders filter recap chips when filters are present", () => {
    render(
      <CreatorSearchCard
        result={{
          ...creatorSearchResult,
          filters: { region: "North India", min_hook_quality: 0.7 },
        }}
        compact={false}
      />
    );
    expect(screen.getByText("region: North India")).toBeInTheDocument();
    expect(screen.getByText("min hook quality: 0.7")).toBeInTheDocument();
  });

  it("renders handles with @ prefix and falls back to initial avatar", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(screen.getByText("@fit_priya")).toBeInTheDocument();
    expect(screen.getByText("@foodie_raj")).toBeInTheDocument();
    expect(screen.getByText("@yoga_anita")).toBeInTheDocument();
    // No avatar_url → initial-letter fallback. fit_priya + foodie_raj both
    // start with "F"; yoga_anita starts with "Y".
    expect(screen.getAllByText("F")).toHaveLength(2);
    expect(screen.getByText("Y")).toBeInTheDocument();
  });

  it("renders display_name in non-compact mode", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("Raj Kumar")).toBeInTheDocument();
  });

  it("hides display_name in compact mode", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={true} />
    );
    expect(screen.queryByText("Priya Sharma")).not.toBeInTheDocument();
    expect(screen.queryByText("Raj Kumar")).not.toBeInTheDocument();
  });

  it("renders follower count via formatFollowers", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    // formatFollowers output for these test sizes — keep loose to avoid
    // brittle coupling to format internals.
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/120K|120,?000/)).toBeInTheDocument();
  });

  it("renders tier badges for all three creators", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(screen.getByText("micro")).toBeInTheDocument();
    expect(screen.getByText("mid")).toBeInTheDocument();
    expect(screen.getByText("nano")).toBeInTheDocument();
  });

  it("renders CPI stat chip when present", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    // CPI label appears in two cards (fit_priya: 82, yoga_anita: 95).
    expect(screen.getAllByText("CPI")).toHaveLength(2);
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("renders ER as a percentage", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    // 0.041 → 4.1%, 0.025 → 2.5%, 0.058 → 5.8%
    expect(screen.getByText("4.1%")).toBeInTheDocument();
    expect(screen.getByText("2.5%")).toBeInTheDocument();
    expect(screen.getByText("5.8%")).toBeInTheDocument();
  });

  it("renders Match chip when brand_match is set, falling back to Hook when not", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(screen.getByText("91%")).toBeInTheDocument(); // fit_priya brand_match
    expect(screen.getByText("65%")).toBeInTheDocument(); // foodie_raj brand_match
    // yoga_anita has no brand_match and no hook_quality, so neither shows.
    expect(screen.queryByText("Hook")).not.toBeInTheDocument();
  });

  it("renders the why reasoning chip when present", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(screen.getByText("hook 78/100 · India audience")).toBeInTheDocument();
  });

  it("renders Open profile link with handle-encoded href", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    const links = screen.getAllByText("Open profile");
    expect(links.length).toBe(3);
    expect(links[0].closest("a")).toHaveAttribute("href", "/creator/fit_priya");
  });

  it("renders Add to campaign button on each card", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(screen.getAllByText("Add to campaign")).toHaveLength(3);
  });

  it("compact mode hides actions and renders single-line summaries", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={true} />
    );
    // No action buttons in compact mode.
    expect(screen.queryByText("Open profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Add to campaign")).not.toBeInTheDocument();
    // Handles still rendered.
    expect(screen.getByText("@fit_priya")).toBeInTheDocument();
  });

  it("truncates to 5 creators in compact mode", () => {
    const manyCreators = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      handle: `creator_${i}`,
      followers: 10000,
      tier: "micro",
    }));
    render(
      <CreatorSearchCard
        result={{ results: manyCreators, count: 8 }}
        compact={true}
      />
    );
    expect(
      screen.getByText("+3 more — refine the search to see them"),
    ).toBeInTheDocument();
    expect(screen.getByText("@creator_0")).toBeInTheDocument();
    expect(screen.getByText("@creator_4")).toBeInTheDocument();
    expect(screen.queryByText("@creator_5")).not.toBeInTheDocument();
  });

  it("truncates to 10 creators in non-compact mode", () => {
    const manyCreators = Array.from({ length: 13 }, (_, i) => ({
      id: `c${i}`,
      handle: `creator_${i}`,
      followers: 10000,
      tier: "micro",
    }));
    render(
      <CreatorSearchCard
        result={{ results: manyCreators, count: 13 }}
        compact={false}
      />
    );
    expect(
      screen.getByText("+3 more — refine the search to see them"),
    ).toBeInTheDocument();
    expect(screen.getByText("@creator_9")).toBeInTheDocument();
    expect(screen.queryByText("@creator_10")).not.toBeInTheDocument();
  });

  it("does not show '+N more' when creators fit within limit", () => {
    render(
      <CreatorSearchCard result={creatorSearchResult} compact={false} />
    );
    expect(
      screen.queryByText(/refine the search/),
    ).not.toBeInTheDocument();
  });
});

/* ================================================================== */
/*  OutreachDraftCard                                                  */
/* ================================================================== */

describe("OutreachDraftCard", () => {
  it("renders 'Draft saved' heading", () => {
    render(<OutreachDraftCard result={outreachDraftResult} />);
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  it("renders recipient email", () => {
    render(<OutreachDraftCard result={outreachDraftResult} />);
    expect(screen.getByText("To: priya@example.com")).toBeInTheDocument();
  });

  it("renders subject line", () => {
    render(<OutreachDraftCard result={outreachDraftResult} />);
    expect(
      screen.getByText("Collab opportunity with BrandX")
    ).toBeInTheDocument();
  });

  it("truncates body to 200 characters with ellipsis", () => {
    const longBody = "A".repeat(300);
    render(
      <OutreachDraftCard
        result={{ ...outreachDraftResult, body: longBody }}
      />
    );
    // The rendered body should be 200 A's + "..."
    const bodyEl = screen.getByText(`${"A".repeat(200)}...`);
    expect(bodyEl).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  ApprovalPendingCard                                                */
/* ================================================================== */

describe("ApprovalPendingCard", () => {
  it("renders the approval heading", () => {
    render(<ApprovalPendingCard message="Please approve this outreach" />);
    expect(screen.getByText("Awaiting your approval")).toBeInTheDocument();
  });

  it("renders the provided message", () => {
    render(<ApprovalPendingCard message="Please approve this outreach" />);
    expect(
      screen.getByText("Please approve this outreach")
    ).toBeInTheDocument();
  });

  it("renders the Review in Approvals link", () => {
    render(<ApprovalPendingCard message="Test" />);
    const link = screen.getByText("Review in Approvals");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/approvals");
  });
});

/* ================================================================== */
/*  RateBenchmarkCard                                                  */
/* ================================================================== */

describe("RateBenchmarkCard", () => {
  it("renders tier label", () => {
    render(<RateBenchmarkCard result={rateBenchmarkResult} />);
    expect(
      screen.getByText("Rate benchmark \u2014 micro tier")
    ).toBeInTheDocument();
  });

  it("renders min, median, max rates", () => {
    render(<RateBenchmarkCard result={rateBenchmarkResult} />);
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Median")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
    // Rupee symbol \u20B9 — use exact text to avoid substring matches
    expect(screen.getByText("\u20B95,000")).toBeInTheDocument();
    expect(screen.getByText("\u20B912,000")).toBeInTheDocument();
    expect(screen.getByText("\u20B925,000")).toBeInTheDocument();
  });

  it("renders brand historical average when present", () => {
    render(<RateBenchmarkCard result={rateBenchmarkResult} />);
    expect(screen.getByText(/Your avg/)).toBeInTheDocument();
    expect(screen.getByText(/10,500/)).toBeInTheDocument();
  });

  it("hides brand historical when not present", () => {
    const noHistorical = {
      ...rateBenchmarkResult,
      brand_historical: null,
    };
    render(<RateBenchmarkCard result={noHistorical} />);
    expect(screen.queryByText(/Your avg/)).not.toBeInTheDocument();
  });

  it("hides brand historical when avg_rate_paid is missing", () => {
    const noAvg = {
      ...rateBenchmarkResult,
      brand_historical: { avg_rate_paid: null },
    };
    render(<RateBenchmarkCard result={noAvg} />);
    expect(screen.queryByText(/Your avg/)).not.toBeInTheDocument();
  });
});

/* ================================================================== */
/*  BudgetCard                                                         */
/* ================================================================== */

describe("BudgetCard", () => {
  it("renders campaign name", () => {
    render(<BudgetCard result={budgetResult} />);
    expect(
      screen.getByText("Budget \u2014 Summer Drop 2026")
    ).toBeInTheDocument();
  });

  it("renders budget summary values", () => {
    render(<BudgetCard result={budgetResult} />);
    expect(screen.getByText("Total:")).toBeInTheDocument();
    expect(screen.getByText(/5,00,000/)).toBeInTheDocument();
    expect(screen.getByText("Confirmed:")).toBeInTheDocument();
    expect(screen.getByText(/1,50,000/)).toBeInTheDocument();
    expect(screen.getByText("Available:")).toBeInTheDocument();
    expect(screen.getByText(/3,50,000/)).toBeInTheDocument();
    expect(screen.getByText("Used:")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("renders warnings when present", () => {
    render(<BudgetCard result={budgetResult} />);
    expect(
      screen.getByText("Budget is 80% allocated")
    ).toBeInTheDocument();
    expect(
      screen.getByText("2 deals pending approval")
    ).toBeInTheDocument();
  });

  it("does not render warnings section when warnings is absent", () => {
    const noWarnings = { ...budgetResult, warnings: undefined };
    render(<BudgetCard result={noWarnings} />);
    expect(
      screen.queryByText("Budget is 80% allocated")
    ).not.toBeInTheDocument();
  });

  it("does not render warnings section when warnings is not an array", () => {
    const badWarnings = { ...budgetResult, warnings: "some string" };
    render(<BudgetCard result={badWarnings} />);
    // The string "some string" should not appear as a warning element
    expect(screen.queryByText("some string")).not.toBeInTheDocument();
  });
});

/* ================================================================== */
/*  DealMemoCard                                                       */
/* ================================================================== */

describe("DealMemoCard", () => {
  it("renders creator handle in heading", () => {
    render(<DealMemoCard result={dealMemoResult} />);
    expect(screen.getByText(/Deal Memo/)).toBeInTheDocument();
    expect(screen.getByText(/fit_priya/)).toBeInTheDocument();
  });

  it("renders agreed rate", () => {
    render(<DealMemoCard result={dealMemoResult} />);
    expect(screen.getByText("Rate:")).toBeInTheDocument();
    expect(screen.getByText(/15,000/)).toBeInTheDocument();
  });

  it("renders usage rights", () => {
    render(<DealMemoCard result={dealMemoResult} />);
    expect(screen.getByText("Usage:")).toBeInTheDocument();
    expect(screen.getByText("6 months")).toBeInTheDocument();
  });

  it("renders payment terms", () => {
    render(<DealMemoCard result={dealMemoResult} />);
    expect(screen.getByText("Payment:")).toBeInTheDocument();
    expect(screen.getByText("Net 30")).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  ROICard                                                            */
/* ================================================================== */

describe("ROICard", () => {
  it("renders campaign name", () => {
    render(<ROICard result={roiResult} />);
    expect(
      screen.getByText("ROI \u2014 Summer Drop 2026")
    ).toBeInTheDocument();
  });

  it("renders all KPI labels", () => {
    render(<ROICard result={roiResult} />);
    expect(screen.getByText("Revenue:")).toBeInTheDocument();
    expect(screen.getByText("Spend:")).toBeInTheDocument();
    expect(screen.getByText("Orders:")).toBeInTheDocument();
    expect(screen.getByText("ROI:")).toBeInTheDocument();
  });

  it("renders KPI values", () => {
    render(<ROICard result={roiResult} />);
    expect(screen.getByText("\u20B925,00,000")).toBeInTheDocument();
    expect(screen.getByText("\u20B95,00,000")).toBeInTheDocument();
    expect(screen.getByText("1250")).toBeInTheDocument();
    expect(screen.getByText("5x")).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  CampaignOverviewCard                                               */
/* ================================================================== */

describe("CampaignOverviewCard", () => {
  it("renders campaign count with plural", () => {
    render(
      <CampaignOverviewCard
        result={{ campaigns: makeCampaigns(4) }}
        compact={false}
      />
    );
    expect(screen.getByText("4 Campaigns")).toBeInTheDocument();
  });

  it("renders singular 'Campaign' for count of 1", () => {
    render(
      <CampaignOverviewCard
        result={{ campaigns: makeCampaigns(1) }}
        compact={false}
      />
    );
    expect(screen.getByText("1 Campaign")).toBeInTheDocument();
  });

  it("renders campaign names", () => {
    render(
      <CampaignOverviewCard
        result={{ campaigns: makeCampaigns(2) }}
        compact={false}
      />
    );
    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.getByText("Campaign 2")).toBeInTheDocument();
  });

  it("renders status badges", () => {
    render(
      <CampaignOverviewCard
        result={{ campaigns: makeCampaigns(2) }}
        compact={false}
      />
    );
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("renders budget values", () => {
    render(
      <CampaignOverviewCard
        result={{ campaigns: makeCampaigns(2) }}
        compact={false}
      />
    );
    expect(screen.getByText(/1,00,000/)).toBeInTheDocument();
    expect(screen.getByText(/2,00,000/)).toBeInTheDocument();
  });

  it("truncates to 3 in compact mode", () => {
    render(
      <CampaignOverviewCard
        result={{ campaigns: makeCampaigns(5) }}
        compact={true}
      />
    );
    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.getByText("Campaign 2")).toBeInTheDocument();
    expect(screen.getByText("Campaign 3")).toBeInTheDocument();
    expect(screen.queryByText("Campaign 4")).not.toBeInTheDocument();
  });

  it("truncates to 6 in non-compact mode", () => {
    render(
      <CampaignOverviewCard
        result={{ campaigns: makeCampaigns(8) }}
        compact={false}
      />
    );
    expect(screen.getByText("Campaign 6")).toBeInTheDocument();
    expect(screen.queryByText("Campaign 7")).not.toBeInTheDocument();
  });

  it("does not render budget when total_budget is null", () => {
    const campaigns = [
      { id: "c1", name: "No Budget Camp", status: "active", total_budget: null },
    ];
    render(
      <CampaignOverviewCard
        result={{ campaigns }}
        compact={false}
      />
    );
    expect(screen.getByText("No Budget Camp")).toBeInTheDocument();
    // No rupee symbol should be present
    expect(screen.queryByText(/\u20B9/)).not.toBeInTheDocument();
  });

  it("does not render status badge when status is null", () => {
    const campaigns = [
      { id: "c1", name: "No Status Camp", status: null, total_budget: 50000 },
    ];
    render(
      <CampaignOverviewCard
        result={{ campaigns }}
        compact={false}
      />
    );
    expect(screen.getByText("No Status Camp")).toBeInTheDocument();
    // No status badge elements (active, draft, paused, completed)
    expect(screen.queryByText("active")).not.toBeInTheDocument();
    expect(screen.queryByText("draft")).not.toBeInTheDocument();
  });
});

/* ================================================================== */
/*  ContentTrackerCard                                                 */
/* ================================================================== */

describe("ContentTrackerCard", () => {
  it("renders post count with plural", () => {
    render(
      <ContentTrackerCard
        result={{ posts: makePosts(4) }}
        compact={false}
      />
    );
    expect(screen.getByText("4 Posts tracked")).toBeInTheDocument();
  });

  it("renders singular 'Post' for count of 1", () => {
    render(
      <ContentTrackerCard
        result={{ posts: makePosts(1) }}
        compact={false}
      />
    );
    expect(screen.getByText("1 Post tracked")).toBeInTheDocument();
  });

  it("renders post captions", () => {
    render(
      <ContentTrackerCard
        result={{ posts: makePosts(2) }}
        compact={false}
      />
    );
    expect(screen.getByText("Post caption 1")).toBeInTheDocument();
    expect(screen.getByText("Post caption 2")).toBeInTheDocument();
  });

  it("renders likes and comments", () => {
    render(
      <ContentTrackerCard
        result={{ posts: makePosts(1) }}
        compact={false}
      />
    );
    expect(screen.getByText("100 likes")).toBeInTheDocument();
    expect(screen.getByText("10 comments")).toBeInTheDocument();
  });

  it("truncates to 3 in compact mode", () => {
    render(
      <ContentTrackerCard
        result={{ posts: makePosts(5) }}
        compact={true}
      />
    );
    expect(screen.getByText("Post caption 1")).toBeInTheDocument();
    expect(screen.getByText("Post caption 3")).toBeInTheDocument();
    expect(screen.queryByText("Post caption 4")).not.toBeInTheDocument();
  });

  it("truncates to 6 in non-compact mode", () => {
    render(
      <ContentTrackerCard
        result={{ posts: makePosts(8) }}
        compact={false}
      />
    );
    expect(screen.getByText("Post caption 6")).toBeInTheDocument();
    expect(screen.queryByText("Post caption 7")).not.toBeInTheDocument();
  });

  it("falls back to url when caption is missing", () => {
    const posts = [
      { url: "https://instagram.com/p/abc", likes: 50, comments: 5 },
    ];
    render(
      <ContentTrackerCard result={{ posts }} compact={false} />
    );
    expect(
      screen.getByText("https://instagram.com/p/abc")
    ).toBeInTheDocument();
  });

  it("falls back to 'Post' when caption and url are missing", () => {
    const posts = [{ likes: 50, comments: 5 }];
    render(
      <ContentTrackerCard result={{ posts }} compact={false} />
    );
    // The label should just say "Post" (the fallback)
    // Note: "1 Post tracked" heading also contains "Post", so find the specific one
    const postElements = screen.getAllByText("Post");
    expect(postElements.length).toBeGreaterThanOrEqual(1);
  });

  it("hides likes when likes is null", () => {
    const posts = [{ caption: "No likes post", likes: null, comments: 5 }];
    render(
      <ContentTrackerCard result={{ posts }} compact={false} />
    );
    expect(screen.queryByText(/\d+ likes/)).not.toBeInTheDocument();
    expect(screen.getByText("5 comments")).toBeInTheDocument();
  });

  it("hides comments when comments is null", () => {
    const posts = [{ caption: "No comments post", likes: 50, comments: null }];
    render(
      <ContentTrackerCard result={{ posts }} compact={false} />
    );
    expect(screen.getByText("50 likes")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ comments/)).not.toBeInTheDocument();
  });
});

/* ================================================================== */
/*  TierBadge (tested via CreatorSearchCard)                           */
/* ================================================================== */

describe("TierBadge rendering", () => {
  it("renders known tiers with correct text", () => {
    const creators = [
      { id: "c1", handle: "a", followers: 5000, tier: "nano" },
      { id: "c2", handle: "b", followers: 25000, tier: "micro" },
      { id: "c3", handle: "c", followers: 100000, tier: "mid" },
      { id: "c4", handle: "d", followers: 500000, tier: "macro" },
      { id: "c5", handle: "e", followers: 2000000, tier: "mega" },
    ];
    render(
      <CreatorSearchCard
        result={{ results: creators, count: 5 }}
        compact={false}
      />
    );
    expect(screen.getByText("nano")).toBeInTheDocument();
    expect(screen.getByText("micro")).toBeInTheDocument();
    expect(screen.getByText("mid")).toBeInTheDocument();
    expect(screen.getByText("macro")).toBeInTheDocument();
    expect(screen.getByText("mega")).toBeInTheDocument();
  });

  it("renders unknown tier with fallback styling (no crash)", () => {
    const creators = [
      { id: "c1", handle: "a", followers: 5000, tier: "ultra" },
    ];
    render(
      <CreatorSearchCard
        result={{ results: creators, count: 1 }}
        compact={false}
      />
    );
    expect(screen.getByText("ultra")).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  Match chip (tested via CreatorSearchCard, new 0–1 brief shape)     */
/* ================================================================== */

describe("Match chip rendering", () => {
  it("renders high-tier match (≥0.8) as a percentage", () => {
    const creators = [
      {
        id: "c1",
        handle: "high",
        followers: 10000,
        tier: "micro",
        scores: { brand_match: 0.92 },
      },
    ];
    render(
      <CreatorSearchCard
        result={{ results: creators, count: 1 }}
        compact={false}
      />
    );
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("renders mid-tier match (0.6–0.8)", () => {
    const creators = [
      {
        id: "c1",
        handle: "med",
        followers: 10000,
        tier: "micro",
        scores: { brand_match: 0.7 },
      },
    ];
    render(
      <CreatorSearchCard
        result={{ results: creators, count: 1 }}
        compact={false}
      />
    );
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("renders low-tier match (<0.6)", () => {
    const creators = [
      {
        id: "c1",
        handle: "low",
        followers: 10000,
        tier: "micro",
        scores: { brand_match: 0.45 },
      },
    ];
    render(
      <CreatorSearchCard
        result={{ results: creators, count: 1 }}
        compact={false}
      />
    );
    expect(screen.getByText("45%")).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  StatusBadge (tested via CampaignOverviewCard)                      */
/* ================================================================== */

describe("StatusBadge rendering", () => {
  it("renders all known statuses", () => {
    const campaigns = [
      { id: "c1", name: "A", status: "active", total_budget: 100 },
      { id: "c2", name: "B", status: "draft", total_budget: 100 },
      { id: "c3", name: "C", status: "paused", total_budget: 100 },
      { id: "c4", name: "D", status: "completed", total_budget: 100 },
    ];
    render(
      <CampaignOverviewCard
        result={{ campaigns }}
        compact={false}
      />
    );
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.getByText("paused")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("renders unknown status with fallback styling", () => {
    const campaigns = [
      { id: "c1", name: "X", status: "archived", total_budget: 100 },
    ];
    render(
      <CampaignOverviewCard
        result={{ campaigns }}
        compact={false}
      />
    );
    expect(screen.getByText("archived")).toBeInTheDocument();
  });
});
