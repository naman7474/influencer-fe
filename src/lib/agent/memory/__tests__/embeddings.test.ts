import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mock the Vercel AI SDK embed functions                             */
/* ------------------------------------------------------------------ */

const mockEmbed = vi.fn();
const mockEmbedMany = vi.fn();

vi.mock("ai", () => ({
  embed: (...args: unknown[]) => mockEmbed(...args),
  embedMany: (...args: unknown[]) => mockEmbedMany(...args),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: {
    embedding: vi.fn(() => ({ modelId: "text-embedding-3-small" })),
  },
}));

import { generateEmbedding, generateEmbeddings, cosineSimilarity } from "../embeddings";

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  cosineSimilarity (pure math — no mocks needed)                     */
/* ------------------------------------------------------------------ */

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 0, 0, 1];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0, 0];
    const b = [0, 1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it("handles non-trivial similarity", () => {
    const a = [1, 1, 0, 0];
    const b = [1, 0, 0, 0];
    // cos(45°) ≈ 0.7071
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.7071, 3);
  });

  it("returns 0 for zero vectors", () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("throws for mismatched dimensions", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  generateEmbedding                                                  */
/* ------------------------------------------------------------------ */

describe("generateEmbedding", () => {
  it("returns embedding array from AI SDK", async () => {
    const fakeEmbedding = new Array(1536).fill(0).map((_, i) => Math.sin(i));
    mockEmbed.mockResolvedValue({ embedding: fakeEmbedding, usage: { tokens: 10 } });

    const result = await generateEmbedding("test text");
    expect(result).toEqual(fakeEmbedding);
    expect(result).toHaveLength(1536);
    expect(mockEmbed).toHaveBeenCalledTimes(1);
  });

  it("returns null on API failure", async () => {
    mockEmbed.mockRejectedValue(new Error("API error"));

    const result = await generateEmbedding("test text");
    expect(result).toBeNull();
  });

  it("returns null for empty text", async () => {
    const result = await generateEmbedding("");
    expect(result).toBeNull();
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("returns null for whitespace-only text", async () => {
    const result = await generateEmbedding("   ");
    expect(result).toBeNull();
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("truncates very long text to prevent token overflow", async () => {
    const longText = "a ".repeat(5000); // 10000 chars
    mockEmbed.mockResolvedValue({ embedding: [0.1, 0.2], usage: { tokens: 100 } });

    await generateEmbedding(longText);
    expect(mockEmbed).toHaveBeenCalledTimes(1);
    // The value passed should be truncated
    const callArgs = mockEmbed.mock.calls[0][0] as { value: string };
    expect(callArgs.value.length).toBeLessThanOrEqual(8192);
  });
});

/* ------------------------------------------------------------------ */
/*  generateEmbeddings (batch)                                         */
/* ------------------------------------------------------------------ */

describe("generateEmbeddings", () => {
  it("returns multiple embeddings", async () => {
    const fakeEmbeddings = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    mockEmbedMany.mockResolvedValue({ embeddings: fakeEmbeddings, usage: { tokens: 20 } });

    const result = await generateEmbeddings(["text 1", "text 2"]);
    expect(result).toEqual(fakeEmbeddings);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", async () => {
    const result = await generateEmbeddings([]);
    expect(result).toEqual([]);
    expect(mockEmbedMany).not.toHaveBeenCalled();
  });

  it("returns empty array on API failure", async () => {
    mockEmbedMany.mockRejectedValue(new Error("API error"));
    const result = await generateEmbeddings(["text"]);
    expect(result).toEqual([]);
  });
});
