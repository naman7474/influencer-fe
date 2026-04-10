import { describe, it, expect } from "vitest";
import { selectModel, type ModelTier, MODEL_IDS } from "../model-router";

describe("selectModel", () => {
  it("returns Haiku for simple tasks", () => {
    const result = selectModel("simple");
    expect(result.modelId).toBe(MODEL_IDS.fast);
    expect(result.tier).toBe("fast");
  });

  it("returns Sonnet for standard tasks", () => {
    const result = selectModel("standard");
    expect(result.modelId).toBe(MODEL_IDS.balanced);
    expect(result.tier).toBe("balanced");
  });

  it("returns Opus for complex tasks", () => {
    const result = selectModel("complex");
    expect(result.modelId).toBe(MODEL_IDS.powerful);
    expect(result.tier).toBe("powerful");
  });

  it("respects config override for model", () => {
    const result = selectModel("simple", "claude-sonnet-4-20250514");
    // Config override should take precedence
    expect(result.modelId).toBe("claude-sonnet-4-20250514");
  });

  it("returns appropriate temperature for each tier", () => {
    expect(selectModel("simple").temperature).toBeLessThanOrEqual(0.5);
    expect(selectModel("standard").temperature).toBeGreaterThanOrEqual(0.5);
    expect(selectModel("complex").temperature).toBeLessThanOrEqual(0.7);
  });

  it("returns appropriate max tokens for each tier", () => {
    expect(selectModel("simple").maxTokens).toBeLessThan(
      selectModel("complex").maxTokens
    );
  });
});

describe("MODEL_IDS", () => {
  it("has all three tiers defined", () => {
    expect(MODEL_IDS.fast).toBeTruthy();
    expect(MODEL_IDS.balanced).toBeTruthy();
    expect(MODEL_IDS.powerful).toBeTruthy();
  });

  it("uses Claude model family", () => {
    expect(MODEL_IDS.fast).toContain("claude");
    expect(MODEL_IDS.balanced).toContain("claude");
    expect(MODEL_IDS.powerful).toContain("claude");
  });
});
