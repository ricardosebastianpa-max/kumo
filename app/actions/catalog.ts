"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { assertCan } from "@/lib/domain/permissions";
import { audit, diff } from "@/lib/server/audit";

const num = z.coerce.number().finite().min(0).max(10_000_000);
const InstPatch = z.object({
  tuitionYear: num.nullable(), livingMonth: num.nullable(), admissionLow: z.coerce.number().min(0).max(100).nullable(), admissionHigh: z.coerce.number().min(0).max(100).nullable(),
  confidence: z.enum(["confirmed", "estimated", "unverified"]), notes: z.string().max(4000),
});
/** Edits the inputs that drive the score; every change is audited and the score recomputes on next render. */
export async function updateInstitution(slug: string, raw: z.input<typeof InstPatch>) {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "catalog" });
  const v = InstPatch.parse(raw);
  const [row] = await db.select().from(s.institution).where(and(eq(s.institution.workspaceId, ctx.workspace.id), eq(s.institution.slug, slug)));
  if (!row) throw new Error("not found");
  const finance = { ...(row.finance ?? {}), tuitionYear: v.tuitionYear, ...(v.tuitionYear !== (row.finance as { tuitionYear?: number } | null)?.tuitionYear ? { tuitionEstimated: false } : {}) };
  const costOfLiving = v.livingMonth == null ? null : { currency: row.costOfLiving?.currency ?? (row.finance as { currency?: string } | null)?.currency ?? "USD", month: v.livingMonth };
  const admission = { ...(row.admission ?? {}), low: v.admissionLow, high: v.admissionHigh };
  const details = { ...(row.details ?? {}), notes: v.notes || null };
  const next = { finance, costOfLiving, admission, details, confidence: v.confidence };
  const d = diff(row as unknown as Record<string, unknown>, next);
  if (!Object.keys(d).length) return;
  await db.update(s.institution).set(next).where(eq(s.institution.id, row.id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "institution", resourceId: row.id, diff: d });
  revalidatePath("/app/universities", "layout");
}
