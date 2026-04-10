import { describe, it, expect } from "vitest";
import { generateUTMLink, generateDiscountCode } from "@/lib/utm";

describe("generateUTMLink", () => {
  it("produces a correct URL with all UTM params", () => {
    const url = generateUTMLink(
      "https://example.com",
      "Summer Sale 2026",
      "beauty_queen",
      "micro"
    );

    expect(url).toContain("https://example.com?");
    expect(url).toContain("utm_source=instagram");
    expect(url).toContain("utm_medium=influencer");
    expect(url).toContain("utm_campaign=summer-sale-2026");
    expect(url).toContain("utm_content=beauty_queen");
    expect(url).toContain("utm_term=micro");
  });

  it("handles special characters in campaign name", () => {
    const url = generateUTMLink(
      "https://shop.example.com",
      "New Year's Launch! #2026 (Special)",
      "creator_abc",
      "nano"
    );

    // slugify with strict: true removes special chars
    expect(url).toContain("utm_campaign=new-years-launch-2026-special");
    expect(url).not.toContain("#");
    expect(url).not.toContain("!");
    expect(url).not.toContain("'");
  });

  it("handles trailing slash in brand URL", () => {
    const url = generateUTMLink(
      "https://example.com/",
      "Test Campaign",
      "handle",
      "mid"
    );

    // Should not produce double slashes before the query string
    expect(url).toMatch(/^https:\/\/example\.com\?/);
    expect(url).not.toContain("com/?");
  });

  it("handles URL with path", () => {
    const url = generateUTMLink(
      "https://example.com/shop/",
      "Campaign",
      "user1",
      "macro"
    );

    expect(url).toMatch(/^https:\/\/example\.com\/shop\?/);
  });

  it("includes all five UTM parameters", () => {
    const url = generateUTMLink(
      "https://test.com",
      "My Campaign",
      "influencer1",
      "mega"
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("utm_source")).toBe("instagram");
    expect(parsed.searchParams.get("utm_medium")).toBe("influencer");
    expect(parsed.searchParams.get("utm_campaign")).toBe("my-campaign");
    expect(parsed.searchParams.get("utm_content")).toBe("influencer1");
    expect(parsed.searchParams.get("utm_term")).toBe("mega");
  });
});

describe("generateDiscountCode", () => {
  it("uppercases the handle and appends discount percent", () => {
    expect(generateDiscountCode("beauty_queen", 15)).toBe("BEAUTYQUEEN15");
  });

  it("removes underscores from handle", () => {
    expect(generateDiscountCode("my_cool_handle", 20)).toBe("MYCOOLHANDLE20");
  });

  it("handles handle with no underscores", () => {
    expect(generateDiscountCode("simplehandle", 10)).toBe("SIMPLEHANDLE10");
  });

  it("handles multiple consecutive underscores", () => {
    expect(generateDiscountCode("a__b___c", 25)).toBe("ABC25");
  });

  it("works with zero discount", () => {
    expect(generateDiscountCode("creator", 0)).toBe("CREATOR0");
  });
});
