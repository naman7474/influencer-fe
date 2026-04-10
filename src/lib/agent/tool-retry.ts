/* ------------------------------------------------------------------ */
/*  Tool Retry with Exponential Backoff                                */
/*  Wraps tool executions with retry logic for transient failures.     */
/* ------------------------------------------------------------------ */

import type { Tool } from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

const RETRYABLE_PATTERNS = [
  /time.?out/i,
  /timed out/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /429/,
  /rate limit/i,
  /too many requests/i,
  /502/,
  /503/,
  /504/,
  /bad gateway/i,
  /service unavailable/i,
  /gateway timeout/i,
  /network error/i,
  /fetch failed/i,
];

/**
 * Determine if an error is transient and worth retrying.
 */
export function isRetryableError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error);
  return RETRYABLE_PATTERNS.some((p) => p.test(message));
}

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * - Only retries on transient/retryable errors
 * - Non-retryable errors are thrown immediately
 * - Backoff: baseDelay * 2^(attempt-1) with jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted retries
      if (attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt);
      options?.onRetry?.(attempt + 1, error);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error("Retry failed");
}

/**
 * Wrap a Vercel AI SDK tool so its execute function is retried on transient errors.
 * Returns a new tool with the same schema but a retry-wrapped execute.
 */
export function wrapToolWithRetry(t: AnyTool): AnyTool {
  // Tools that don't have an execute function (e.g. schema-only tools) pass through
  if (!t || typeof (t as { execute?: unknown }).execute !== "function") {
    return t;
  }

  const original = t as { execute: (...args: unknown[]) => Promise<unknown> } & Record<string, unknown>;
  const wrappedExecute = (...args: unknown[]) =>
    withRetry(() => original.execute(...args), { maxRetries: 2, baseDelayMs: 500 });

  return { ...original, execute: wrappedExecute } as unknown as AnyTool;
}
