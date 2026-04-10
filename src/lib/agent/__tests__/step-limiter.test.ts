import { describe, it, expect } from "vitest";
import { classifyComplexity, getStepLimit } from "../step-limiter";

describe("classifyComplexity", () => {
  it("classifies simple queries as 'simple'", () => {
    expect(classifyComplexity("hello")).toBe("simple");
    expect(classifyComplexity("what is a CPI score?")).toBe("simple");
    expect(classifyComplexity("thanks")).toBe("simple");
    expect(classifyComplexity("how does this work?")).toBe("simple");
  });

  it("classifies search/lookup as 'standard'", () => {
    expect(classifyComplexity("find fitness creators in Delhi")).toBe("standard");
    expect(classifyComplexity("how much should I pay for a reel")).toBe("standard");
    expect(classifyComplexity("draft an outreach email")).toBe("standard");
    expect(classifyComplexity("check the ROI of summer campaign")).toBe("standard");
  });

  it("classifies multi-step workflows as 'complex'", () => {
    expect(
      classifyComplexity(
        "Create a campaign for summer, add 12 creators, generate discount codes, and draft outreach for all"
      )
    ).toBe("complex");
    expect(
      classifyComplexity(
        "Find fitness creators, shortlist the top 10, then draft personalized outreach for each one"
      )
    ).toBe("complex");
    expect(
      classifyComplexity(
        "Analyze the campaign performance, calculate ROI for each creator, and generate a report"
      )
    ).toBe("complex");
  });

  it("detects multi-step intent from conjunctions and sequencing", () => {
    expect(classifyComplexity("search and then draft emails")).toBe("complex");
    expect(classifyComplexity("first find creators, then send outreach")).toBe("complex");
  });
});

describe("getStepLimit", () => {
  it("returns 3 for simple tasks", () => {
    expect(getStepLimit("simple")).toBe(3);
  });

  it("returns 6 for standard tasks", () => {
    expect(getStepLimit("standard")).toBe(6);
  });

  it("returns 12 for complex tasks", () => {
    expect(getStepLimit("complex")).toBe(12);
  });
});
