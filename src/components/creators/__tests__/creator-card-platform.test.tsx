import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

vi.mock("../add-to-campaign-dialog", () => ({
  AddToCampaignDialog: () => null,
}));

import { CreatorCard, type CreatorCardCreator } from "../creator-card";

const baseCreator: CreatorCardCreator = {
  creator_id: "c-001",
  handle: "mkbhd",
  display_name: "Marques Brownlee",
  avatar_url: null,
  followers: 20_000_000,
  tier: "mega",
  is_verified: true,
  city: "New Jersey",
  country: "US",
  cpi: 95,
  avg_engagement_rate: 0.05,
  engagement_trend: "growing",
  primary_niche: "Tech",
  primary_tone: "Professional",
  primary_spoken_language: "English",
  audience_authenticity_score: 95,
};

describe("CreatorCard — platform awareness", () => {
  it("shows YT badge when platform=youtube", () => {
    render(<CreatorCard creator={{ ...baseCreator, platform: "youtube" }} />);
    expect(screen.getByLabelText("Platform: youtube")).toHaveTextContent("YT");
  });

  it("shows IG badge when platform=instagram", () => {
    render(<CreatorCard creator={{ ...baseCreator, platform: "instagram" }} />);
    expect(screen.getByLabelText("Platform: instagram")).toHaveTextContent("IG");
  });

  it("does not show platform badge when platform is absent", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.queryByLabelText(/^Platform:/)).toBeNull();
  });

  it("uses 'Subscribers' label for YouTube creators", () => {
    render(<CreatorCard creator={{ ...baseCreator, platform: "youtube" }} />);
    expect(screen.getByText("Subscribers")).toBeInTheDocument();
    expect(screen.queryByText("Followers")).toBeNull();
  });

  it("uses 'Followers' label for Instagram creators", () => {
    render(<CreatorCard creator={{ ...baseCreator, platform: "instagram" }} />);
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.queryByText("Subscribers")).toBeNull();
  });

  it("defaults to 'Followers' label when platform is omitted", () => {
    render(<CreatorCard creator={baseCreator} />);
    expect(screen.getByText("Followers")).toBeInTheDocument();
  });
});
