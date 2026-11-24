"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { assertCan } from "@/lib/domain/permissions";
import { isValidTimeZone, zonedToUtc } from "@/lib/domain/time";
import { audit, diff } from "@/lib/server/audit";

export type Stage = "exploring" | "shortlist" | "pursuing" | "discarded";
const STAGES = ["exploring", "shortlist", "pursuing", "discarded"] as const;
const RefKind = z.enum(["institution", "scholarship"]);
const refresh = () => revalidatePath("/app", "layout");

async function ctxFor(module: "list" | "catalog" | "calendar") {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module });
  return ctx;
}

/** Finds (or creates) the student's list row for an institution or scholarship. */
async function itemFor(ws: string, userId: string, kind: "institution" | "scholarship", refId: string) {
  const col = kind === "institution" ? s.targetListItem.institutionId : s.targetListItem.scholarshipId;
  const [row] = await db.select().from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ws), eq(s.targetListItem.list, "main"), eq(col, refId), isNull(s.targetListItem.deletedAt))).limit(1);
  if (row) return row;
  const table = kind === "institution" ? s.institution : s.scholarship;
  const [ref] = await db.select({ name: table.name }).from(table).where(and(eq(table.id, refId), eq(table.workspaceId, ws)));
  if (!ref) throw new Error("not found");
  const [created] = await db.insert(s.targetListItem).values({ workspaceId: ws, list: "main", label: ref.name, status: "exploring", createdBy: userId, ...(kind === "institution" ? { institutionId: refId } : { scholarshipId: refId }) }).returning();
  return created;
}

export async function setStage(kind: "institution" | "scholarship", refId: string, stage: Stage) {
  const ctx = await ctxFor("list");
  RefKind.parse(kind); z.enum(STAGES).parse(stage);
  const item = await itemFor(ctx.workspace.id, ctx.user.id, kind, refId);
  if (item.status === stage) return;
  const [{ m }] = await db.select({ m: max(s.targetListItem.position) }).from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ctx.workspace.id), eq(s.targetListItem.status, stage)));
  await db.update(s.targetListItem).set({ status: stage, position: (m ?? 0) + 1 }).where(eq(s.targetListItem.id, item.id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "target_list_item", resourceId: item.id, diff: { status: { from: item.status, to: stage } } });
  refresh();
}

const Ponder = z.object({
  gut: z.number().int().min(1).max(5).nullable().optional(),
  pros: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  cons: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  notes: z.string().max(4000).nullable().optional(),
});
export async function ponder(kind: "institution" | "scholarship", refId: string, raw: z.input<typeof Ponder>) {
  const ctx = await ctxFor("list");
  const v = Ponder.parse(raw);
  const item = await itemFor(ctx.workspace.id, ctx.user.id, RefKind.parse(kind), refId);
  const d = diff(item as unknown as Record<string, unknown>, v);
  if (!Object.keys(d).length) return;
  await db.update(s.targetListItem).set(v).where(eq(s.targetListItem.id, item.id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "target_list_item", resourceId: item.id, diff: d });
  refresh();
}

/* ── Photos ─────────────────────────────────────────────────────────── */
const MAX_BYTES = 450 * 1024;
export async function uploadPhoto(form: FormData): Promise<{ ok: boolean; error?: "type" | "size" }> {
  const ctx = await ctxFor("catalog");
  const kind = RefKind.parse(form.get("kind"));
  const refId = z.string().min(1).parse(form.get("refId"));
  const file = form.get("file");
  if (!(file instanceof Blob)) return { ok: false, error: "type" };
  if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) return { ok: false, error: "type" };
  if (file.size > MAX_BYTES) return { ok: false, error: "size" };
  const table = kind === "institution" ? s.institution : s.scholarship;
  const [ref] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, refId), eq(table.workspaceId, ctx.workspace.id)));
  if (!ref) throw new Error("not found");
  const existing = await db.select({ id: s.media.id }).from(s.media).where(and(eq(s.media.resourceType, kind), eq(s.media.resourceId, refId), isNull(s.media.deletedAt))).limit(1);
  const [m] = await db.insert(s.media).values({
    workspaceId: ctx.workspace.id, resourceType: kind, resourceId: refId, mime: file.type, bytes: Buffer.from(await file.arrayBuffer()),
    width: Number(form.get("w")) || null, height: Number(form.get("h")) || null, caption: (form.get("caption") as string | null)?.slice(0, 200) || null,
    isCover: existing.length === 0, createdBy: ctx.user.id,
  }).returning({ id: s.media.id });
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "create", resourceType: "media", resourceId: m.id, meta: { kind, refId } });
  refresh();
  return { ok: true };
}
async function ownedMedia(id: string) {
  const ctx = await ctxFor("catalog");
  const [m] = await db.select({ id: s.media.id, resourceType: s.media.resourceType, resourceId: s.media.resourceId }).from(s.media).where(and(eq(s.media.id, id), eq(s.media.workspaceId, ctx.workspace.id)));
  if (!m) throw new Error("not found");
  return { ctx, m };
}
export async function setCover(id: string) {
  const { ctx, m } = await ownedMedia(id);
  await db.update(s.media).set({ isCover: false }).where(and(eq(s.media.resourceType, m.resourceType), eq(s.media.resourceId, m.resourceId)));
  await db.update(s.media).set({ isCover: true }).where(eq(s.media.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "media", resourceId: id, meta: { cover: true } });
  refresh();
}
export async function deletePhoto(id: string) {
  const { ctx } = await ownedMedia(id);
  await db.update(s.media).set({ deletedAt: new Date(), isCover: false }).where(eq(s.media.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "delete", resourceType: "media", resourceId: id });
  refresh();
}
export async function restorePhoto(id: string) {
  const { ctx } = await ownedMedia(id);
  await db.update(s.media).set({ deletedAt: null }).where(eq(s.media.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "restore", resourceType: "media", resourceId: id });
  refresh();
}

/* ── Your own facts & links ─────────────────────────────────────────── */
const Facts = z.object({
  custom: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(300) })).max(30),
  links: z.array(z.object({ label: z.string().trim().min(1).max(60), url: z.string().trim().url().max(500).refine((u) => /^https?:\/\//.test(u)) })).max(20),
});
export async function saveFacts(kind: "institution" | "scholarship", refId: string, raw: z.input<typeof Facts>) {
  const ctx = await ctxFor("catalog");
  const v = Facts.parse(raw);
  const table = RefKind.parse(kind) === "institution" ? s.institution : s.scholarship;
  if (kind === "institution") {
    const [row] = await db.select().from(s.institution).where(and(eq(s.institution.id, refId), eq(s.institution.workspaceId, ctx.workspace.id)));
    if (!row) throw new Error("not found");
    const details = { ...(row.details ?? {}), custom: v.custom, links: v.links };
    const d = diff({ custom: row.details?.custom ?? [], links: row.details?.links ?? [] }, v);
    if (!Object.keys(d).length) return;
    await db.update(s.institution).set({ details }).where(eq(s.institution.id, refId));
    await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "institution", resourceId: refId, diff: d });
  } else {
    const [row] = await db.select().from(s.scholarship).where(and(eq(s.scholarship.id, refId), eq(s.scholarship.workspaceId, ctx.workspace.id)));
    if (!row) throw new Error("not found");
    const eligibility = { ...(row.eligibility ?? {}), custom: v.custom, links: v.links };
    await db.update(table).set({ eligibility } as never).where(eq(s.scholarship.id, refId));
    await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "scholarship", resourceId: refId, diff: diff({ custom: row.eligibility?.custom ?? [], links: row.eligibility?.links ?? [] }, v) });
  }
  refresh();
}

/* ── Tasks tied to a university or scholarship ──────────────────────── */
const LinkedTask = z.object({
  kind: RefKind, refId: z.string().min(1), title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), timezone: z.string().refine(isValidTimeZone),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
});
export async function createLinkedTask(raw: z.input<typeof LinkedTask>) {
  const ctx = await ctxFor("calendar");
  const v = LinkedTask.parse(raw);
  const table = v.kind === "institution" ? s.institution : s.scholarship;
  const [ref] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, v.refId), eq(table.workspaceId, ctx.workspace.id)));
  if (!ref) throw new Error("not found");
  const [ev] = await db.insert(s.event).values({
    workspaceId: ctx.workspace.id, kind: "task", title: v.title, priority: v.priority, allDay: !v.time, timezone: v.timezone,
    startsAt: zonedToUtc(v.date, v.time, v.timezone), confidence: "confirmed", createdBy: ctx.user.id,
    ...(v.kind === "institution" ? { institutionId: v.refId } : { scholarshipId: v.refId }),
  }).returning({ id: s.event.id });
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "create", resourceType: "event", resourceId: ev.id, meta: { linked: v.kind } });
  refresh();
}
