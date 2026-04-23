import { describe, it, expect } from "vitest";
import {
  aggregateByCityState,
  classifyProblemType,
  computeGapScore,
  type ShopifyOrder,
  type ShopifySessions,
} from "../geo-sync";

function order(overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    shippingCity: "Mumbai",
    shippingState: "Maharashtra",
    shippingCountry: "IN",
    totalPrice: 1000,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("aggregateByCityState", () => {
  it("buckets orders by (city, state) case-insensitively", () => {
    const orders = [
      order({ shippingCity: "Mumbai", totalPrice: 1000 }),
      order({ shippingCity: "mumbai", totalPrice: 500 }),
      order({ shippingCity: "Delhi", shippingState: "Delhi", totalPrice: 800 }),
    ];
    const result = aggregateByCityState(orders, null);
    expect(result).toHaveLength(2);
    const mumbai = result.find((b) => b.city?.toLowerCase() === "mumbai");
    expect(mumbai?.orders).toBe(2);
    expect(mumbai?.revenue).toBe(1500);
    expect(mumbai?.sessions).toBeNull();
  });

  it("skips orders with no city and no state", () => {
    const orders = [
      order({ shippingCity: null, shippingState: null, totalPrice: 999 }),
      order({ shippingCity: "Pune", shippingState: "Maharashtra", totalPrice: 100 }),
    ];
    const result = aggregateByCityState(orders, null);
    expect(result).toHaveLength(1);
    expect(result[0].city).toBe("Pune");
  });

  it("merges sessions into buckets and computes conversion_rate", () => {
    const orders = [
      order({ shippingCity: "Delhi", shippingState: "Delhi", totalPrice: 500 }),
    ];
    const sessions: ShopifySessions[] = [
      { city: "Delhi", state: "Delhi", country: "IN", sessions: 100 },
    ];
    const result = aggregateByCityState(orders, sessions);
    expect(result).toHaveLength(1);
    expect(result[0].sessions).toBe(100);
    expect(result[0].conversion_rate).toBeCloseTo(0.01, 5);
  });

  it("creates session-only buckets when a city has sessions but no orders", () => {
    const sessions: ShopifySessions[] = [
      { city: "Kolkata", state: null, country: "IN", sessions: 42 },
    ];
    const result = aggregateByCityState([], sessions);
    expect(result).toHaveLength(1);
    expect(result[0].orders).toBe(0);
    expect(result[0].revenue).toBe(0);
  });
});

describe("classifyProblemType", () => {
  const base = {
    orders: 10,
    conversion_rate: 0.02,
    population_weight: 0.5,
    session_share: 0.3,
    revenue_share: 0.1,
    brand_median_conversion_rate: 0.02,
  };

  it("sessions-aware: awareness_gap when population high but session share low", () => {
    expect(
      classifyProblemType({
        ...base,
        sessions: 50,
        session_share: 0.02,
        population_weight: 0.5,
      })
    ).toBe("awareness_gap");
  });

  it("sessions-aware: conversion_gap when sessions high but CR low vs median", () => {
    expect(
      classifyProblemType({
        ...base,
        sessions: 500,
        session_share: 0.4,
        population_weight: 0.5,
        conversion_rate: 0.005,
        brand_median_conversion_rate: 0.02,
      })
    ).toBe("conversion_gap");
  });

  it("sessions-aware: strong_market when sessions high AND CR healthy", () => {
    expect(
      classifyProblemType({
        ...base,
        sessions: 500,
        session_share: 0.4,
        population_weight: 0.5,
        conversion_rate: 0.025,
        brand_median_conversion_rate: 0.02,
      })
    ).toBe("strong_market");
  });

  it("sessions-free: awareness_gap via revenue share", () => {
    expect(
      classifyProblemType({
        ...base,
        sessions: null,
        session_share: null,
        revenue_share: 0.05,
        population_weight: 0.5,
      })
    ).toBe("awareness_gap");
  });

  it("sessions-free: strong_market when revenue share meets population", () => {
    expect(
      classifyProblemType({
        ...base,
        sessions: null,
        session_share: null,
        revenue_share: 0.5,
        population_weight: 0.5,
      })
    ).toBe("strong_market");
  });

  it("returns untracked when no rule matches", () => {
    expect(
      classifyProblemType({
        ...base,
        sessions: null,
        session_share: null,
        revenue_share: 0.02, // below pop*0.5 (0.025), above pop*0.3 (0.015)
        population_weight: 0.05, // below POP_SIGNIFICANT, so no awareness_gap
      })
    ).toBe("untracked");
  });
});

describe("computeGapScore", () => {
  it("clamps to [-1, 1]", () => {
    expect(
      computeGapScore({
        population_weight: 10,
        category_relevance: 10,
        session_share: null,
        revenue_share: 0,
      })
    ).toBe(1);
    expect(
      computeGapScore({
        population_weight: 0,
        category_relevance: 1,
        session_share: 10,
        revenue_share: 0,
      })
    ).toBe(-1);
  });

  it("prefers session_share over revenue_share when present", () => {
    const withSessions = computeGapScore({
      population_weight: 0.5,
      category_relevance: 1,
      session_share: 0.2,
      revenue_share: 0.9,
    });
    expect(withSessions).toBeCloseTo(0.3, 5);
  });

  it("falls back to revenue_share when session_share is null", () => {
    const r = computeGapScore({
      population_weight: 0.5,
      category_relevance: 1,
      session_share: null,
      revenue_share: 0.1,
    });
    expect(r).toBeCloseTo(0.4, 5);
  });
});
