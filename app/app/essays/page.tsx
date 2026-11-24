import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { EssaysClient } from "./client";

export async function generateMetadata() { return { title: (await getTranslations("essays"))("title") }; }
export default async function Essays() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "writing" })) redirect("/app");
  const rows = await db.select().from(s.essay).where(and(eq(s.essay.workspaceId, ws), isNull(s.essay.deletedAt))).orderBy(desc(s.essay.updatedAt));
  return <EssaysClient essays={rows.map((e) => ({ id: e.id, title: e.title, prompt: e.prompt, wordLimit: e.wordLimit, body: e.body, versions: e.versions }))} canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "writing" })} canCoach={can(ctx.actor, "comment", { workspaceId: ws, module: "writing" })} aiOn={!!process.env.ANTHROPIC_API_KEY} />;
}
