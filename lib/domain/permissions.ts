/**
 * Central authorization. Every server action and route asks `can()`; components never check roles.
 * Pure function, no I/O: callers load the membership and the resource first.
 */
export type Role = "owner" | "guardian" | "mentor" | "recommender";
export type Action = "view" | "comment" | "edit" | "approve" | "manage";
export type Module =
  | "today" | "calendar" | "catalog" | "list" | "applications" | "documents" | "people"
  | "finance" | "study" | "writing" | "wellbeing" | "journal" | "settings" | "members" | "audit";

export const MODULES: Module[] = [
  "today", "calendar", "catalog", "list", "applications", "documents", "people",
  "finance", "study", "writing", "wellbeing", "journal", "settings", "members", "audit",
];

/** Role defaults. The student can override any non-owner membership per module. */
export const ROLE_DEFAULTS: Record<Role, Partial<Record<Module, Action[]>>> = {
  owner: Object.fromEntries(MODULES.map((m) => [m, ["view", "comment", "edit", "approve", "manage"]])) as Record<Module, Action[]>,
  guardian: {
    today: ["view"], calendar: ["view"], catalog: ["view", "comment"], list: ["view", "comment"],
    applications: ["view", "comment", "approve"], documents: ["view"], people: ["view"],
    finance: ["view", "comment", "approve"], study: ["view"],
  },
  mentor: {
    today: ["view"], calendar: ["view"], catalog: ["view", "comment"], list: ["view", "comment"],
    applications: ["view", "comment"], writing: ["view", "comment"], study: ["view"],
  },
  recommender: {},
};

/** Modules that are private to the student no matter what the matrix says. */
export const ALWAYS_PRIVATE: Module[] = ["journal", "wellbeing"];

export interface Actor {
  userId: string;
  isPlatformAdmin?: boolean;
  membership?: { workspaceId: string; role: Role; permissions?: Record<string, string[]> | null } | null;
}
export interface Resource {
  workspaceId: string | null; // null = public catalog
  module: Module;
  /** Roles this specific item is hidden from (privacy_flag), if any. */
  hiddenFrom?: string[] | null;
}

export function allowedActions(role: Role, module: Module, overrides?: Record<string, string[]> | null): Action[] {
  if (role === "owner") return ROLE_DEFAULTS.owner[module] ?? [];
  if (ALWAYS_PRIVATE.includes(module)) return [];
  const o = overrides?.[module];
  const list = (o ?? ROLE_DEFAULTS[role][module] ?? []) as Action[];
  // "manage" (members, settings, deletes) is owner-only, whatever the overrides say.
  return list.filter((a) => a !== "manage");
}

export function can(actor: Actor, action: Action, resource: Resource): boolean {
  // Public catalog rows: anyone signed in can view; only platform admins change them.
  if (resource.workspaceId === null) {
    if (action === "view") return true;
    return !!actor.isPlatformAdmin;
  }
  const m = actor.membership;
  if (!m || m.workspaceId !== resource.workspaceId) return false;
  if (m.role !== "owner" && resource.hiddenFrom?.includes(m.role)) return false;
  return allowedActions(m.role, resource.module, m.permissions).includes(action);
}

export class ForbiddenError extends Error {
  constructor(public action: Action, public module: Module) {
    super(`forbidden: ${action} on ${module}`);
  }
}
export function assertCan(actor: Actor, action: Action, resource: Resource): void {
  if (!can(actor, action, resource)) throw new ForbiddenError(action, resource.module);
}
