/* ------------------------------------------------------------------ */
/*  Output Guardrails                                                  */
/*  Validates agent output before returning to user. Catches           */
/*  hallucinations, false promises, and formatting errors.             */
/* ------------------------------------------------------------------ */

export interface GuardrailResult {
  passed: boolean;
  issues: string[];
}

/* ── False promise detection ──────────────────────────────────────── */

/**
 * Patterns that indicate the agent claims to have performed
 * an action that requires approval.
 */
const FALSE_PROMISE_PATTERNS = [
  {
    pattern: /\b(i'?ve sent|i sent|i'?ve delivered|just sent|already sent)\b.*\b(email|outreach|message)\b/i,
    issue: "Agent claims to have sent an email/message (requires approval)",
  },
  {
    pattern: /\b(sent outreach|sent the email|sent messages)\b/i,
    issue: "Agent claims to have sent outreach (requires approval)",
  },
  {
    pattern: /\b(i'?ve committed|i committed|locked in)\b.*\b(budget)\b/i,
    issue: "Agent claims to have committed budget (requires approval)",
  },
  {
    pattern: /\b(i'?ve negotiated|deal is done|agreed on)\b.*\b(rate|price|₹)\b/i,
    issue: "Agent claims to have finalized a negotiation (requires approval)",
  },
];

/**
 * Check for false promises — claims of actions that require approval.
 */
export function checkFalsePromises(text: string): GuardrailResult {
  const issues: string[] = [];

  for (const { pattern, issue } of FALSE_PROMISE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(issue);
    }
  }

  return { passed: issues.length === 0, issues };
}

/* ── Currency format validation ───────────────────────────────────── */

/**
 * Check that currency symbols match the brand's configured currency.
 */
export function checkCurrencyFormat(
  text: string,
  brandCurrency?: string
): GuardrailResult {
  const issues: string[] = [];
  const currency = brandCurrency || "INR";

  if (currency === "INR") {
    // Flag dollar amounts in INR context
    if (/\$\d/.test(text)) {
      issues.push(
        "Response contains $ amounts but brand currency is INR (₹). Use ₹ formatting."
      );
    }
  } else if (currency === "USD") {
    // Flag rupee amounts in USD context
    if (/₹\d/.test(text)) {
      issues.push(
        "Response contains ₹ amounts but brand currency is USD ($). Use $ formatting."
      );
    }
  }

  return { passed: issues.length === 0, issues };
}

/* ── Main validation entry point ──────────────────────────────────── */

/**
 * Run all guardrails on agent output. Returns combined results.
 */
export function validateOutput(
  text: string,
  context: {
    currency?: string;
  }
): GuardrailResult {
  const allIssues: string[] = [];

  const promises = checkFalsePromises(text);
  allIssues.push(...promises.issues);

  const currency = checkCurrencyFormat(text, context.currency);
  allIssues.push(...currency.issues);

  return {
    passed: allIssues.length === 0,
    issues: allIssues,
  };
}
