import { describe, it, expect, vi } from "vitest";
import { createApprovalRequest } from "../approval-wrapper";

/* ------------------------------------------------------------------ */
/*  Mock Helpers                                                       */
/* ------------------------------------------------------------------ */

function createMockSupabase(
  approvalResult: { data: unknown; error: unknown } = { data: { id: "appr-1" }, error: null },
  notifResult: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const insertApproval = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockReturnValue({
        then: (resolve: (v: unknown) => void) => resolve(approvalResult),
      }),
    }),
  });
  const insertNotif = vi.fn().mockReturnValue({
    then: (resolve: (v: unknown) => void) => resolve(notifResult),
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "approval_queue") {
        return { insert: insertApproval };
      }
      if (table === "notifications") {
        return { insert: insertNotif };
      }
      return {};
    }),
    _insertApproval: insertApproval,
    _insertNotif: insertNotif,
  };
}

type SupabaseParam = Parameters<typeof createApprovalRequest>[0];

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("createApprovalRequest", () => {
  it("creates an approval and notification successfully", async () => {
    const mock = createMockSupabase();

    const result = await createApprovalRequest(mock as unknown as SupabaseParam, {
      brandId: "brand-1",
      actionType: "send_outreach",
      title: "Send email to @creator",
      description: "Outreach email for Summer campaign",
      reasoning: "Creator matches brand niche",
      payload: { message_id: "msg-1" },
      creatorId: "c1",
      campaignId: "camp-1",
    });

    expect("approval_id" in result).toBe(true);
    if ("approval_id" in result) {
      expect(result.approval_id).toBe("appr-1");
      expect(result.status).toBe("pending");
      expect(result.message).toContain("approval");
    }

    // Verify approval insert
    expect(mock._insertApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        action_type: "send_outreach",
        status: "pending",
        creator_id: "c1",
        campaign_id: "camp-1",
      })
    );

    // Verify notification insert
    expect(mock._insertNotif).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        type: "approval_pending",
        title: "Send email to @creator",
        metadata: { approval_id: "appr-1" },
      })
    );
  });

  it("returns error when approval insert fails", async () => {
    const mock = createMockSupabase({
      data: null,
      error: { message: "DB constraint violation" },
    });

    const result = await createApprovalRequest(mock as unknown as SupabaseParam, {
      brandId: "brand-1",
      actionType: "send_outreach",
      title: "Test",
      description: "Test",
      reasoning: "Test",
      payload: {},
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Failed to create approval");
      expect(result.error).toContain("DB constraint violation");
    }
  });

  it("handles null optional fields", async () => {
    const mock = createMockSupabase();

    const result = await createApprovalRequest(mock as unknown as SupabaseParam, {
      brandId: "brand-1",
      actionType: "create_campaign",
      title: "Create campaign",
      description: "New campaign",
      reasoning: "Budget approved",
      payload: { campaign_name: "Winter" },
      creatorId: null,
      campaignId: null,
      messageId: null,
    });

    expect("approval_id" in result).toBe(true);

    expect(mock._insertApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: null,
        campaign_id: null,
        message_id: null,
      })
    );
  });

  it("handles undefined optional fields (defaults to null)", async () => {
    const mock = createMockSupabase();

    await createApprovalRequest(mock as unknown as SupabaseParam, {
      brandId: "brand-1",
      actionType: "test",
      title: "Test",
      description: "Test",
      reasoning: "Test",
      payload: {},
    });

    expect(mock._insertApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: null,
        campaign_id: null,
        message_id: null,
      })
    );
  });
});
