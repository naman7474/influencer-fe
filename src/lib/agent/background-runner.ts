/* ------------------------------------------------------------------ */
/*  Background Task Runner                                             */
/*  Queues long-running agent tasks for async execution.              */
/*  Returns immediately so the user isn't blocked. Sends              */
/*  notifications on completion or failure.                            */
/* ------------------------------------------------------------------ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface BackgroundTask {
  name: string;
  description: string;
  execute: () => Promise<Record<string, unknown>>;
  onComplete?: (result: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
}

interface QueuedTask extends BackgroundTask {
  id: string;
  enqueuedAt: Date;
}

export class BackgroundRunner {
  private brandId: string;
  private supabase: SupabaseClient;
  private queue: QueuedTask[] = [];
  private taskCounter = 0;

  constructor(brandId: string, supabase: SupabaseClient) {
    this.brandId = brandId;
    this.supabase = supabase;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Enqueue a task for background execution.
   * Returns a task ID immediately — does not block.
   */
  enqueue(task: BackgroundTask): string {
    this.taskCounter++;
    const id = `bg-${this.taskCounter}-${Date.now()}`;

    this.queue.push({
      ...task,
      id,
      enqueuedAt: new Date(),
    });

    return id;
  }

  /**
   * Process all queued tasks sequentially.
   * Each task runs, then notifies on completion or failure.
   */
  async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await this.executeTask(task);
    }
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    try {
      const result = await task.execute();

      // Notify callback
      task.onComplete?.(result);

      // Create completion notification in DB
      await this.createNotification(
        `✅ ${task.description} — completed`,
        "background_task_completed",
        { taskId: task.id, taskName: task.name, result }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Notify callback
      task.onError?.(error);

      // Create failure notification
      await this.createNotification(
        `❌ ${task.description} — failed: ${error.message}`,
        "background_task_failed",
        { taskId: task.id, taskName: task.name, error: error.message }
      );
    }
  }

  private async createNotification(
    message: string,
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from("notifications").insert({
        brand_id: this.brandId,
        type,
        message,
        data,
      });
    } catch {
      // Notification failures shouldn't break task execution
    }
  }
}
