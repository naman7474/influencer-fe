import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

// The card mounts AddToCampaignDialog (which constructs a Supabase client at
// module load). Stub it so the card tests stay focused on card surfaces.
vi.mock("../add-to-campaign-dialog", () => ({
  AddToCampaignDialog: () => null,
}));

import { CreatorCard, type CreatorCardCreator } from "../creator-card";

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

describe("CreatorCard", () => {
  it("renders display name and handle", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByText("Fitness Guru")).toBeInTheDocument();
    expect(screen.getByText("@fitness_guru")).toBeInTheDocument();
  });

  it("renders followers formatted as K/M", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByText("45.2K")).toBeInTheDocument();
  });

  it("renders engagement rate as a percentage", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByText("4.2%")).toBeInTheDocument();
  });

  it("uses 'Followers' label by default", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByText("Followers")).toBeInTheDocument();
  });

  it("uses 'Subscribers' label for YouTube creators", () => {
    render(
      <CreatorCard creator={{ ...baseCreator, platform: "youtube" }} />,
    );
    expect(screen.getByText("Subscribers")).toBeInTheDocument();
  });

  it("renders avg views when provided", () => {
    render(<CreatorCard creator={baseCreator} avgViews={62100} />);
    expect(screen.getByText("62.1K")).toBeInTheDocument();
  });

  it("falls back to em-dash for avg views when missing", () => {
    render(<CreatorCard creator={baseCreator} avgViews={null} />);
    // Two em-dashes can appear (avg views + brand match) when both missing
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the brand match score when provided", () => {
    render(<CreatorCard creator={baseCreator} matchScore={92} />);
    // The numeric value appears both inside the ring and next to it.
    expect(screen.getAllByText("92").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("/100")).toBeInTheDocument();
  });

  it("normalizes a 0-1 brand match to 0-100", () => {
    render(<CreatorCard creator={baseCreator} matchScore={0.74} />);
    expect(screen.getAllByText("74").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the tier badge with the correct class", () => {
    render(<CreatorCard creator={baseCreator} />);
    const tierBadge = screen.getByTestId("tier-badge");
    expect(tierBadge).toHaveTextContent(/micro/i);
    expect(tierBadge.className).toContain("badge-micro");
  });

  it("shows the verified badge when is_verified is true", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByTestId("verified-badge")).toBeInTheDocument();
  });

  it("hides the verified badge when is_verified is false", () => {
    render(<CreatorCard creator={{ ...baseCreator, is_verified: false }} />);
    expect(screen.queryByTestId("verified-badge")).not.toBeInTheDocument();
  });

  it("renders niche and tone chips", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByText("Fitness")).toBeInTheDocument();
    expect(screen.getByText("Casual")).toBeInTheDocument();
  });

  it("avatar links to the creator profile", () => {
    render(<CreatorCard creator={baseCreator} />);
    const links = screen.getAllByRole("link");
    expect(links.some((a) => a.getAttribute("href") === "/creator/fitness_guru")).toBe(true);
  });

  it("calls onAddToCampaign when the button is clicked", () => {
    const handler = vi.fn();
    render(<CreatorCard creator={baseCreator} onAddToCampaign={handler} />);
    fireEvent.click(screen.getByText("Add to campaign"));
    expect(handler).toHaveBeenCalledWith("c-001");
  });

  it("calls onReachOut when the button is clicked", () => {
    const handler = vi.fn();
    render(<CreatorCard creator={baseCreator} onReachOut={handler} />);
    fireEvent.click(screen.getByText("Reach out"));
    expect(handler).toHaveBeenCalledWith("c-001");
  });

  it("renders avatar fallback initials when no avatar_url", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByText("FG")).toBeInTheDocument();
  });
});
