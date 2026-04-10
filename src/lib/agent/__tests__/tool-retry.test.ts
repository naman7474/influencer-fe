import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry, isRetryableError } from "../tool-retry";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isRetryableError", () => {
  it("identifies timeout errors as retryable", () => {
    expect(isRetryableError(new Error("Request timed out"))).toBe(true);
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryableError(new Error("timeout exceeded"))).toBe(true);
  });

  it("identifies rate limit errors as retryable", () => {
    expect(isRetryableError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
  });

  it("identifies transient server errors as retryable", () => {
    expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
    expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
  });

  it("identifies non-retryable errors", () => {
    expect(isRetryableError(new Error("Invalid input: creator_id required"))).toBe(false);
    expect(isRetryableError(new Error("Not found"))).toBe(false);
    expect(isRetryableError(new Error("Permission denied"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue({ data: "ok" });

    const result = await withRetry(fn);

    expect(result).toEqual({ data: "ok" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request timed out"))
      .mockResolvedValue({ data: "ok" });

    const result = await withRetry(fn, { baseDelayMs: 10 });

    expect(result).toEqual({ data: "ok" });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid input"));

    await expect(withRetry(fn)).rejects.toThrow("Invalid input");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects maxRetries limit", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Request timed out"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })
    ).rejects.toThrow("Request timed out");

    // Original + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValue({ data: "finally" });

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });

    expect(result).toEqual({ data: "finally" });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry callback", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValue("ok");

    const onRetry = vi.fn();
    await withRetry(fn, { maxRetries: 2, baseDelayMs: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});
