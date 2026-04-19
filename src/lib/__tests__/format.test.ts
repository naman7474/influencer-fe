import { describe, it, expect } from "vitest";
import {
  formatFollowers,
  formatPercent,
  formatEngagementRate,
  getTrendIcon,
  formatCurrency,
} from "../format";

describe("formatFollowers", () => {
  it("formats millions", () => {
    expect(formatFollowers(1_200_000)).toBe("1.2M");
  });

  it("formats exact million", () => {
    expect(formatFollowers(1_000_000)).toBe("1M");
  });

  it("formats large millions", () => {
    expect(formatFollowers(15_600_000)).toBe("15.6M");
  });

  it("formats thousands", () => {
    expect(formatFollowers(45_200)).toBe("45.2K");
  });

  it("formats exact thousand", () => {
    expect(formatFollowers(1_000)).toBe("1K");
  });

  it("formats small numbers as-is", () => {
    expect(formatFollowers(850)).toBe("850");
  });

  it("formats zero", () => {
    expect(formatFollowers(0)).toBe("0");
  });
});

describe("formatPercent", () => {
  it("formats decimal as percentage", () => {
    expect(formatPercent(0.042)).toBe("4.2%");
  });

  it("formats with custom decimals", () => {
    expect(formatPercent(0.042, 2)).toBe("4.20%");
  });

  it("formats 10%", () => {
    expect(formatPercent(0.1)).toBe("10.0%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("formatEngagementRate", () => {
  it("delegates to formatPercent with 1 decimal", () => {
    expect(formatEngagementRate(0.042)).toBe("4.2%");
  });
});

describe("getTrendIcon", () => {
  it("returns growing for 'growing'", () => {
    const result = getTrendIcon("growing");
    expect(result.label).toBe("Growing");
    expect(result.color).toBe("text-success");
    expect(result.icon).toBe("↗");
  });

  it("returns growing for 'up'", () => {
    const result = getTrendIcon("up");
    expect(result.label).toBe("Growing");
  });

  it("returns declining for 'declining'", () => {
    const result = getTrendIcon("declining");
    expect(result.label).toBe("Declining");
    expect(result.color).toBe("text-destructive");
    expect(result.icon).toBe("↘");
  });

  it("returns declining for 'down'", () => {
    const result = getTrendIcon("down");
    expect(result.label).toBe("Declining");
  });

  it("returns stable for 'stable'", () => {
    const result = getTrendIcon("stable");
    expect(result.label).toBe("Stable");
    expect(result.color).toBe("text-muted-foreground");
    expect(result.icon).toBe("→");
  });

  it("returns stable for unknown values", () => {
    const result = getTrendIcon("unknown");
    expect(result.label).toBe("Stable");
  });

  it("is case-insensitive", () => {
    expect(getTrendIcon("GROWING").label).toBe("Growing");
    expect(getTrendIcon("Declining").label).toBe("Declining");
    expect(getTrendIcon("UP").label).toBe("Growing");
  });
});

describe("formatCurrency", () => {
  it("formats INR (default)", () => {
    expect(formatCurrency(15000)).toBe("₹15,000");
  });

  it("formats USD", () => {
    expect(formatCurrency(15000, "USD")).toBe("$15,000");
  });

  it("formats EUR", () => {
    expect(formatCurrency(15000, "EUR")).toBe("€15,000");
  });

  it("formats GBP", () => {
    expect(formatCurrency(15000, "GBP")).toBe("£15,000");
  });

  it("handles unknown currency with code prefix", () => {
    const result = formatCurrency(15000, "JPY");
    expect(result).toContain("JPY");
    expect(result).toContain("15,000");
  });

  it("handles case-insensitive currency", () => {
    expect(formatCurrency(500, "usd")).toBe("$500");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("₹0");
  });
});
