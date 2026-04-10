import { describe, it, expect, vi } from "vitest";
import {
  validateOutput,
  checkFalsePromises,
  checkCurrencyFormat,
  type GuardrailResult,
} from "../guardrails";

/* ------------------------------------------------------------------ */
/*  checkFalsePromises                                                 */
/* ------------------------------------------------------------------ */

describe("checkFalsePromises", () => {
  it("flags promises that bypass approval", () => {
    const result = checkFalsePromises(
      "I've sent the email to @priya_fitness. They should receive it shortly."
    );
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
  });

  it("allows drafting language", () => {
    const result = checkFalsePromises(
      "I've drafted the outreach email. It's in your approval queue for review."
    );
    expect(result.passed).toBe(true);
  });

  it("flags claims of creating discount codes without tool call context", () => {
    const result = checkFalsePromises(
      "I've created the discount code PRIYA15 for the campaign."
    );
    // This is fine because creating codes IS an auto action
    expect(result.passed).toBe(true);
  });

  it("flags claims of sending without approval", () => {
    const result = checkFalsePromises(
      "Done! I've sent outreach to all 12 creators on the shortlist."
    );
    expect(result.passed).toBe(false);
  });

  it("passes for normal responses", () => {
    const result = checkFalsePromises(
      "Here are the top 5 fitness creators in Delhi based on CPI score."
    );
    expect(result.passed).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  checkCurrencyFormat                                                */
/* ------------------------------------------------------------------ */

describe("checkCurrencyFormat", () => {
  it("passes for correct INR formatting", () => {
    const result = checkCurrencyFormat(
      "The rate is ₹15,000 per reel. Budget remaining: ₹1,32,000."
    );
    expect(result.passed).toBe(true);
  });

  it("flags dollar amounts when brand currency is INR", () => {
    const result = checkCurrencyFormat(
      "The rate is $150 per reel.",
      "INR"
    );
    expect(result.passed).toBe(false);
    expect(result.issues[0]).toContain("currency");
  });

  it("passes dollar amounts when brand currency is USD", () => {
    const result = checkCurrencyFormat(
      "The rate is $150 per reel.",
      "USD"
    );
    expect(result.passed).toBe(true);
  });

  it("passes when no currency is mentioned", () => {
    const result = checkCurrencyFormat("Here are 5 creators for your campaign.");
    expect(result.passed).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  validateOutput (integration)                                       */
/* ------------------------------------------------------------------ */

describe("validateOutput", () => {
  it("passes a clean response", () => {
    const result = validateOutput(
      "Here are the top 5 fitness creators in Delhi. @fit_priya has the highest CPI at 86.",
      { currency: "INR" }
    );
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("collects multiple issues", () => {
    const result = validateOutput(
      "I've sent the email to @creator. The rate is $200 per reel.",
      { currency: "INR" }
    );
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
  });

  it("returns passed=true when no validators flag issues", () => {
    const result = validateOutput(
      "I found 12 matching creators. Here's the shortlist ranked by engagement rate.",
      {}
    );
    expect(result.passed).toBe(true);
  });
});
