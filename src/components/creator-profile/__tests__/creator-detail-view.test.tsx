import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/creator/test",
}));

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

// Stub heavy children so the test stays focused on the wrapper.
vi.mock("@/components/creators/add-to-campaign-dialog", () => ({
  AddToCampaignDialog: () => null,
}));
vi.mock("../canva/content-tab", () => ({
  ContentTab: () => <div data-testid="content-tab" />,
}));
vi.mock("../canva/performance-tab", () => ({
  PerformanceTab: () => <div data-testid="performance-tab" />,
}));
vi.mock("../canva/audience-tab", () => ({
  AudienceTab: () => <div data-testid="audience-tab" />,
}));
vi.mock("../canva/brand-match-tab", () => ({
  BrandMatchTab: () => <div data-testid="brand-tab" />,
}));

import { CreatorDetailView } from "../creator-detail-view";
import type { CreatorDetail } from "@/lib/types/creator-detail";

function makeDetail(overrides: Partial<CreatorDetail> = {}): CreatorDetail {
  return {
    creator: {
      id: "c-1",
      handle: "mkbhd",
      display_name: "MKBHD",
    } as unknown as CreatorDetail["creator"],
    profiles: [
      {
        creator_id: "c-1",
        platform: "instagram",
        handle: "mkbhd",
        platform_user_id: null,
        profile_url: null,
        display_name: "MKBHD",
        bio: null,
        avatar_url: null,
        category: null,
        country: null,
        is_verified: true,
        is_business: false,
        followers_or_subs: 20_000_000,
        posts_or_videos_count: 1000,
        avg_engagement: null,
        external_links: [],
        last_synced_at: null,
      },
      {
        creator_id: "c-1",
        platform: "youtube",
        handle: "mkbhd",
        platform_user_id: null,
        profile_url: null,
        display_name: "MKBHD",
        bio: null,
        avatar_url: null,
        category: null,
        country: null,
        is_verified: true,
        is_business: false,
        followers_or_subs: 19_000_000,
        posts_or_videos_count: 1600,
        avg_engagement: null,
        external_links: [],
        last_synced_at: null,
      },
    ],
    scores_by_platform: {},
    intelligence_by_platform: {},
    content_by_platform: {},
    primary_platform: "instagram",
    ...overrides,
  };
}

describe("CreatorDetailView", () => {
  it("renders the platform pivot with both Instagram and YouTube", () => {
    render(<CreatorDetailView detail={makeDetail()} brandMatch={null} />);
    expect(screen.getByRole("tab", { name: /instagram/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /youtube/i })).toBeInTheDocument();
  });

  it("disables a platform tab when no profile exists for it", () => {
    const igOnly = makeDetail({
      profiles: [
        {
          creator_id: "c-1",
          platform: "instagram",
          handle: "x",
          platform_user_id: null,
          profile_url: null,
          display_name: null,
          bio: null,
          avatar_url: null,
          category: null,
          country: null,
          is_verified: false,
          is_business: false,
          followers_or_subs: 100,
          posts_or_videos_count: 5,
          avg_engagement: null,
          external_links: [],
          last_synced_at: null,
        },
      ],
    });
    render(<CreatorDetailView detail={igOnly} brandMatch={null} />);
    const yt = screen.getByRole("tab", { name: /youtube/i });
    expect(yt).toBeDisabled();
  });

  it("defaults to primary_platform", () => {
    const ytPrimary = makeDetail({ primary_platform: "youtube" });
    render(<CreatorDetailView detail={ytPrimary} brandMatch={null} />);
    const yt = screen.getByRole("tab", { name: /youtube/i });
    expect(yt.getAttribute("aria-selected")).toBe("true");
  });

  it("honors initialPlatform override", () => {
    render(
      <CreatorDetailView
        detail={makeDetail()}
        brandMatch={null}
        initialPlatform="youtube"
      />,
    );
    const yt = screen.getByRole("tab", { name: /youtube/i });
    expect(yt.getAttribute("aria-selected")).toBe("true");
  });

  it("switches active platform on click", () => {
    render(<CreatorDetailView detail={makeDetail()} brandMatch={null} />);
    const yt = screen.getByRole("tab", { name: /youtube/i });
    fireEvent.click(yt);
    expect(yt.getAttribute("aria-selected")).toBe("true");
  });

  it("renders the Content deep-tab by default", () => {
    render(<CreatorDetailView detail={makeDetail()} brandMatch={null} />);
    expect(screen.getByTestId("content-tab")).toBeInTheDocument();
  });

  it("switches to the Brand match deep-tab on click", () => {
    render(<CreatorDetailView detail={makeDetail()} brandMatch={null} />);
    fireEvent.click(screen.getByRole("tab", { name: /brand match/i }));
    expect(screen.getByTestId("brand-tab")).toBeInTheDocument();
  });
});
