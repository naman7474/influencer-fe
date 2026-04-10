import { describe, it, expect, vi, beforeEach } from "vitest";
import { BackgroundRunner, type BackgroundTask } from "../background-runner";

/* ------------------------------------------------------------------ */
/*  Mock Supabase                                                      */
/* ------------------------------------------------------------------ */

function createMockSupabase() {
  const insertFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    from: vi.fn().mockReturnValue({
      insert: insertFn,
      update: updateFn,
    }),
    _insert: insertFn,
    _update: updateFn,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  BackgroundRunner                                                   */
/* ------------------------------------------------------------------ */

describe("BackgroundRunner", () => {
  it("queues a task and returns immediately", () => {
    const mock = createMockSupabase();
    const runner = new BackgroundRunner("brand-1", mock as never);

    const taskId = runner.enqueue({
      name: "analyze_creators",
      description: "Analyzing 50 creators for campaign fit",
      execute: vi.fn().mockResolvedValue({ count: 50 }),
    });

    expect(taskId).toBeTruthy();
    expect(typeof taskId).toBe("string");
  });

  it("executes tasks and notifies on completion", async () => {
    const mock = createMockSupabase();
    const runner = new BackgroundRunner("brand-1", mock as never);

    const executeFn = vi.fn().mockResolvedValue({ count: 50 });
    const onComplete = vi.fn();

    runner.enqueue({
      name: "analyze_creators",
      description: "Analyzing creators",
      execute: executeFn,
      onComplete,
    });

    // Process the queue
    await runner.processQueue();

    expect(executeFn).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ count: 50 });
  });

  it("notifies on failure", async () => {
    const mock = createMockSupabase();
    const runner = new BackgroundRunner("brand-1", mock as never);

    const onError = vi.fn();

    runner.enqueue({
      name: "failing_task",
      description: "This will fail",
      execute: vi.fn().mockRejectedValue(new Error("API down")),
      onError,
    });

    await runner.processQueue();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("creates notification on task completion", async () => {
    const mock = createMockSupabase();
    const runner = new BackgroundRunner("brand-1", mock as never);

    runner.enqueue({
      name: "bulk_outreach",
      description: "Drafting outreach for 15 creators",
      execute: vi.fn().mockResolvedValue({ drafted: 15 }),
    });

    await runner.processQueue();

    // Should have inserted a notification
    expect(mock._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        type: "background_task_completed",
      })
    );
  });

  it("processes multiple tasks in order", async () => {
    const mock = createMockSupabase();
    const runner = new BackgroundRunner("brand-1", mock as never);
    const order: string[] = [];

    runner.enqueue({
      name: "task_1",
      description: "First",
      execute: vi.fn().mockImplementation(async () => {
        order.push("task_1");
        return {};
      }),
    });

    runner.enqueue({
      name: "task_2",
      description: "Second",
      execute: vi.fn().mockImplementation(async () => {
        order.push("task_2");
        return {};
      }),
    });

    await runner.processQueue();

    expect(order).toEqual(["task_1", "task_2"]);
  });

  it("returns queue status", () => {
    const mock = createMockSupabase();
    const runner = new BackgroundRunner("brand-1", mock as never);

    expect(runner.queueLength).toBe(0);

    runner.enqueue({
      name: "task_1",
      description: "Test",
      execute: vi.fn().mockResolvedValue({}),
    });

    expect(runner.queueLength).toBe(1);
  });
});
