import { describe, it, expect } from "vitest";
import { hasRoleAtLeast } from "../membership";

describe("hasRoleAtLeast", () => {
  it("owner satisfies all minimums", () => {
    expect(hasRoleAtLeast("owner", "member")).toBe(true);
    expect(hasRoleAtLeast("owner", "admin")).toBe(true);
    expect(hasRoleAtLeast("owner", "owner")).toBe(true);
  });

  it("admin satisfies admin and member", () => {
    expect(hasRoleAtLeast("admin", "member")).toBe(true);
    expect(hasRoleAtLeast("admin", "admin")).toBe(true);
    expect(hasRoleAtLeast("admin", "owner")).toBe(false);
  });

  it("member satisfies only member", () => {
    expect(hasRoleAtLeast("member", "member")).toBe(true);
    expect(hasRoleAtLeast("member", "admin")).toBe(false);
    expect(hasRoleAtLeast("member", "owner")).toBe(false);
  });
});
