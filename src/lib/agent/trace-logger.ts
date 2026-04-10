/* ------------------------------------------------------------------ */
/*  Trace Logger                                                       */
/*  Structured execution tracing for agent observability.              */
/*  Every tool call, LLM call, memory retrieval, and error is logged  */
/*  to the agent_traces table for debugging and cost tracking.         */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TraceType =
  | "llm_call"
  | "tool_call"
  | "tool_result"
  | "tool_error"
  | "memory_retrieval"
  | "approval_created"
  | "approval_resolved"
  | "embedding_generated"
  | "knowledge_written";

/**
 * Approximate cost per 1K tokens for Claude Sonnet (input/output average).
 * Used for rough cost tracking — not a billing source.
 */
const COST_PER_1K_TOKENS_CENTS = 0.6; // ~$0.003 input + $0.015 output averaged

export class TraceLogger {
  private brandId: string;
  private sessionId: string | null;
  private supabase: SupabaseClient;
  private stepCounter = 0;

  constructor(
    brandId: string,
    sessionId: string | null,
    supabase: SupabaseClient
  ) {
    this.brandId = brandId;
    this.sessionId = sessionId;
    this.supabase = supabase;
  }

  /** Log a tool invocation (before execution). */
  async logToolCall(
    toolName: string,
    input: Record<string, unknown>,
    durationMs: number
  ): Promise<void> {
    this.stepCounter++;
    await this.insert({
      trace_type: "tool_call",
      tool_name: toolName,
      input,
      step_number: this.stepCounter,
      duration_ms: durationMs,
    });
  }

  /** Log a successful tool result. */
  async logToolResult(
    toolName: string,
    output: Record<string, unknown>,
    durationMs: number
  ): Promise<void> {
    await this.insert({
      trace_type: "tool_result",
      tool_name: toolName,
      output,
      duration_ms: durationMs,
    });
  }

  /** Log a tool execution error. */
  async logToolError(
    toolName: string,
    error: string,
    durationMs: number
  ): Promise<void> {
    await this.insert({
      trace_type: "tool_error",
      tool_name: toolName,
      error,
      duration_ms: durationMs,
    });
  }

  /** Log an LLM call with token usage and estimated cost. */
  async logLLMCall(
    tokensUsed: number,
    durationMs: number,
    outputTokens?: number
  ): Promise<void> {
    const costCents = (tokensUsed / 1000) * COST_PER_1K_TOKENS_CENTS;

    await this.insert({
      trace_type: "llm_call",
      tokens_used: tokensUsed,
      duration_ms: durationMs,
      cost_cents: Math.round(costCents * 10000) / 10000,
      output: outputTokens != null ? { output_tokens: outputTokens } : {},
    });
  }

  /** Log a memory retrieval operation. */
  async logMemoryRetrieval(
    method: "vector" | "keyword" | "fallback",
    resultsCount: number,
    durationMs: number
  ): Promise<void> {
    await this.insert({
      trace_type: "memory_retrieval",
      output: { method, results_count: resultsCount },
      duration_ms: durationMs,
    });
  }

  /** Log a generic trace event. */
  async log(
    traceType: TraceType,
    data: {
      toolName?: string;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      error?: string;
      durationMs?: number;
      tokensUsed?: number;
    }
  ): Promise<void> {
    this.stepCounter++;
    await this.insert({
      trace_type: traceType,
      tool_name: data.toolName,
      input: data.input || {},
      output: data.output || {},
      error: data.error,
      duration_ms: data.durationMs,
      tokens_used: data.tokensUsed,
      step_number: this.stepCounter,
    });
  }

  /* ── Internal ──────────────────────────────────────────────────── */

  private async insert(fields: Record<string, unknown>): Promise<void> {
    try {
      await this.supabase.from("agent_traces").insert({
        brand_id: this.brandId,
        session_id: this.sessionId,
        step_number: this.stepCounter,
        ...fields,
      });
    } catch {
      // Tracing should never break the agent — silently fail
    }
  }
}
