import { describe, it, expect } from "vitest";
import { insertTrackingPixel, stripHtml, buildEmailHtml } from "../email-sender";

/* ------------------------------------------------------------------ */
/*  insertTrackingPixel                                                */
/* ------------------------------------------------------------------ */

describe("insertTrackingPixel", () => {
  it("inserts a 1x1 tracking pixel before closing body tag", () => {
    const html = "<html><body><p>Hello</p></body></html>";
    const result = insertTrackingPixel(html, "msg-123");
    expect(result).toContain('src="');
    expect(result).toContain("msg-123");
    expect(result).toContain('width="1"');
    expect(result).toContain('height="1"');
  });

  it("appends pixel at end when no closing body tag", () => {
    const html = "<p>Hello world</p>";
    const result = insertTrackingPixel(html, "msg-456");
    expect(result).toContain("msg-456");
    expect(result).toContain("<img");
  });

  it("uses configured base URL", () => {
    const html = "<body><p>Hi</p></body>";
    const result = insertTrackingPixel(html, "abc-789", "https://example.com/track");
    expect(result).toContain("https://example.com/track/open/abc-789");
  });

  it("uses default tracking URL when none provided", () => {
    const html = "<body>Hi</body>";
    const result = insertTrackingPixel(html, "test-id");
    expect(result).toContain("/api/track/open/test-id");
  });
});

/* ------------------------------------------------------------------ */
/*  stripHtml                                                          */
/* ------------------------------------------------------------------ */

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("preserves plain text", () => {
    expect(stripHtml("Just plain text")).toBe("Just plain text");
  });

  it("handles br tags as newlines", () => {
    expect(stripHtml("Line 1<br/>Line 2")).toBe("Line 1\nLine 2");
  });

  it("collapses multiple whitespace", () => {
    expect(stripHtml("<p>  lots   of   spaces  </p>")).toBe("lots of spaces");
  });
});

/* ------------------------------------------------------------------ */
/*  buildEmailHtml                                                     */
/* ------------------------------------------------------------------ */

describe("buildEmailHtml", () => {
  it("wraps body in email container", () => {
    const result = buildEmailHtml({
      body: "<p>Hello Priya</p>",
      senderName: "Naman",
      brandName: "FitBar",
      brandWebsite: "https://fitbar.in",
    });
    expect(result).toContain("Hello Priya");
    expect(result).toContain("Naman");
    expect(result).toContain("FitBar");
    expect(result).toContain("fitbar.in");
  });

  it("includes brand logo when provided", () => {
    const result = buildEmailHtml({
      body: "<p>Hi</p>",
      senderName: "Naman",
      brandName: "FitBar",
      brandWebsite: null,
      brandLogoUrl: "https://example.com/logo.png",
    });
    expect(result).toContain("logo.png");
    expect(result).toContain("<img");
  });

  it("omits logo section when not provided", () => {
    const result = buildEmailHtml({
      body: "<p>Hi</p>",
      senderName: "Naman",
      brandName: "FitBar",
      brandWebsite: null,
    });
    expect(result).not.toContain("alt=\"FitBar\"");
  });

  it("includes unsubscribe link", () => {
    const result = buildEmailHtml({
      body: "<p>Hi</p>",
      senderName: "Naman",
      brandName: "FitBar",
      brandWebsite: null,
      creatorId: "creator-123",
    });
    expect(result).toContain("unsubscribe");
    expect(result).toContain("creator-123");
  });

  it("includes email signature when provided", () => {
    const result = buildEmailHtml({
      body: "<p>Hi</p>",
      senderName: "Naman",
      brandName: "FitBar",
      brandWebsite: null,
      signature: "Marketing Lead, FitBar India",
    });
    expect(result).toContain("Marketing Lead, FitBar India");
  });
});
