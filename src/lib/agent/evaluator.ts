/* ------------------------------------------------------------------ */
/*  Agent Evaluation Pipeline                                          */
/*  Measures agent quality across tool selection accuracy and          */
/*  response relevance. Designed for regression testing.               */
/* ------------------------------------------------------------------ */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export interface EvalCase {
  name: string;
  userMessage: string;
  expectedTools: string[];
  expectedKeywords: string[];
  actualToolsCalled: string[];
  actualResponse: string;
}

export interface EvalCaseResult {
  name: string;
  toolScore: number;
  responseScore: number;
  semanticScore: number | null;
  missingTools: string[];
  missingKeywords: string[];
  passed: boolean;
}

export interface EvalResult {
  cases: EvalCaseResult[];
  aggregateToolScore: number;
  aggregateResponseScore: number;
  aggregateSemanticScore: number | null;
  passRate: number;
  totalCases: number;
}

/**
 * Evaluate tool selection accuracy.
 * Score = (expected tools that were actually called) / (total expected tools).
 * Extra tool calls beyond expected don't penalize.
 */
export function evaluateToolSelection(
  actualTools: string[],
  expectedTools: string[]
): number {
  if (expectedTools.length === 0) return 1.0;

  const actualSet = new Set(actualTools);
  const matched = expectedTools.filter((t) => actualSet.has(t));
  return matched.length / expectedTools.length;
}

/**
 * Evaluate response relevance via keyword presence.
 * Returns score (0-1) and list of missing keywords.
 */
export function evaluateResponse(
  response: string,
  expectedKeywords: string[]
): { score: number; missingKeywords: string[] } {
  if (expectedKeywords.length === 0) {
    return { score: 1.0, missingKeywords: [] };
  }

  const lower = response.toLowerCase();
  const missing = expectedKeywords.filter(
    (kw) => !lower.includes(kw.toLowerCase())
  );

  const score = (expectedKeywords.length - missing.length) / expectedKeywords.length;
  return { score, missingKeywords: missing };
}

/**
 * LLM-as-judge semantic evaluation.
 * Uses Claude Haiku to score how well the response addresses the user's request.
 * Returns a score from 0.0 to 1.0, or null if the LLM call fails.
 */
export async function evaluateSemanticRelevance(
  userMessage: string,
  actualResponse: string
): Promise<number | null> {
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: `You are an evaluation judge for an AI influencer marketing assistant. Score how well the assistant's response addresses the user's request.

Score from 0 to 10:
- 0-2: Completely irrelevant or harmful response
- 3-4: Partially relevant but missing key information
- 5-6: Addresses the request but with notable gaps
- 7-8: Good response that covers the request well
- 9-10: Excellent, comprehensive response

Respond with ONLY a single number (0-10). No explanation.`,
      prompt: `User request: "${userMessage}"

Assistant response: "${actualResponse.slice(0, 2000)}"

Score (0-10):`,
      maxOutputTokens: 5,
      temperature: 0,
    });

    const score = parseFloat(text.trim());
    if (isNaN(score) || score < 0 || score > 10) return null;
    return score / 10; // Normalize to 0-1
  } catch {
    return null; // LLM failure — don't break eval
  }
}

/** Passing threshold — case passes if both scores ≥ this */
const PASS_THRESHOLD = 0.7;

/**
 * Run a full evaluation suite and compute aggregate metrics.
 * If `useLLMJudge` is true, also runs semantic evaluation (slower, costs tokens).
 */
export async function runEvalSuite(
  cases: EvalCase[],
  options?: { useLLMJudge?: boolean }
): Promise<EvalResult> {
  const useLLM = options?.useLLMJudge ?? false;

  const results: EvalCaseResult[] = [];

  for (const c of cases) {
    const toolScore = evaluateToolSelection(c.actualToolsCalled, c.expectedTools);
    const { score: responseScore, missingKeywords } = evaluateResponse(
      c.actualResponse,
      c.expectedKeywords
    );

    const missingTools = c.expectedTools.filter(
      (t) => !c.actualToolsCalled.includes(t)
    );

    let semanticScore: number | null = null;
    if (useLLM) {
      semanticScore = await evaluateSemanticRelevance(
        c.userMessage,
        c.actualResponse
      );
    }

    // Pass requires keyword + tool scores; semantic is advisory
    const passed = toolScore >= PASS_THRESHOLD && responseScore >= PASS_THRESHOLD;

    results.push({
      name: c.name,
      toolScore,
      responseScore,
      semanticScore,
      missingTools,
      missingKeywords,
      passed,
    });
  }

  const totalCases = results.length;
  const aggregateToolScore =
    totalCases > 0
      ? results.reduce((sum, r) => sum + r.toolScore, 0) / totalCases
      : 1.0;
  const aggregateResponseScore =
    totalCases > 0
      ? results.reduce((sum, r) => sum + r.responseScore, 0) / totalCases
      : 1.0;

  const semanticScores = results
    .map((r) => r.semanticScore)
    .filter((s): s is number => s !== null);
  const aggregateSemanticScore =
    semanticScores.length > 0
      ? semanticScores.reduce((sum, s) => sum + s, 0) / semanticScores.length
      : null;

  const passRate =
    totalCases > 0
      ? results.filter((r) => r.passed).length / totalCases
      : 1.0;

  return {
    cases: results,
    aggregateToolScore,
    aggregateResponseScore,
    aggregateSemanticScore,
    passRate,
    totalCases,
  };
}
