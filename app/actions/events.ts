"use server";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { assertCan } from "@/lib/domain/permissions";
import { dateInZone, isValidTimeZone, zonedToUtc } from "@/lib/domain/time";
import { audit, diff } from "@/lib/server/audit";

const KINDS = ["deadline", "exam", "registration", "window", "class", "work", "study_block", "interview", "personal", "milestone", "task", "event"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Wall-clock HH:mm of an instant in a zone. */
function timeInZone(at: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

async function loadOwned(id: string, action: "edit") {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, action, { workspaceId: ctx.workspace.id, module: "calendar" });
  const [ev] = await db.select().from(s.event).where(and(eq(s.event.id, id), eq(s.event.workspaceId, ctx.workspace.id)));
  if (!ev) throw new Error("not found");
  return { ctx, ev };
}
const refresh = () => { revalidatePath("/app", "layout"); };

const CreateInput = z.object({
  title: z.string().trim().min(1).max(200), date: isoDate, time: hhmm.nullable(), timezone: z.string().refine(isValidTimeZone),
  kind: z.enum(KINDS).default("event"), priority: z.enum(["critical", "high", "medium", "low"]).default("medium"), notes: z.string().max(2000).optional(),
});
export async function createEvent(input: z.input<typeof CreateInput>) {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "calendar" });
  const v = CreateInput.parse(input);
  const [ev] = await db.insert(s.event).values({
    workspaceId: ctx.workspace.id, title: v.title, kind: v.kind, priority: v.priority, notes: v.notes ?? null,
    allDay: !v.time, timezone: v.timezone, startsAt: zonedToUtc(v.date, v.time, v.timezone),
    confidence: "confirmed", createdBy: ctx.user.id,
  }).returning({ id: s.event.id });
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "create", resourceType: "event", resourceId: ev.id, meta: { via: "capture" } });
  refresh();
  return ev.id;
}

const PatchInput = z.object({
  title: z.string().trim().min(1).max(200).optional(), notes: z.string().max(2000).nullable().optional(),
  date: isoDate.optional(), time: hhmm.nullable().optional(), timezone: z.string().refine(isValidTimeZone).optional(),
  kind: z.enum(KINDS).optional(), priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  confidence: z.enum(["confirmed", "estimated", "unverified"]).optional(),
});
/** Edits keep the wall-clock date/time in the event's own zone; every change lands in the audit log. */
export async function updateEvent(id: string, patch: z.input<typeof PatchInput>) {
  const { ctx, ev } = await loadOwned(id, "edit");
  const p = PatchInput.parse(patch);
  const tz = p.timezone ?? ev.timezone;
  const date = p.date ?? dateInZone(ev.startsAt, ev.timezone);
  const time = p.time !== undefined ? p.time : ev.allDay ? null : timeInZone(ev.startsAt, ev.timezone);
  const next: Record<string, unknown> = {
    ...(p.title !== undefined && { title: p.title }), ...(p.notes !== undefined && { notes: p.notes }),
    ...(p.kind && { kind: p.kind }), ...(p.priority && { priority: p.priority }), ...(p.confidence && { confidence: p.confidence }),
    timezone: tz, allDay: !time, startsAt: zonedToUtc(date, time, tz),
  };
  if (ev.endsAt && (p.date || p.time !== undefined || p.timezone)) {
    const shift = (next.startsAt as Date).getTime() - ev.startsAt.getTime();
    next.endsAt = new Date(ev.endsAt.getTime() + shift);
  }
  const d = diff(ev as unknown as Record<string, unknown>, next);
  if (!Object.keys(d).length) return;
  await db.update(s.event).set(next).where(eq(s.event.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "event", resourceId: id, diff: d });
  refresh();
}

export async function moveEvent(id: string, date: string) {
  isoDate.parse(date);
  return updateEvent(id, { date });
}

export async function setEventDone(id: string, done: boolean) {
  const { ctx, ev } = await loadOwned(id, "edit");
  const completedAt = done ? new Date() : null;
  await db.update(s.event).set({ completedAt }).where(eq(s.event.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: done ? "complete" : "reopen", resourceType: "event", resourceId: id, diff: { completedAt: { from: ev.completedAt, to: completedAt } } });
  refresh();
}

export async function deleteEvent(id: string) {
  const { ctx } = await loadOwned(id, "edit");
  await db.update(s.event).set({ deletedAt: new Date() }).where(eq(s.event.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "delete", resourceType: "event", resourceId: id });
  refresh();
}
export async function restoreEvent(id: string) {
  const { ctx } = await loadOwned(id, "edit");
  await db.update(s.event).set({ deletedAt: null }).where(eq(s.event.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "restore", resourceType: "event", resourceId: id });
  refresh();
}

/** Event detail for the side sheet: the event, where its data came from, and its change history. */
export async function getEventDetail(id: string) {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "view", { workspaceId: ctx.workspace.id, module: "calendar" });
  const [ev] = await db.select().from(s.event).where(and(eq(s.event.id, id), eq(s.event.workspaceId, ctx.workspace.id)));
  if (!ev) return null;
  const ids = [ev.id, ev.institutionId, ev.scholarshipId].filter(Boolean) as string[];
  const sources = await db.select({ title: s.source.title, url: s.source.url, confidence: s.fieldSource.confidence, verifiedAt: s.source.verifiedAt })
    .from(s.fieldSource).innerJoin(s.source, eq(s.source.id, s.fieldSource.sourceId)).where(inArray(s.fieldSource.resourceId, ids));
  const history = await db.select({ action: s.activityLog.action, diff: s.activityLog.diff, at: s.activityLog.createdAt, who: s.user.name })
    .from(s.activityLog).leftJoin(s.user, eq(s.user.id, s.activityLog.actorId))
    .where(and(eq(s.activityLog.workspaceId, ctx.workspace.id), eq(s.activityLog.resourceType, "event"), eq(s.activityLog.resourceId, id)))
    .orderBy(desc(s.activityLog.createdAt)).limit(20);
  const inst = ev.institutionId ? (await db.select({ slug: s.institution.slug, name: s.institution.name }).from(s.institution).where(eq(s.institution.id, ev.institutionId)))[0] ?? null : null;
  const canEdit = (await import("@/lib/domain/permissions")).can(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "calendar" });
  return {
    event: { ...ev, date: dateInZone(ev.startsAt, ev.timezone), time: ev.allDay ? null : timeInZone(ev.startsAt, ev.timezone) },
    sources, history: history.map((h) => ({ ...h, fields: Object.keys(h.diff ?? {}) })), institution: inst, canEdit,
  };
}
export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

export async function rotateIcsToken() {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "settings" });
  const token = crypto.randomUUID().replace(/-/g, "");
  await db.update(s.workspace).set({ icsToken: token }).where(eq(s.workspace.id, ctx.workspace.id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "workspace", resourceId: ctx.workspace.id, meta: { field: "icsToken" } });
  revalidatePath("/app/subscribe");
}
