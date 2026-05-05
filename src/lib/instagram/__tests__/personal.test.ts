import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

import { validatePersonalToken } from "../personal";

describe("validatePersonalToken", () => {
  it("accepts a graph_basic token whose username matches", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "igid_123", username: "naman" }),
    });
    const r = await validatePersonalToken({
      token: "tok",
      username: "naman",
    });
    expect(r).toEqual({
      ok: true,
      ig_user_id: "igid_123",
      ig_username: "naman",
      personal_token_kind: "graph_basic",
    });
  });

  it("rejects when username mismatches", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "igid_123", username: "someone_else" }),
    });
    const r = await validatePersonalToken({
      token: "tok",
      username: "naman",
    });
    expect(r).toEqual({ ok: false, reason: "username_mismatch" });
  });

  it("rejects when explicit graph_basic hint and probe fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "bad token" } }),
    });
    const r = await validatePersonalToken({
      token: "tok",
      username: "naman",
      hint: "graph_basic",
    });
    expect(r).toEqual({ ok: false, reason: "token_invalid" });
  });

  it("trusts session-token hint without probing", async () => {
    const r = await validatePersonalToken({
      token: "session-cookie",
      username: "naman",
      hint: "session",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.personal_token_kind).toBe("session");
      expect(r.ig_username).toBe("naman");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
