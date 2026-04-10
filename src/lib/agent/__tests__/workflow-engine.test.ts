import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WorkflowEngine,
  type WorkflowStep,
  type WorkflowStatus,
} from "../workflow-engine";

/* ------------------------------------------------------------------ */
/*  Mock Supabase                                                      */
/* ------------------------------------------------------------------ */

function createMockSupabase(existingWorkflow?: Record<string, unknown>) {
  const insertFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: "wf-1", ...existingWorkflow },
        error: null,
      }),
    }),
  });

  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  const selectFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: existingWorkflow || null,
        error: existingWorkflow ? null : { message: "Not found" },
      }),
    }),
  });

  return {
    from: vi.fn().mockReturnValue({
      insert: insertFn,
      update: updateFn,
      select: selectFn,
    }),
    _insert: insertFn,
    _update: updateFn,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  WorkflowEngine                                                     */
/* ------------------------------------------------------------------ */

describe("WorkflowEngine", () => {
  it("creates a new workflow with steps", async () => {
    const mock = createMockSupabase();
    const engine = new WorkflowEngine(mock as never);

    const steps: WorkflowStep[] = [
      { name: "create_campaign", execute: vi.fn().mockResolvedValue({ campaign_id: "c-1" }) },
      { name: "add_creators", execute: vi.fn().mockResolvedValue({ count: 12 }) },
      { name: "generate_codes", execute: vi.fn().mockResolvedValue({ codes: ["CODE1"] }) },
    ];

    const wfId = await engine.create({
      brandId: "brand-1",
      workflowType: "campaign_creation",
      title: "Summer Campaign Setup",
      steps,
    });

    expect(wfId).toBe("wf-1");
    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        workflow_type: "campaign_creation",
        total_steps: 3,
        status: "pending",
      })
    );
  });

  it("executes all steps in sequence", async () => {
    const mock = createMockSupabase();
    const engine = new WorkflowEngine(mock as never);

    const step1 = vi.fn().mockResolvedValue({ campaign_id: "c-1" });
    const step2 = vi.fn().mockResolvedValue({ count: 5 });
    const step3 = vi.fn().mockResolvedValue({ done: true });

    const steps: WorkflowStep[] = [
      { name: "step_1", execute: step1 },
      { name: "step_2", execute: step2 },
      { name: "step_3", execute: step3 },
    ];

    await engine.create({
      brandId: "brand-1",
      workflowType: "campaign_creation",
      title: "Test",
      steps,
    });

    const result = await engine.run("wf-1");

    expect(result.status).toBe("completed");
    expect(step1).toHaveBeenCalledTimes(1);
    expect(step2).toHaveBeenCalledTimes(1);
    expect(step3).toHaveBeenCalledTimes(1);
    // step2 receives output from step1
    expect(step2).toHaveBeenCalledWith(
      expect.objectContaining({ campaign_id: "c-1" })
    );
  });

  it("pauses on step failure and records error", async () => {
    const mock = createMockSupabase();
    const engine = new WorkflowEngine(mock as never);

    const steps: WorkflowStep[] = [
      { name: "step_1", execute: vi.fn().mockResolvedValue({ ok: true }) },
      { name: "step_2", execute: vi.fn().mockRejectedValue(new Error("Shopify API down")) },
      { name: "step_3", execute: vi.fn().mockResolvedValue({ done: true }) },
    ];

    await engine.create({
      brandId: "brand-1",
      workflowType: "bulk_discount_codes",
      title: "Code Generation",
      steps,
    });

    const result = await engine.run("wf-1");

    expect(result.status).toBe("failed");
    expect(result.errorAtStep).toBe(1);
    expect(result.error).toContain("Shopify API down");
    // Step 3 should NOT have been called
    expect(steps[2].execute).not.toHaveBeenCalled();
  });

  it("can resume a failed workflow from the failed step", async () => {
    const mock = createMockSupabase();
    const engine = new WorkflowEngine(mock as never);

    let callCount = 0;
    const flakyStep = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("transient failure");
      return { recovered: true };
    });

    const steps: WorkflowStep[] = [
      { name: "step_1", execute: vi.fn().mockResolvedValue({ data: "a" }) },
      { name: "step_2", execute: flakyStep },
    ];

    await engine.create({
      brandId: "brand-1",
      workflowType: "custom",
      title: "Resume Test",
      steps,
    });

    // First run fails at step 2
    const run1 = await engine.run("wf-1");
    expect(run1.status).toBe("failed");

    // Resume from failed step
    const run2 = await engine.resume("wf-1");
    expect(run2.status).toBe("completed");
    expect(flakyStep).toHaveBeenCalledTimes(2);
  });

  it("tracks step outputs as accumulated state", async () => {
    const mock = createMockSupabase();
    const engine = new WorkflowEngine(mock as never);

    const steps: WorkflowStep[] = [
      { name: "step_1", execute: vi.fn().mockResolvedValue({ key1: "val1" }) },
      {
        name: "step_2",
        execute: vi.fn().mockImplementation((state) => {
          // Verify accumulated state is available
          expect(state.key1).toBe("val1");
          return { key2: "val2" };
        }),
      },
    ];

    await engine.create({
      brandId: "brand-1",
      workflowType: "custom",
      title: "State Test",
      steps,
    });

    const result = await engine.run("wf-1");
    expect(result.status).toBe("completed");
    expect(result.state).toEqual(
      expect.objectContaining({ key1: "val1", key2: "val2" })
    );
  });
});
