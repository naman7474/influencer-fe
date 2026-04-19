import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateUTMLink,
  generateDiscountCode,
  generateShortCode,
  buildShortUrl,
} from "../utm";

describe("generateUTMLink", () => {
  it("generates a URL with correct UTM parameters", () => {
    const url = generateUTMLink(
      "https://mybrand.com",
      "Summer Sale 2024",
      "beauty_queen",
      "micro"
    );

    expect(url).toContain("https://mybrand.com?");
    expect(url).toContain("utm_source=instagram");
    expect(url).toContain("utm_medium=influencer");
    expect(url).toContain("utm_campaign=summer-sale-2024");
    expect(url).toContain("utm_content=beauty_queen");
    expect(url).toContain("utm_term=micro");
  });

  it("strips trailing slash from brand website", () => {
    const url = generateUTMLink(
      "https://mybrand.com/",
      "Campaign",
      "handle",
      "nano"
    );
    expect(url).toMatch(/^https:\/\/mybrand\.com\?/);
    expect(url).not.toContain("com/?");
  });

  it("slugifies campaign name with special characters", () => {
    const url = generateUTMLink(
      "https://test.com",
      "Black Friday & Cyber Monday!",
      "creator",
      "mega"
    );
    expect(url).toContain("utm_campaign=black-friday-and-cyber-monday");
  });

  it("lowercases the campaign slug", () => {
    const url = generateUTMLink(
      "https://test.com",
      "UPPERCASE CAMPAIGN",
      "creator",
      "macro"
    );
    expect(url).toContain("utm_campaign=uppercase-campaign");
  });

  it("handles empty campaign name", () => {
    const url = generateUTMLink("https://test.com", "", "handle", "nano");
    expect(url).toContain("utm_campaign=");
  });

  it("handles multiple trailing slashes", () => {
    // Only strips one trailing slash; the URL still works
    const url = generateUTMLink(
      "https://mybrand.com//",
      "test",
      "handle",
      "nano"
    );
    // The regex only removes one trailing slash
    expect(url).toMatch(/^https:\/\/mybrand\.com\/\?/);
  });
});

describe("generateDiscountCode", () => {
  it("generates uppercase code without underscores", () => {
    expect(generateDiscountCode("beauty_queen", 15)).toBe("BEAUTYQUEEN15");
  });

  it("handles handle without underscores", () => {
    expect(generateDiscountCode("fashionista", 20)).toBe("FASHIONISTA20");
  });

  it("handles multiple underscores", () => {
    expect(generateDiscountCode("a_b_c_d", 10)).toBe("ABCD10");
  });

  it("handles zero discount", () => {
    expect(generateDiscountCode("creator", 0)).toBe("CREATOR0");
  });

  it("handles large discount values", () => {
    expect(generateDiscountCode("vip", 100)).toBe("VIP100");
  });

  it("handles empty handle", () => {
    expect(generateDiscountCode("", 25)).toBe("25");
  });
});

describe("generateShortCode", () => {
  it("generates a 6-character code", () => {
    const code = generateShortCode();
    expect(code).toHaveLength(6);
  });

  it("contains only alphanumeric characters", () => {
    const code = generateShortCode();
    expect(code).toMatch(/^[a-zA-Z0-9]{6}$/);
  });

  it("generates different codes on consecutive calls (probabilistic)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateShortCode());
    }
    // Extremely unlikely to get fewer than 2 unique codes in 20 calls
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("buildShortUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const url = buildShortUrl("abc123");
    expect(url).toBe("https://app.example.com/api/link/abc123");
  });

  it("falls back to localhost when env is not set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = buildShortUrl("xyz789");
    expect(url).toBe("http://localhost:3000/api/link/xyz789");
  });

  it("handles empty short code", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = buildShortUrl("");
    expect(url).toBe("http://localhost:3000/api/link/");
  });
});
