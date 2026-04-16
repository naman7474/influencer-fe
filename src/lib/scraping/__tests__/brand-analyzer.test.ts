import { describe, it, expect, vi, beforeEach } from "vitest";

// Store scrape mock so tests can configure it
const mockScrape = vi.fn();

// Mock Firecrawl as a class
vi.mock("@mendable/firecrawl-js", () => {
  return {
    default: class MockFirecrawl {
      scrape = mockScrape;
    },
  };
});

// Mock AI SDK
const mockGenerateObject = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
}));

import { analyzeBrandWebsite } from "../brand-analyzer";

describe("analyzeBrandWebsite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, FIRECRAWL_API_KEY: "test-key" };
  });

  it("returns error when FIRECRAWL_API_KEY is missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const result = await analyzeBrandWebsite("https://example.com");
    expect(result.error).toContain("FIRECRAWL_API_KEY");
    expect(result.data).toBeNull();
  });

  it("returns error when Firecrawl scrape fails", async () => {
    mockScrape.mockResolvedValue({
      success: false,
      markdown: null,
    });

    const result = await analyzeBrandWebsite("https://example.com");
    expect(result.error).toBe("Failed to scrape website");
  });

  it("extracts structured data from successful scrape", async () => {
    mockScrape.mockResolvedValue({
      success: true,
      markdown:
        "# FitBar\n\nHealthy protein bars for active lifestyles.\n\nOur products: Protein Bars, Energy Bites",
    });

    const mockExtraction = {
      brand_name: "FitBar",
      description: "Healthy protein bars for active lifestyles",
      product_categories: ["protein bars", "energy bites"],
      industry: "health food",
      tone: "casual",
    };
    mockGenerateObject.mockResolvedValue({ object: mockExtraction });

    const result = await analyzeBrandWebsite("https://fitbar.in");
    expect(result.data).toEqual(mockExtraction);
    expect(result.error).toBeUndefined();
  });

  it("calls Firecrawl with markdown format", async () => {
    mockScrape.mockResolvedValue({
      success: true,
      markdown: "Test content",
    });
    mockGenerateObject.mockResolvedValue({ object: {} });

    await analyzeBrandWebsite("https://example.com");
    expect(mockScrape).toHaveBeenCalledWith("https://example.com", {
      formats: ["markdown"],
    });
  });

  it("handles unexpected errors gracefully", async () => {
    mockScrape.mockRejectedValue(new Error("Network error"));

    const result = await analyzeBrandWebsite("https://example.com");
    expect(result.error).toBe("Network error");
    expect(result.data).toBeNull();
  });
});
