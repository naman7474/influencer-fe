/* ------------------------------------------------------------------ */
/*  Email Send Rate Limiter                                            */
/*  Enforces daily and per-minute sending limits for Gmail             */
/* ------------------------------------------------------------------ */

export const DAILY_LIMIT = 500; // Conservative default (Workspace allows 2000)
export const PER_MINUTE_LIMIT = 20; // Avoid Gmail throttling
export const PER_SECOND_DELAY_MS = 1000; // 1 email per second for deliverability

interface SendLimitCounts {
  dailyCount: number;
  minuteCount: number;
}

interface SendLimitResult {
  canSend: boolean;
  reason?: string;
  dailyRemaining: number;
  minuteRemaining: number;
}

/**
 * Check if the brand can send another email given current counts.
 * Pure function — call this with counts fetched from the DB.
 */
export function checkSendLimits(counts: SendLimitCounts): SendLimitResult {
  const dailyRemaining = Math.max(0, DAILY_LIMIT - counts.dailyCount);
  const minuteRemaining = Math.max(0, PER_MINUTE_LIMIT - counts.minuteCount);

  if (counts.dailyCount >= DAILY_LIMIT) {
    return {
      canSend: false,
      reason: `Daily limit reached (${DAILY_LIMIT} emails). Resets at midnight.`,
      dailyRemaining: 0,
      minuteRemaining,
    };
  }

  if (counts.minuteCount >= PER_MINUTE_LIMIT) {
    return {
      canSend: false,
      reason: "Sending too fast. Wait a moment before sending more.",
      dailyRemaining,
      minuteRemaining: 0,
    };
  }

  return { canSend: true, dailyRemaining, minuteRemaining };
}
