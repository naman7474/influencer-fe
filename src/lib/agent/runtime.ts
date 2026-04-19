import { streamText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentConfig } from "@/lib/types/database";
import type { ModelMessage } from "ai";
import { buildSystemPrompt } from "./system-prompt";
import { DEFAULT_SOUL_MD } from "./soul-md";
import { buildToolset } from "./skills/registry";
import { writeEpisode } from "./memory/episode-writer";
import { searchEpisodesByVector, searchKnowledgeByVector } from "./memory/vector-search";
import { generateEpisodeSummary, classifyEpisodeType, computeImportance } from "./memory/episode-summarizer";
import { extractFromRateBenchmark } from "./memory/knowledge-writer";
import { rankMemories } from "./memory/memory-scorer";
import { TraceLogger } from "./trace-logger";
import { classifyComplexity, getStepLimit } from "./step-limiter";
import { selectModel, DEFAULT_MODEL_NAME } from "./model-router";
import { validateOutput } from "./guardrails";
import { withRetry } from "./tool-retry";
import { workflowExecutorTool } from "./skills/_shared/workflow-tool";
import { selectRelevantTools } from "./tool-selector";

// Import category index files to trigger skill registration
import "./skills/discovery";
import "./skills/negotiation";
import "./skills/campaign";
import "./skills/outreach";
import "./skills/tracking";
import "./skills/relationship";

interface AgentRuntimeParams {
  brandId: string;
  messages: ModelMessage[];
  pageContext: string;
  pageData?: Record<string, unknown>;
  agentConfig: AgentConfig;
  supabase: SupabaseClient;
  sessionId?: string | null;
}

export async function runAgent(params: AgentRuntimeParams) {
  const { brandId, messages, pageContext, pageData, agentConfig, supabase, sessionId } =
    params;

  // Phase 6B: Initialize trace logger for observability
  const tracer = new TraceLogger(brandId, sessionId || null, supabase);

  // 1. Retrieve relevant episodic memories (Phase 6: vector search → composite scoring)
  const lastUserContent = getLastUserContent(messages);
  const memStart = Date.now();
  const rawMemories = await searchEpisodesByVector(brandId, lastUserContent, supabase, 10);
  const memories = rankMemories(rawMemories, 5);
  await tracer.logMemoryRetrieval(
    rawMemories.some((m) => m.similarity != null) ? "vector" : "keyword",
    memories.length,
    Date.now() - memStart
  );

  // 1b. Retrieve relevant semantic knowledge (Phase 6: vector search with keyword fallback)
  const knowledge = await searchKnowledgeByVector(
    brandId,
    lastUserContent,
    supabase,
    5,
    0.4
  );

  // 2. Build the system prompt
  const systemPrompt = buildSystemPrompt({
    soulMd: agentConfig.soul_md || DEFAULT_SOUL_MD,
    brandMd: agentConfig.brand_md || "",
    pageContext,
    pageData: pageData || null,
    memories,
    autonomyLevel: agentConfig.autonomy_level,
    knowledge,
    agentConfig,
  });

  // 3. Build tool set from skill registry (permission-filtered + custom skills)
  const tools = await buildToolset(brandId, supabase, agentConfig);

  // 3b. Add workflow executor for multi-step tasks
  tools.workflow_executor = workflowExecutorTool(brandId, supabase);

  // 3c. Dynamic tool selection — only pass relevant tools to reduce token usage
  const activeTools = selectRelevantTools(tools, lastUserContent);

  // 4. Stream response with adaptive step limit + model routing (Phase 6)
  const complexity = classifyComplexity(lastUserContent);
  const maxSteps = getStepLimit(complexity);
  // Only use model router's complexity-based selection when brand hasn't customized their model
  const modelOverride =
    agentConfig.model_name && agentConfig.model_name !== DEFAULT_MODEL_NAME
      ? agentConfig.model_name
      : null;
  const modelSelection = selectModel(complexity, modelOverride);

  const result = streamText({
    model: anthropic(modelSelection.modelId),
    system: systemPrompt,
    messages,
    tools: activeTools,
    stopWhen: stepCountIs(maxSteps),
    temperature: Number(agentConfig.temperature) || modelSelection.temperature,
    maxOutputTokens: agentConfig.max_tokens || modelSelection.maxTokens,
    onFinish: async ({ text, usage, steps }) => {
      // 1. Persist assistant message FIRST (including tool calls for artifact reconstruction)
      //    This must happen before anything else so chat history is never lost.
      const toolCallsData: Array<{
        toolCallId: string;
        toolName: string;
        args: Record<string, unknown>;
        output: Record<string, unknown> | null;
      }> = [];
      if (steps) {
        for (const step of steps) {
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              const toolResult = step.toolResults?.find(
                (tr: { toolCallId: string }) => tr.toolCallId === tc.toolCallId
              );
              toolCallsData.push({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: (tc.input ?? {}) as Record<string, unknown>,
                output: toolResult
                  ? (toolResult.output as Record<string, unknown>) ?? null
                  : null,
              });
            }
          }
        }
      }

      console.log("[runtime] saving assistant message, session:", sessionId,
        "toolCalls:", toolCallsData.length,
        "withOutput:", toolCallsData.filter(tc => tc.output !== null).length,
        "tools:", toolCallsData.map(tc => tc.toolName)
      );

      const { error: insertError } = await supabase.from("agent_conversations").insert({
        brand_id: brandId,
        session_id: sessionId || null,
        role: "assistant",
        content: text || "",
        tool_calls: toolCallsData.length > 0 ? toolCallsData : null,
        page_context: pageContext,
        token_count: usage?.totalTokens ?? null,
        model_used: modelSelection.modelId,
      } as never);

      if (insertError) {
        console.error("[runtime] failed to save assistant message:", insertError);
      }

      // 2. Non-critical operations below — wrapped in try/catch so they never
      //    prevent the message save above from completing.
      try {
        // Phase 6B: Trace LLM call
        const totalTokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
        await tracer.logLLMCall(
          totalTokens,
          0,
          usage?.outputTokens ?? 0
        );

        // Phase 6B: Trace tool calls with results/errors from steps
        if (steps) {
          for (const step of steps) {
            if (step.toolCalls) {
              for (const tc of step.toolCalls) {
                const toolResult = step.toolResults?.find(
                  (tr: { toolCallId: string }) => tr.toolCallId === tc.toolCallId
                );
                if (toolResult) {
                  const result = toolResult.output as Record<string, unknown>;
                  if (result?.error) {
                    await tracer.logToolError(
                      tc.toolName,
                      String(result.error),
                      0
                    );
                  } else {
                    await tracer.logToolCall(
                      tc.toolName,
                      tc.input as Record<string, unknown>,
                      0
                    );
                    await tracer.logToolResult(
                      tc.toolName,
                      { resultKeys: Object.keys(result || {}) },
                      0
                    );
                  }

                  // Phase 7: Extract knowledge from rate benchmarker results
                  if (tc.toolName === "rate_benchmarker" && result && !result.error) {
                    try {
                      await extractFromRateBenchmark(brandId, result, supabase);
                    } catch {
                      // Knowledge extraction failure should not break the agent
                    }
                  }
                } else {
                  await tracer.logToolCall(
                    tc.toolName,
                    tc.input as Record<string, unknown>,
                    0
                  );
                }
              }
            }
          }
        }

        // Phase 7: Output guardrails — check for false promises and currency issues
        if (text) {
          const guardrailResult = validateOutput(text, {});
          if (!guardrailResult.passed) {
            await tracer.log("tool_error", {
              toolName: "guardrail_check",
              error: guardrailResult.issues.join("; "),
            });
          }
        }
      } catch (traceErr) {
        console.error("[runtime] tracing/guardrail error (non-fatal):", traceErr);
      }

      // 3. Write episodic memory for significant interactions
      if (text && text.length > 50) {
        try {
          await maybeWriteEpisode(brandId, messages, text, supabase);
        } catch (epErr) {
          console.error("[runtime] episode write error (non-fatal):", epErr);
        }
      }

      // 4. Increment daily counter
      await supabase
        .from("agent_config")
        .update({ messages_today: (agentConfig.messages_today || 0) + 1 } as never)
        .eq("brand_id", brandId);
    },
  });

  return result;
}

async function maybeWriteEpisode(
  brandId: string,
  messages: ModelMessage[],
  assistantText: string,
  supabase: SupabaseClient
) {
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) return;

  const userContent =
    typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";

  // Phase 6: Rich classification and importance scoring
  const episodeType = classifyEpisodeType(userContent);
  const importance = computeImportance(episodeType);

  // Phase 6: LLM-generated summary (falls back to template on failure)
  const summary = await generateEpisodeSummary(userContent, assistantText);

  await writeEpisode({
    brandId,
    type: episodeType,
    summary,
    importance,
    supabase,
  });
}

function getLastUserContent(messages: ModelMessage[]): string {
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) return "";
  return typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";
}
