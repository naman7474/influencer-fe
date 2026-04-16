import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  computeSemanticSimilarity,
  computePastCollabSimilarity,
  computeThemeOverlapBonus,
  computeCollabNetworkBonus,
} from "../engine";

// ── Test helpers ─────────────────────────────────────────────────────

/** Build a unit vector of given dimension pointing along axis `i`. */
function basis(i: number, dim = 4): number[] {
  const v = new Array(dim).fill(0);
  v[i] = 1;
  return v;
}

/** Normalized vector with constant value across all dims. */
function uniform(dim = 4): number[] {
  return new Array(dim).fill(1 / Math.sqrt(dim));
}

// ── cosineSimilarity ─────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });

  it("returns 0.5 for orthogonal vectors (mapped from cosine=0)", () => {
    // cosine=0 → (0 + 1) / 2 = 0.5
    expect(cosineSimilarity(basis(0), basis(1))).toBeCloseTo(0.5, 5);
  });

  it("returns 0 for anti-parallel vectors (mapped from cosine=-1)", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(0);
  });

  it("returns 0 for null/empty inputs", () => {
    expect(cosineSimilarity(null, [1, 0])).toBe(0);
    expect(cosineSimilarity([1, 0], null)).toBe(0);
    expect(cosineSimilarity(null, null)).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0])).toBe(0);
  });

  it("returns 0 when one vector is all zeros (degenerate)", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 1, 1])).toBe(0);
  });

  it("is scale-invariant (2x scaled vectors same as originals)", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // same direction, 2x magnitude
    expect(cosineSimilarity(a, b)).toBe(1);
  });
});

// ── computeSemanticSimilarity ────────────────────────────────────────

describe("computeSemanticSimilarity", () => {
  it("returns 1.0 for identical brand and creator embeddings", () => {
    const emb = uniform();
    expect(computeSemanticSimilarity(emb, emb)).toBe(1);
  });

  it("returns 0.5 for orthogonal embeddings", () => {
    expect(computeSemanticSimilarity(basis(0), basis(1))).toBeCloseTo(0.5, 5);
  });

  it("returns 0 when brand embedding is null (graceful degradation)", () => {
    expect(computeSemanticSimilarity(null, uniform())).toBe(0);
  });

  it("returns 0 when creator embedding is null", () => {
    expect(computeSemanticSimilarity(uniform(), null)).toBe(0);
  });
});

// ── computePastCollabSimilarity ──────────────────────────────────────

describe("computePastCollabSimilarity", () => {
  it("picks the MAX similarity across past collaborators", () => {
    // creator matches the 2nd past collaborator exactly
    const creator = basis(1);
    const pasts = [basis(0), basis(1), basis(2)];
    expect(computePastCollabSimilarity(creator, pasts)).toBe(1);
  });

  it("returns 0 when creator embedding is null", () => {
    expect(
      computePastCollabSimilarity(null, [basis(0), basis(1)])
    ).toBe(0);
  });

  it("returns 0 when past collaborators list is empty", () => {
    expect(computePastCollabSimilarity(basis(0), [])).toBe(0);
  });

  it("skips null entries in the past collaborators list", () => {
    const creator = basis(0);
    const pasts = [null, basis(0), null];
    expect(computePastCollabSimilarity(creator, pasts)).toBe(1);
  });

  it("returns 0 when all past entries are null", () => {
    expect(
      computePastCollabSimilarity(basis(0), [null, null])
    ).toBe(0);
  });
});

// ── computeThemeOverlapBonus ─────────────────────────────────────────

describe("computeThemeOverlapBonus", () => {
  it("returns 1.0 (no bonus) when either side has no topics", () => {
    expect(computeThemeOverlapBonus(null, ["a"])).toBe(1);
    expect(computeThemeOverlapBonus(["a"], null)).toBe(1);
    expect(computeThemeOverlapBonus([], ["a"])).toBe(1);
    expect(computeThemeOverlapBonus(["a"], [])).toBe(1);
  });

  it("returns 1.10 (max bonus) for fully-overlapping topic sets", () => {
    expect(
      computeThemeOverlapBonus(["skincare", "routines"], ["skincare", "routines"])
    ).toBeCloseTo(1.1, 5);
  });

  it("scales proportionally with Jaccard overlap", () => {
    // 1 of 3 unique topics match → jaccard = 1/3 → bonus = 1 + 0.1/3 ≈ 1.0333
    const bonus = computeThemeOverlapBonus(["a", "b"], ["b", "c"]);
    expect(bonus).toBeCloseTo(1 + 0.1 / 3, 5);
  });

  it("returns 1.0 when topics are disjoint", () => {
    expect(computeThemeOverlapBonus(["a", "b"], ["c", "d"])).toBe(1);
  });

  it("matches case-insensitively and trims whitespace", () => {
    expect(
      computeThemeOverlapBonus(["Morning Routines"], ["  morning routines "])
    ).toBeCloseTo(1.1, 5);
  });
});

// ── computeCollabNetworkBonus ────────────────────────────────────────

describe("computeCollabNetworkBonus", () => {
  it("returns 1.15 when creator handle is in brand's collaborators", () => {
    expect(computeCollabNetworkBonus("jane_doe", ["jane_doe", "alex"])).toBe(
      1.15
    );
  });

  it("matches case-insensitively and strips @", () => {
    expect(
      computeCollabNetworkBonus("@Jane_Doe", ["jane_doe"])
    ).toBe(1.15);
    expect(
      computeCollabNetworkBonus("jane_doe", ["@JANE_DOE"])
    ).toBe(1.15);
  });

  it("returns 1.0 when handle is not in collaborators", () => {
    expect(computeCollabNetworkBonus("new_face", ["jane", "alex"])).toBe(1);
  });

  it("returns 1.0 on empty/null inputs", () => {
    expect(computeCollabNetworkBonus(null, ["jane"])).toBe(1);
    expect(computeCollabNetworkBonus("jane", null)).toBe(1);
    expect(computeCollabNetworkBonus("", ["jane"])).toBe(1);
    expect(computeCollabNetworkBonus("jane", [])).toBe(1);
  });
});
