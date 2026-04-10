/* ------------------------------------------------------------------ */
/*  Workflow Engine                                                    */
/*  Durable state machine for multi-step agent tasks.                 */
/*  Each step is independently retryable; state persists to DB.       */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkflowStatus =
  | "pending"
  | "running"
  | "paused"
  | "failed"
  | "completed"
  | "cancelled";

export interface WorkflowStep {
  name: string;
  execute: (state: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface CreateWorkflowParams {
  brandId: string;
  sessionId?: string | null;
  workflowType: string;
  title: string;
  steps: WorkflowStep[];
}

interface WorkflowRunResult {
  status: WorkflowStatus;
  state: Record<string, unknown>;
  error?: string;
  errorAtStep?: number;
}

export class WorkflowEngine {
  private supabase: SupabaseClient;
  /** In-memory step registry keyed by workflow ID */
  private stepRegistry = new Map<string, WorkflowStep[]>();
  /** In-memory state keyed by workflow ID */
  private stateRegistry = new Map<string, Record<string, unknown>>();
  /** Current step index keyed by workflow ID */
  private currentStepRegistry = new Map<string, number>();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Create a new workflow and persist initial state.
   */
  async create(params: CreateWorkflowParams): Promise<string> {
    const stepDefs = params.steps.map((s, i) => ({
      index: i,
      name: s.name,
      status: "pending" as const,
      output: null,
      error: null,
    }));

    const { data } = await this.supabase
      .from("agent_workflows")
      .insert({
        brand_id: params.brandId,
        session_id: params.sessionId || null,
        workflow_type: params.workflowType,
        title: params.title,
        total_steps: params.steps.length,
        current_step: 0,
        steps: stepDefs,
        state: {},
        status: "pending",
      })
      .select("id")
      .single();

    const id = (data as { id: string })?.id || "wf-unknown";

    // Store steps in memory for execution
    this.stepRegistry.set(id, params.steps);
    this.stateRegistry.set(id, {});
    this.currentStepRegistry.set(id, 0);

    return id;
  }

  /**
   * Run a workflow from the beginning (or from current_step if resuming).
   */
  async run(workflowId: string): Promise<WorkflowRunResult> {
    const steps = this.stepRegistry.get(workflowId);
    if (!steps) {
      return { status: "failed", state: {}, error: "Workflow not found in registry" };
    }

    const startStep = this.currentStepRegistry.get(workflowId) || 0;
    const state = this.stateRegistry.get(workflowId) || {};

    // Mark as running
    await this.updateStatus(workflowId, "running", { started_at: new Date().toISOString() });

    for (let i = startStep; i < steps.length; i++) {
      const step = steps[i];
      this.currentStepRegistry.set(workflowId, i);

      try {
        const output = await step.execute(state);

        // Merge step output into accumulated state
        Object.assign(state, output);
        this.stateRegistry.set(workflowId, state);

        // Persist progress
        await this.updateProgress(workflowId, i, "completed", output);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        await this.updateProgress(workflowId, i, "failed", null, errorMsg);
        await this.updateStatus(workflowId, "failed", {
          error: errorMsg,
          error_at_step: i,
        });

        return {
          status: "failed",
          state,
          error: errorMsg,
          errorAtStep: i,
        };
      }
    }

    // All steps completed
    await this.updateStatus(workflowId, "completed", {
      completed_at: new Date().toISOString(),
    });

    return { status: "completed", state };
  }

  /**
   * Resume a failed workflow from the failed step.
   */
  async resume(workflowId: string): Promise<WorkflowRunResult> {
    // Run will pick up from currentStepRegistry
    return this.run(workflowId);
  }

  /* ── Internal helpers ──────────────────────────────────────────── */

  private async updateStatus(
    workflowId: string,
    status: WorkflowStatus,
    extra?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase
        .from("agent_workflows")
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...extra,
        })
        .eq("id", workflowId);
    } catch {
      // Don't let persistence errors break execution
    }
  }

  private async updateProgress(
    workflowId: string,
    stepIndex: number,
    stepStatus: string,
    output: Record<string, unknown> | null,
    error?: string
  ): Promise<void> {
    try {
      const state = this.stateRegistry.get(workflowId) || {};
      await this.supabase
        .from("agent_workflows")
        .update({
          current_step: stepIndex,
          state,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workflowId);
    } catch {
      // Silent — don't break workflow for persistence failures
    }
  }
}
