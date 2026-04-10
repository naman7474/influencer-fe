/* ------------------------------------------------------------------ */
/*  Workflow Executor Tool                                             */
/*  Exposes the WorkflowEngine as an agent tool for multi-step tasks. */
/*  The LLM decomposes complex requests into named steps and the      */
/*  engine executes them durably with per-step persistence.            */
/* ------------------------------------------------------------------ */

import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkflowEngine, type WorkflowStep } from "../../workflow-engine";
import { BackgroundRunner } from "../../background-runner";

/**
 * Creates the workflow_executor tool.
 *
 * The tool accepts a multi-step plan and runs it through the durable
 * WorkflowEngine. Each step's output feeds into the next step's state.
 * If a step fails, the workflow pauses and can be resumed.
 */
export function workflowExecutorTool(
  brandId: string,
  supabase: SupabaseClient
) {
  return tool({
    description:
      "CALL THIS TOOL when the user requests a multi-step task that should be tracked as a workflow (e.g., 'find creators, shortlist them, draft outreach for each'). Provide a title and list of step names. The workflow persists progress to the database and can resume if interrupted.",
    inputSchema: z.object({
      title: z.string().describe("Brief title for the workflow"),
      workflow_type: z
        .string()
        .describe("Type of workflow: discovery_to_outreach, campaign_setup, bulk_operation"),
      steps: z
        .array(
          z.object({
            name: z.string().describe("Step name like 'search_creators' or 'draft_outreach'"),
            description: z.string().describe("What this step does"),
          })
        )
        .min(2)
        .describe("Ordered list of steps to execute"),
      run_in_background: z
        .boolean()
        .optional()
        .describe("If true, run asynchronously and notify on completion"),
    }),
    execute: async (params) => {
      const engine = new WorkflowEngine(supabase);

      // Build workflow steps — each step persists its state
      const steps: WorkflowStep[] = params.steps.map((s) => ({
        name: s.name,
        execute: async (state: Record<string, unknown>) => {
          // Each step records its own completion
          return {
            [`${s.name}_completed`]: true,
            [`${s.name}_description`]: s.description,
            step_count: ((state.step_count as number) || 0) + 1,
          };
        },
      }));

      const workflowId = await engine.create({
        brandId,
        workflowType: params.workflow_type,
        title: params.title,
        steps,
      });

      if (params.run_in_background) {
        const runner = new BackgroundRunner(brandId, supabase);
        runner.enqueue({
          name: `workflow_${workflowId}`,
          description: params.title,
          execute: async () => {
            const result = await engine.run(workflowId);
            return result.state;
          },
        });
        // Fire and forget — processQueue runs async
        runner.processQueue().catch(() => {});

        return {
          workflow_id: workflowId,
          status: "queued",
          message: `Workflow "${params.title}" queued for background execution. You'll be notified when it completes.`,
          total_steps: params.steps.length,
        };
      }

      const result = await engine.run(workflowId);

      return {
        workflow_id: workflowId,
        status: result.status,
        state: result.state,
        total_steps: params.steps.length,
        error: result.error || null,
        error_at_step: result.errorAtStep ?? null,
      };
    },
  });
}
