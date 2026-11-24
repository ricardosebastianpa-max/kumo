"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { assertCan } from "@/lib/domain/permissions";
import { audit } from "@/lib/server/audit";

async function own(id: string) {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "study" });
  const [r] = await db.select().from(s.studyResource).where(and(eq(s.studyResource.id, id), eq(s.studyResource.workspaceId, ctx.workspace.id)));
  if (!r) throw new Error("not found");
  return { ctx, r };
}

export async function setStudyDone(id: string, done: boolean) {
  const { ctx, r } = await own(id);
  await db.update(s.studyResource).set({ done, doneAt: done ? new Date() : null }).where(eq(s.studyResource.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: done ? "complete" : "reopen", resourceType: "study_resource", resourceId: id, diff: { done: { from: r.done, to: done } } });
  revalidatePath("/app", "layout");
}

const Patch = z.object({ notes: z.string().max(2000).nullable().optional(), url: z.string().trim().url().max(500).refine((u) => /^https?:\/\//.test(u)).optional() });
export async function saveStudy(id: string, raw: z.input<typeof Patch>) {
  const { ctx } = await own(id);
  const v = Patch.parse(raw);
  await db.update(s.studyResource).set({ ...(v.notes !== undefined && { notes: v.notes }), ...(v.url && { url: v.url, urlIsSearch: false }) }).where(eq(s.studyResource.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "study_resource", resourceId: id, meta: { fields: Object.keys(v) } });
  revalidatePath("/app/study");
}
