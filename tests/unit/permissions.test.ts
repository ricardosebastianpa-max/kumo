import { describe, expect, it } from "vitest";
import { can, MODULES, type Actor, type Role } from "@/lib/domain/permissions";

const ws = "ws1";
const actor = (role: Role, permissions?: Record<string, string[]>): Actor => ({ userId: "u", membership: { workspaceId: ws, role, permissions } });

describe("can()", () => {
  it("owner can do everything in their workspace", () => {
    for (const m of MODULES) for (const a of ["view", "comment", "edit", "approve", "manage"] as const) expect(can(actor("owner"), a, { workspaceId: ws, module: m })).toBe(true);
  });
  it("nobody acts on another workspace", () => {
    expect(can(actor("owner"), "view", { workspaceId: "other", module: "calendar" })).toBe(false);
    expect(can({ userId: "u" }, "view", { workspaceId: ws, module: "calendar" })).toBe(false);
  });
  it("guardian sees and approves finance, but cannot edit", () => {
    const g = actor("guardian");
    expect(can(g, "view", { workspaceId: ws, module: "finance" })).toBe(true);
    expect(can(g, "approve", { workspaceId: ws, module: "finance" })).toBe(true);
    expect(can(g, "edit", { workspaceId: ws, module: "calendar" })).toBe(false);
  });
  it("journal and wellbeing are private even with overrides", () => {
    const g = actor("guardian", { journal: ["view"], wellbeing: ["view"] });
    expect(can(g, "view", { workspaceId: ws, module: "journal" })).toBe(false);
    expect(can(g, "view", { workspaceId: ws, module: "wellbeing" })).toBe(false);
  });
  it("writing drafts are hidden from guardian by default, visible to mentor", () => {
    expect(can(actor("guardian"), "view", { workspaceId: ws, module: "writing" })).toBe(false);
    expect(can(actor("mentor"), "comment", { workspaceId: ws, module: "writing" })).toBe(true);
  });
  it("per-item privacy flag hides an item from a role", () => {
    expect(can(actor("guardian"), "view", { workspaceId: ws, module: "calendar", hiddenFrom: ["guardian"] })).toBe(false);
    expect(can(actor("owner"), "view", { workspaceId: ws, module: "calendar", hiddenFrom: ["guardian"] })).toBe(true);
  });
  it("overrides can grant edit but never manage", () => {
    const g = actor("guardian", { calendar: ["view", "edit", "manage"] });
    expect(can(g, "edit", { workspaceId: ws, module: "calendar" })).toBe(true);
    expect(can(g, "manage", { workspaceId: ws, module: "calendar" })).toBe(false);
  });
  it("public catalog: view for all, edit only for platform admin", () => {
    expect(can(actor("guardian"), "view", { workspaceId: null, module: "catalog" })).toBe(true);
    expect(can(actor("owner"), "edit", { workspaceId: null, module: "catalog" })).toBe(false);
    expect(can({ userId: "a", isPlatformAdmin: true }, "edit", { workspaceId: null, module: "catalog" })).toBe(true);
  });
  it("recommender has no workspace access", () => {
    for (const m of MODULES) expect(can(actor("recommender"), "view", { workspaceId: ws, module: m })).toBe(false);
  });
});
