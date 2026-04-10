/* ------------------------------------------------------------------ */
/*  Adaptive Step Limiter                                              */
/*  Classifies task complexity and returns appropriate step limits     */
/*  so simple queries don't waste tokens and complex workflows don't  */
/*  get cut off prematurely.                                          */
/* ------------------------------------------------------------------ */

export type TaskComplexity = "simple" | "standard" | "complex";

const STEP_LIMITS: Record<TaskComplexity, number> = {
  simple: 3,
  standard: 6,
  complex: 12,
};

/**
 * Multi-step indicators: conjunctions, sequencing words, and multiple action verbs.
 */
const MULTI_STEP_PATTERNS = [
  /\b(and then|then|after that|afterwards|next|finally|first.*then|also)\b/i,
  /\b(create|build|generate|draft|find|search|analyze|calculate|send|check)\b.*\b(and|then|also)\b.*\b(create|build|generate|draft|find|search|analyze|calculate|send|check)\b/i,
];

/**
 * Single-action patterns that indicate a tool call is needed.
 */
const TOOL_ACTION_PATTERNS = [
  /\b(find|search|discover|recommend|lookup)\b/i,
  /\b(draft|outreach|email|write|compose)\b/i,
  /\b(rate|price|cost|budget|benchmark|pay)\b/i,
  /\b(campaign|performance|roi|analytics|report)\b/i,
  /\b(create|build|generate|calculate)\b/i,
  /\b(discount|code|utm|brief|gifting)\b/i,
  /\b(approve|reject|review)\b/i,
];

/**
 * Classify message complexity to determine step limit.
 *
 * - simple: No tool call needed — questions, greetings, clarifications
 * - standard: Single tool call or closely related sequence
 * - complex: Multiple distinct tool calls or multi-step workflows
 */
export function classifyComplexity(message: string): TaskComplexity {
  const lower = message.toLowerCase();

  // Check for multi-step patterns first
  for (const pattern of MULTI_STEP_PATTERNS) {
    if (pattern.test(lower)) return "complex";
  }

  // Count distinct action verbs — 3+ suggests complex
  const actionMatches = TOOL_ACTION_PATTERNS.filter((p) => p.test(lower));
  if (actionMatches.length >= 3) return "complex";

  // Any tool action → standard
  if (actionMatches.length >= 1) return "standard";

  // No tool action detected → simple
  return "simple";
}

/**
 * Get the step limit for a given complexity level.
 */
export function getStepLimit(complexity: TaskComplexity): number {
  return STEP_LIMITS[complexity];
}
