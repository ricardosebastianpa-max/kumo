import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { dateInZone } from "@/lib/domain/time";
import { DocsView } from "./view";

export async function generateMetadata() { return { title: (await getTranslations("docs"))("title") }; }
export default async function Documents() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "documents" })) redirect("/app");
  const docs = await db.select({ id: s.document.id, name: s.document.name, status: s.document.status, expiresOn: s.document.expiresOn, notes: s.document.notes }).from(s.document).where(and(eq(s.document.workspaceId, ws), isNull(s.document.deletedAt))).orderBy(asc(s.document.createdAt));
  const owner = ctx.role === "owner";
  return <DocsView docs={docs.map((d) => (owner ? d : { ...d, notes: null }))} canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "documents" })} today={dateInZone(new Date(), ctx.user.timezone || ctx.workspace.timezone)} />;
}
