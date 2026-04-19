import { describe, it, expect, vi } from "vitest";
import { proposeOutreachTool } from "../propose-outreach";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function mockQueryBuilder(data: MockRow[] | null = [], error: unknown = null) {
  let isSingle = false;
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "in", "gte", "lte", "ilike", "or",
    "order", "limit",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockImplementation(() => {
    isSingle = true;
    return builder;
  });
  builder.then = (resolve: (v: unknown) => void) => {
    if (isSingle) {
      const singleData =
        Array.isArray(data) && data.length > 0 ? data[0] : null;
      resolve({ data: singleData, error });
    } else {
      resolve({ data, error });
    }
  };
  return builder;
}

type SupabaseParam = Parameters<typeof proposeOutreachTool>[1];

const execOpts = {
  toolCallId: "tc",
  messages: [],
  abortSignal: undefined as never,
};

/* ── Test data ─────────────────────────────────────────────── */

const draftMessage = {
  id: "msg-1",
  creator_id: "c1",
  campaign_id: "camp-1",
  subject: "Collab opportunity with GlowUp",
  body: "Hi Priya, we love your content and would like to collaborate on our upcoming summer campaign...",
  recipient_email: "priya@email.com",
  status: "draft",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("propose-outreach", () => {
  const brandId = "brand-1";

  it("returns error when draft message not found", async () => {
    const supabase = {
      from: vi.fn(() => mockQueryBuilder([])),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    const result = await t.execute(
      { message_id: "nonexistent" },
      execOpts
    );
    expect(result).toHaveProperty("error", "Draft message not found");
  });

  it("returns error when message is not in draft status", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([{ ...draftMessage, status: "sent" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    const result = (await t.execute(
      { message_id: "msg-1" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain("'sent' status");
    expect(result.error).toContain("not 'draft'");
  });

  it("returns error when message is in approved status", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([{ ...draftMessage, status: "approved" }]);
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    const result = (await t.execute(
      { message_id: "msg-1" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain("'approved' status");
  });

  it("creates approval queue item and notification on success", async () => {
    const insertedApproval: MockRow[] = [];
    const insertedNotification: MockRow[] = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([draftMessage]);
        }
        if (table === "creators") {
          return mockQueryBuilder([{ handle: "fit_priya" }]);
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockImplementation((data: MockRow) => {
            insertedApproval.push(data);
            return mockQueryBuilder([{ id: "approval-1" }]);
          });
          return builder;
        }
        if (table === "notifications") {
          const builder = mockQueryBuilder([]);
          builder.insert = vi.fn().mockImplementation((data: MockRow) => {
            insertedNotification.push(data);
            return { then: (r: (v: unknown) => void) => r({ error: null }) };
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    const result = (await t.execute(
      { message_id: "msg-1", reasoning: "Strong match score" },
      execOpts
    )) as {
      approval_id: string;
      status: string;
      message: string;
      creator_handle: string;
      subject: string;
    };

    expect(result.approval_id).toBe("approval-1");
    expect(result.status).toBe("pending");
    expect(result.message).toContain("@fit_priya");
    expect(result.message).toContain("submitted for your approval");
    expect(result.creator_handle).toBe("fit_priya");
    expect(result.subject).toBe("Collab opportunity with GlowUp");

    // Verify approval_queue insert
    expect(insertedApproval).toHaveLength(1);
    const approvalPayload = insertedApproval[0] as Record<string, unknown>;
    expect(approvalPayload.brand_id).toBe("brand-1");
    expect(approvalPayload.action_type).toBe("send_outreach");
    expect(approvalPayload.status).toBe("pending");
    expect(approvalPayload.title).toContain("@fit_priya");
    expect(approvalPayload.reasoning).toBe("Strong match score");

    // Verify notification insert
    expect(insertedNotification).toHaveLength(1);
    const notifPayload = insertedNotification[0] as Record<string, unknown>;
    expect(notifPayload.brand_id).toBe("brand-1");
    expect(notifPayload.type).toBe("approval_pending");
    expect(notifPayload.title).toBe("Outreach draft ready for review");
    expect((notifPayload.body as string)).toContain("@fit_priya");
  });

  it("uses default reasoning when none provided", async () => {
    const insertedApproval: MockRow[] = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([draftMessage]);
        }
        if (table === "creators") {
          return mockQueryBuilder([{ handle: "fit_priya" }]);
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockImplementation((data: MockRow) => {
            insertedApproval.push(data);
            return mockQueryBuilder([{ id: "approval-1" }]);
          });
          return builder;
        }
        if (table === "notifications") {
          const builder = mockQueryBuilder([]);
          builder.insert = vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ error: null }),
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    await t.execute({ message_id: "msg-1" }, execOpts);

    expect(insertedApproval).toHaveLength(1);
    const approvalPayload = insertedApproval[0] as Record<string, unknown>;
    expect(approvalPayload.reasoning).toBe(
      "Agent-drafted outreach based on creator intelligence and brand context."
    );
  });

  it("uses fallback 'creator' when creator_id is null", async () => {
    const messageWithoutCreator = { ...draftMessage, creator_id: null };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([messageWithoutCreator]);
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockReturnValue(mockQueryBuilder([{ id: "approval-1" }]));
          return builder;
        }
        if (table === "notifications") {
          const builder = mockQueryBuilder([]);
          builder.insert = vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ error: null }),
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    const result = (await t.execute(
      { message_id: "msg-1" },
      execOpts
    )) as { creator_handle: string; message: string };

    expect(result.creator_handle).toBe("creator");
    expect(result.message).toContain("@creator");
  });

  it("uses fallback 'creator' when creator lookup returns null", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([draftMessage]);
        }
        if (table === "creators") {
          return mockQueryBuilder([]); // creator not found
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockReturnValue(mockQueryBuilder([{ id: "approval-1" }]));
          return builder;
        }
        if (table === "notifications") {
          const builder = mockQueryBuilder([]);
          builder.insert = vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ error: null }),
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    const result = (await t.execute(
      { message_id: "msg-1" },
      execOpts
    )) as { creator_handle: string };

    expect(result.creator_handle).toBe("creator");
  });

  it("returns error when approval_queue insert fails", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([draftMessage]);
        }
        if (table === "creators") {
          return mockQueryBuilder([{ handle: "fit_priya" }]);
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder(
            null,
            { message: "Unique constraint violation" }
          );
          builder.insert = vi.fn().mockReturnValue(
            mockQueryBuilder(null, { message: "Unique constraint violation" })
          );
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    const result = (await t.execute(
      { message_id: "msg-1" },
      execOpts
    )) as { error: string };

    expect(result.error).toContain("Failed to create approval");
    expect(result.error).toContain("Unique constraint violation");
  });

  it("truncates body preview to 300 characters in approval payload", async () => {
    const longBody = "A".repeat(500);
    const messageWithLongBody = { ...draftMessage, body: longBody };
    const insertedApproval: MockRow[] = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([messageWithLongBody]);
        }
        if (table === "creators") {
          return mockQueryBuilder([{ handle: "fit_priya" }]);
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockImplementation((data: MockRow) => {
            insertedApproval.push(data);
            return mockQueryBuilder([{ id: "approval-1" }]);
          });
          return builder;
        }
        if (table === "notifications") {
          const builder = mockQueryBuilder([]);
          builder.insert = vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ error: null }),
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    await t.execute({ message_id: "msg-1" }, execOpts);

    const payload = (insertedApproval[0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect((payload.body_preview as string).length).toBe(300);
  });

  it("handles null body gracefully (empty body_preview)", async () => {
    const messageWithNullBody = { ...draftMessage, body: null };
    const insertedApproval: MockRow[] = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([messageWithNullBody]);
        }
        if (table === "creators") {
          return mockQueryBuilder([{ handle: "fit_priya" }]);
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder([{ id: "approval-1" }]);
          builder.insert = vi.fn().mockImplementation((data: MockRow) => {
            insertedApproval.push(data);
            return mockQueryBuilder([{ id: "approval-1" }]);
          });
          return builder;
        }
        if (table === "notifications") {
          const builder = mockQueryBuilder([]);
          builder.insert = vi.fn().mockReturnValue({
            then: (r: (v: unknown) => void) => r({ error: null }),
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    await t.execute({ message_id: "msg-1" }, execOpts);

    const payload = (insertedApproval[0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect(payload.body_preview).toBe("");
  });

  it("includes correct metadata in notification", async () => {
    const insertedNotification: MockRow[] = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "outreach_messages") {
          return mockQueryBuilder([draftMessage]);
        }
        if (table === "creators") {
          return mockQueryBuilder([{ handle: "fit_priya" }]);
        }
        if (table === "approval_queue") {
          const builder = mockQueryBuilder([{ id: "approval-42" }]);
          builder.insert = vi.fn().mockReturnValue(
            mockQueryBuilder([{ id: "approval-42" }])
          );
          return builder;
        }
        if (table === "notifications") {
          const builder = mockQueryBuilder([]);
          builder.insert = vi.fn().mockImplementation((data: MockRow) => {
            insertedNotification.push(data);
            return { then: (r: (v: unknown) => void) => r({ error: null }) };
          });
          return builder;
        }
        return mockQueryBuilder([]);
      }),
    } as unknown as SupabaseParam;

    const t = proposeOutreachTool(brandId, supabase);
    await t.execute({ message_id: "msg-1" }, execOpts);

    expect(insertedNotification).toHaveLength(1);
    const notif = insertedNotification[0] as Record<string, unknown>;
    expect(notif.link).toBe("/approvals");
    expect((notif.metadata as { approval_id: string }).approval_id).toBe("approval-42");
  });
});
