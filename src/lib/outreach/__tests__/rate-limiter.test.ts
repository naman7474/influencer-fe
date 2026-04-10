import { describe, it, expect } from "vitest";
import {
  checkSendLimits,
  DAILY_LIMIT,
  PER_MINUTE_LIMIT,
} from "../rate-limiter";

/* ------------------------------------------------------------------ */
/*  checkSendLimits                                                    */
/* ------------------------------------------------------------------ */

describe("checkSendLimits", () => {
  it("allows sending when under all limits", () => {
    const result = checkSendLimits({ dailyCount: 10, minuteCount: 2 });
    expect(result.canSend).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks when daily limit reached", () => {
    const result = checkSendLimits({ dailyCount: DAILY_LIMIT, minuteCount: 0 });
    expect(result.canSend).toBe(false);
    expect(result.reason).toContain("Daily limit");
  });

  it("blocks when daily limit exceeded", () => {
    const result = checkSendLimits({ dailyCount: DAILY_LIMIT + 10, minuteCount: 0 });
    expect(result.canSend).toBe(false);
  });

  it("blocks when per-minute limit reached", () => {
    const result = checkSendLimits({ dailyCount: 10, minuteCount: PER_MINUTE_LIMIT });
    expect(result.canSend).toBe(false);
    expect(result.reason).toContain("too fast");
  });

  it("blocks daily limit before per-minute check", () => {
    const result = checkSendLimits({ dailyCount: DAILY_LIMIT, minuteCount: PER_MINUTE_LIMIT });
    expect(result.canSend).toBe(false);
    expect(result.reason).toContain("Daily limit");
  });

  it("allows at one below daily limit", () => {
    const result = checkSendLimits({ dailyCount: DAILY_LIMIT - 1, minuteCount: 0 });
    expect(result.canSend).toBe(true);
  });

  it("allows at one below per-minute limit", () => {
    const result = checkSendLimits({ dailyCount: 0, minuteCount: PER_MINUTE_LIMIT - 1 });
    expect(result.canSend).toBe(true);
  });

  it("returns remaining counts", () => {
    const result = checkSendLimits({ dailyCount: 480, minuteCount: 15 });
    expect(result.canSend).toBe(true);
    expect(result.dailyRemaining).toBe(DAILY_LIMIT - 480);
    expect(result.minuteRemaining).toBe(PER_MINUTE_LIMIT - 15);
  });
});
