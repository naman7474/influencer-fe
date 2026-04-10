import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkDeadlineAlerts,
  checkBudgetAlerts,
  checkPerformanceAlerts,
  type Alert,
} from "../alerts";

/* ------------------------------------------------------------------ */
/*  Mock Supabase                                                      */
/* ------------------------------------------------------------------ */

function createMockSupabase(mockData: Record<string, unknown[]>) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const data = mockData[table] || [];
      const makeChainable = (): Record<string, unknown> => {
        const obj: Record<string, unknown> = {};
        for (const method of ["select", "eq", "gte", "lte", "lt", "in", "order", "limit"]) {
          obj[method] = vi.fn().mockImplementation(() => makeChainable());
        }
        obj.then = (resolve: (v: unknown) => void) =>
          resolve({ data, error: null });
        return obj;
      };
      return makeChainable();
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Deadline Alerts                                                    */
/* ------------------------------------------------------------------ */

describe("checkDeadlineAlerts", () => {
  it("alerts when campaign creators haven't posted near deadline", async () => {
    const fiveDaysFromNow = new Date(Date.now() + 5 * 86400000).toISOString();
    const mock = createMockSupabase({
      campaigns: [
        {
          id: "camp-1",
          name: "Summer Collection",
          end_date: fiveDaysFromNow,
          status: "active",
        },
      ],
      campaign_creators: [
        { creator_id: "cr-1", status: "confirmed", content_status: "pending" },
        { creator_id: "cr-2", status: "confirmed", content_status: "pending" },
        { creator_id: "cr-3", status: "confirmed", content_status: "posted" },
      ],
    });

    const alerts = await checkDeadlineAlerts("brand-1", mock as never);

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].message).toContain("Summer Collection");
  });

  it("returns no alerts when all creators have posted", async () => {
    const fiveDaysFromNow = new Date(Date.now() + 5 * 86400000).toISOString();
    const mock = createMockSupabase({
      campaigns: [
        {
          id: "camp-1",
          name: "Summer",
          end_date: fiveDaysFromNow,
          status: "active",
        },
      ],
      campaign_creators: [
        { creator_id: "cr-1", status: "confirmed", content_status: "posted" },
      ],
    });

    const alerts = await checkDeadlineAlerts("brand-1", mock as never);
    expect(alerts).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Budget Alerts                                                      */
/* ------------------------------------------------------------------ */

describe("checkBudgetAlerts", () => {
  it("alerts when budget usage exceeds 80% with timeline remaining", async () => {
    const tenDaysFromNow = new Date(Date.now() + 10 * 86400000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();

    const mock = createMockSupabase({
      campaigns: [
        {
          id: "camp-1",
          name: "Summer",
          total_budget: 200000,
          budget_spent: 170000,
          start_date: tenDaysAgo,
          end_date: tenDaysFromNow,
          status: "active",
        },
      ],
    });

    const alerts = await checkBudgetAlerts("brand-1", mock as never);

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].message).toContain("budget");
  });

  it("returns no alerts for healthy budget pacing", async () => {
    const tenDaysFromNow = new Date(Date.now() + 10 * 86400000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();

    const mock = createMockSupabase({
      campaigns: [
        {
          id: "camp-1",
          name: "Summer",
          total_budget: 200000,
          budget_spent: 50000,
          start_date: tenDaysAgo,
          end_date: tenDaysFromNow,
          status: "active",
        },
      ],
    });

    const alerts = await checkBudgetAlerts("brand-1", mock as never);
    expect(alerts).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Performance Alerts                                                 */
/* ------------------------------------------------------------------ */

describe("checkPerformanceAlerts", () => {
  it("alerts on high-performing content", async () => {
    const mock = createMockSupabase({
      campaign_performance_summary: [
        {
          campaign_id: "camp-1",
          creator_id: "cr-1",
          campaign_orders: 50,
          campaign_revenue: 250000,
        },
      ],
      campaigns: [{ id: "camp-1", name: "Summer" }],
      creators: [{ id: "cr-1", handle: "priya_fitness" }],
    });

    const alerts = await checkPerformanceAlerts("brand-1", mock as never);

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe("info");
    expect(alerts[0].type).toBe("performance_highlight");
  });
});
