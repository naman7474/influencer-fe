import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update" | "delete" | "upsert";

interface QueryState {
  table: string;
  op: Op;
  filters: Array<[string, unknown]>;
  payload?: Row | Row[];
  isFilters: Array<[string, unknown]>;
}

let store: Record<string, Row[]> = {};

function makeQuery(table: string): QueryState & { _result: () => Promise<{ data: Row | Row[] | null; error: null }>; } {
  const state: QueryState = { table, op: "select", filters: [], isFilters: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: () => builder,
    insert: (p: Row | Row[]) => {
      state.op = "insert";
      state.payload = p;
      return builder;
    },
    update: (p: Row) => {
      state.op = "update";
      state.payload = p;
      return builder;
    },
    upsert: (p: Row, _opts?: unknown) => {
      state.op = "upsert";
      state.payload = p;
      return builder;
    },
    delete: () => {
      state.op = "delete";
      return builder;
    },
    eq: (k: string, v: unknown) => {
      state.filters.push([k, v]);
      return builder;
    },
    is: (k: string, v: unknown) => {
      state.isFilters.push([k, v]);
      return builder;
    },
    maybeSingle: async () => execute(state),
    single: async () => execute(state),
  };
  return builder;
}

async function execute(state: QueryState) {
  const rows = store[state.table] ?? [];
  if (state.op === "select") {
    const filtered = rows.filter((r) => {
      for (const [k, v] of state.filters) if (r[k] !== v) return false;
      for (const [k, v] of state.isFilters) {
        if (v === null && r[k] != null) return false;
      }
      return true;
    });
    return { data: filtered[0] ?? null, error: null };
  }
  if (state.op === "insert") {
    const payload = Array.isArray(state.payload) ? state.payload : [state.payload!];
    store[state.table] = [...rows, ...payload];
    return { data: payload[0], error: null };
  }
  if (state.op === "update") {
    const updated = rows.map((r) => {
      for (const [k, v] of state.filters) if (r[k] !== v) return r;
      return { ...r, ...(state.payload as Row) };
    });
    store[state.table] = updated;
    return { data: state.payload, error: null };
  }
  if (state.op === "upsert") {
    const payload = state.payload as Row;
    // naive: append; the real flow uses on-conflict updates we don't model here
    store[state.table] = [...rows, payload];
    return { data: payload, error: null };
  }
  if (state.op === "delete") {
    store[state.table] = rows.filter((r) => {
      for (const [k, v] of state.filters) if (r[k] !== v) return true;
      return false;
    });
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => makeQuery(table),
  }),
}));

import { consumeInvite } from "../team";

beforeEach(() => {
  store = { brand_invites: [], brand_members: [], profiles: [] };
});

describe("consumeInvite", () => {
  it("returns not_found for unknown token", async () => {
    const r = await consumeInvite({
      token: "missing",
      userId: "u1",
      userEmail: "a@x.com",
    });
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns already_accepted when invite was consumed", async () => {
    store.brand_invites!.push({
      id: "i1",
      brand_id: "b1",
      email: "a@x.com",
      role: "member",
      token: "tok",
      expires_at: new Date(Date.now() + 86400e3).toISOString(),
      accepted_at: new Date().toISOString(),
      invited_by: null,
    });
    const r = await consumeInvite({
      token: "tok",
      userId: "u1",
      userEmail: "a@x.com",
    });
    expect(r).toEqual({ ok: false, reason: "already_accepted" });
  });

  it("returns expired when past expiry", async () => {
    store.brand_invites!.push({
      id: "i1",
      brand_id: "b1",
      email: "a@x.com",
      role: "member",
      token: "tok",
      expires_at: new Date(Date.now() - 1000).toISOString(),
      accepted_at: null,
      invited_by: null,
    });
    const r = await consumeInvite({
      token: "tok",
      userId: "u1",
      userEmail: "a@x.com",
    });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("returns email_mismatch when user email does not match invite", async () => {
    store.brand_invites!.push({
      id: "i1",
      brand_id: "b1",
      email: "a@x.com",
      role: "member",
      token: "tok",
      expires_at: new Date(Date.now() + 86400e3).toISOString(),
      accepted_at: null,
      invited_by: null,
    });
    const r = await consumeInvite({
      token: "tok",
      userId: "u1",
      userEmail: "different@x.com",
    });
    expect(r).toEqual({ ok: false, reason: "email_mismatch" });
  });

  it("accepts a valid invite and returns ok", async () => {
    store.brand_invites!.push({
      id: "i1",
      brand_id: "b1",
      email: "a@x.com",
      role: "admin",
      token: "tok",
      expires_at: new Date(Date.now() + 86400e3).toISOString(),
      accepted_at: null,
      invited_by: null,
    });
    const r = await consumeInvite({
      token: "tok",
      userId: "u1",
      userEmail: "a@x.com",
    });
    expect(r).toEqual({ ok: true, brandId: "b1", role: "admin" });
  });
});
