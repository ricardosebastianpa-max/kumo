import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { RecsView } from "./view";

export async function generateMetadata() { return { title: (await getTranslations("recs"))("title") }; }
export default async function People() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "people" })) redirect("/app");
  const h = await headers(); const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const recs = await db.select().from(s.recommender).where(and(eq(s.recommender.workspaceId, ws), isNull(s.recommender.deletedAt))).orderBy(asc(s.recommender.createdAt));
  const owner = ctx.role === "owner";
  return <RecsView canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "people" })} recs={recs.map((r) => ({ id: r.id, name: r.name, role: r.role, ask: r.ask, dueOn: r.dueOn, status: r.status, replyNote: r.replyNote, link: owner ? `${origin}/r/${r.token}` : null }))} />;
}
