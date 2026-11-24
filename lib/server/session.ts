import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import type { Actor, Role } from "@/lib/domain/permissions";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export const WS_COOKIE = "kumo_ws";

/** The workspace the user is acting in: cookie choice if they are a member, else their first membership. */
export const getContext = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const mems = await db
    .select({ m: s.membership, w: s.workspace })
    .from(s.membership)
    .innerJoin(s.workspace, eq(s.workspace.id, s.membership.workspaceId))
    .where(and(eq(s.membership.userId, session.user.id), isNull(s.workspace.deletedAt)))
    .orderBy(asc(s.membership.createdAt));
  const wanted = (await cookies()).get(WS_COOKIE)?.value;
  const cur = mems.find((x) => x.w.id === wanted) ?? mems.find((x) => x.m.role === "owner") ?? mems[0];
  const [u] = await db.select({ isPlatformAdmin: s.user.isPlatformAdmin }).from(s.user).where(eq(s.user.id, session.user.id));
  const actor: Actor = {
    userId: session.user.id,
    isPlatformAdmin: u?.isPlatformAdmin,
    membership: cur ? { workspaceId: cur.w.id, role: cur.m.role as Role, permissions: cur.m.permissions } : null,
  };
  return { user: session.user, workspace: cur?.w ?? null, role: (cur?.m.role ?? null) as Role | null, memberships: mems, actor };
});

export async function requireWorkspace() {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (!ctx.workspace) redirect("/onboarding");
  return ctx as typeof ctx & { workspace: NonNullable<typeof ctx.workspace>; role: Role };
}
