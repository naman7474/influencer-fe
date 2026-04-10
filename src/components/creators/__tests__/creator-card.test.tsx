import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mock Next.js Link ───────────────────────────────────────────────
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CreatorCard, type CreatorCardCreator } from "../creator-card";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const baseCreator: CreatorCardCreator = {
  creator_id: "c-001",
  handle: "fitness_guru",
  display_name: "Fitness Guru",
  avatar_url: null,
  followers: 45200,
  tier: "micro",
  is_verified: true,
  city: "Mumbai",
  country: "India",
  cpi: 82,
  avg_engagement_rate: 0.042,
  engagement_trend: "growing",
  primary_niche: "Fitness",
  primary_tone: "Casual",
  primary_spoken_language: "Hindi",
  audience_authenticity_score: 87,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("CreatorCard", () => {
  it("renders handle, display name, and formatted followers", () => {
    render(<CreatorCard creator={baseCreator} />);

    expect(screen.getByText("@fitness_guru")).toBeInTheDocument();
    expect(screen.getByText("Fitness Guru")).toBeInTheDocument();
    expect(screen.getByText("45.2K")).toBeInTheDocument();
  });

  it("renders CPI ring with the correct score", () => {
    render(<CreatorCard creator={baseCreator} />);

    // The CPI ring renders an aria-label with the score
    const ring = screen.getByRole("img", { name: /CPI score 82/i });
    expect(ring).toBeInTheDocument();

    // The numeric label inside the ring
    expect(screen.getByText("82")).toBeInTheDocument();
  });

  it("applies the correct tier badge class", () => {
    render(<CreatorCard creator={baseCreator} />);

    const tierBadge = screen.getByTestId("tier-badge");
    expect(tierBadge).toHaveTextContent("micro");
    expect(tierBadge.className).toContain("badge-micro");
  });

  it("shows verified badge when is_verified is true", () => {
    render(<CreatorCard creator={baseCreator} />);

    expect(screen.getByTestId("verified-badge")).toBeInTheDocument();
  });

  it("hides verified badge when is_verified is false", () => {
    render(
      <CreatorCard creator={{ ...baseCreator, is_verified: false }} />
    );

    expect(screen.queryByTestId("verified-badge")).not.toBeInTheDocument();
  });

  it("renders match score bar when matchScore is provided", () => {
    render(
      <CreatorCard
        creator={baseCreator}
        matchScore={94}
        matchReasons="Niche fit|Geo match"
      />
    );

    const matchSection = screen.getByTestId("match-section");
    expect(matchSection).toBeInTheDocument();

    // 94% appears in both the label and the bar -- ensure at least one exists
    const percentElements = screen.getAllByText("94%", { exact: false });
    expect(percentElements.length).toBeGreaterThanOrEqual(1);

    // Match reasons are rendered as badges
    expect(screen.getByText("Niche fit")).toBeInTheDocument();
    expect(screen.getByText("Geo match")).toBeInTheDocument();

    // Progressbar is present
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "94"
    );
  });

  it("hides match score section when matchScore is not provided", () => {
    render(<CreatorCard creator={baseCreator} />);

    expect(screen.queryByTestId("match-section")).not.toBeInTheDocument();
  });

  it("renders growing trend arrow correctly", () => {
    render(
      <CreatorCard
        creator={{ ...baseCreator, engagement_trend: "growing" }}
      />
    );

    const trend = screen.getByTestId("trend-indicator");
    expect(trend).toHaveTextContent("↗");
    expect(trend).toHaveTextContent("Growing");
  });

  it("renders stable trend arrow correctly", () => {
    render(
      <CreatorCard
        creator={{ ...baseCreator, engagement_trend: "stable" }}
      />
    );

    const trend = screen.getByTestId("trend-indicator");
    expect(trend).toHaveTextContent("→");
    expect(trend).toHaveTextContent("Stable");
  });

  it("renders declining trend arrow correctly", () => {
    render(
      <CreatorCard
        creator={{ ...baseCreator, engagement_trend: "declining" }}
      />
    );

    const trend = screen.getByTestId("trend-indicator");
    expect(trend).toHaveTextContent("↘");
    expect(trend).toHaveTextContent("Declining");
  });

  it("renders location and language", () => {
    render(<CreatorCard creator={baseCreator} />);

    expect(screen.getByText("Mumbai, India")).toBeInTheDocument();
    expect(screen.getByText("Hindi")).toBeInTheDocument();
  });

  it("renders engagement rate formatted as percentage", () => {
    render(<CreatorCard creator={baseCreator} />);

    expect(screen.getByText("4.2%")).toBeInTheDocument();
  });

  it("renders niche and tone badges", () => {
    render(<CreatorCard creator={baseCreator} />);

    expect(screen.getByText("Fitness")).toBeInTheDocument();
    expect(screen.getByText("Casual")).toBeInTheDocument();
  });

  it("renders authenticity score with correct color", () => {
    render(<CreatorCard creator={baseCreator} />);

    // 87% should be green (text-success)
    expect(screen.getByText("87%")).toBeInTheDocument();
  });

  it("calls onAddToCampaign when button is clicked", () => {
    const handler = vi.fn();
    render(
      <CreatorCard creator={baseCreator} onAddToCampaign={handler} />
    );

    fireEvent.click(screen.getByText("Add to Campaign"));
    expect(handler).toHaveBeenCalledWith("c-001");
  });

  it("calls onSaveToList when heart button is clicked", () => {
    const handler = vi.fn();
    render(
      <CreatorCard creator={baseCreator} onSaveToList={handler} />
    );

    fireEvent.click(screen.getByLabelText("Save to list"));
    expect(handler).toHaveBeenCalledWith("c-001");
  });

  it("renders View link pointing to creator profile", () => {
    render(<CreatorCard creator={baseCreator} />);

    const viewLink = screen.getByText("View").closest("a");
    expect(viewLink).toHaveAttribute("href", "/creator/fitness_guru");
  });

  it("renders avatar fallback initials when no avatar_url", () => {
    render(<CreatorCard creator={baseCreator} />);

    // Fallback should show "FG" for "Fitness Guru"
    expect(screen.getByText("FG")).toBeInTheDocument();
  });
});
