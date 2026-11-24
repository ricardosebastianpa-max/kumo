"use server";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { assertCan, type Module } from "@/lib/domain/permissions";
import { audit } from "@/lib/server/audit";
import { planWeek } from "@/lib/domain/scheduler";
import { dateInZone, zonedToUtc } from "@/lib/domain/time";
import { addDays } from "@/lib/domain/calendar";
import { seal } from "@/lib/server/secrets";

const refresh = () => revalidatePath("/app", "layout");
async function ctxFor(module: Module, action: "edit" | "approve" | "comment" | "view" = "edit") {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, action, { workspaceId: ctx.workspace.id, module });
  return ctx;
}
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ── Applications ───────────────────────────────────────────────────── */
async function ownApp(id: string) {
  const ctx = await ctxFor("applications");
  const [a] = await db.select().from(s.application).where(and(eq(s.application.id, id), eq(s.application.workspaceId, ctx.workspace.id)));
  if (!a) throw new Error("not found");
  return { ctx, a };
}
export async function toggleAppItem(itemId: string, done: boolean) {
  const ctx = await ctxFor("applications");
  const [it] = await db.select({ i: s.applicationItem, ws: s.application.workspaceId }).from(s.applicationItem).innerJoin(s.application, eq(s.application.id, s.applicationItem.applicationId)).where(eq(s.applicationItem.id, itemId));
  if (!it || it.ws !== ctx.workspace.id) throw new Error("not found");
  await db.update(s.applicationItem).set({ done }).where(eq(s.applicationItem.id, itemId));
  refresh();
}
export async function addAppItem(appId: string, label: string) {
  await ownApp(appId);
  const v = z.string().trim().min(1).max(200).parse(label);
  await db.insert(s.applicationItem).values({ applicationId: appId, key: `c${Date.now()}`, label: v, position: 999 });
  refresh();
}
const AppPatch = z.object({ status: z.enum(["preparing", "submitted", "interview", "admitted", "waitlisted", "rejected", "accepted", "declined"]).optional(), portalUrl: z.string().max(500).nullable().optional(), portalUser: z.string().max(200).nullable().optional(), appNumber: z.string().max(100).nullable().optional(), notes: z.string().max(4000).nullable().optional() });
export async function updateApplication(id: string, raw: z.input<typeof AppPatch>) {
  const { ctx, a } = await ownApp(id);
  const v = AppPatch.parse(raw);
  const submittedAt = v.status === "submitted" && !a.submittedAt ? new Date() : undefined;
  await db.update(s.application).set({ ...v, ...(submittedAt && { submittedAt }) }).where(eq(s.application.id, id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "application", resourceId: id, meta: v });
  refresh();
}

/* ── Documents ──────────────────────────────────────────────────────── */
const DocIn = z.object({ name: z.string().trim().min(1).max(120), status: z.enum(["missing", "in_progress", "ready", "translated", "apostilled"]).default("missing"), expiresOn: isoDate.nullable().optional(), notes: z.string().max(2000).nullable().optional() });
export async function saveDocument(id: string | null, raw: z.input<typeof DocIn>) {
  const ctx = await ctxFor("documents");
  const v = DocIn.parse(raw);
  if (id) await db.update(s.document).set(v).where(and(eq(s.document.id, id), eq(s.document.workspaceId, ctx.workspace.id)));
  else await db.insert(s.document).values({ ...v, workspaceId: ctx.workspace.id, createdBy: ctx.user.id });
  refresh();
}
export async function seedDocuments() {
  const ctx = await ctxFor("documents");
  const names = ["Pasaporte", "Certificado de notas", "Diploma de bachillerato", "Constancia de ranking de clase", "Certificado médico (Foreigner Physical Examination)", "Antecedentes penales", "Fotos tipo pasaporte", "Resultado IELTS/TOEFL", "Resultado CSCA", "Carta de motivación"];
  await db.insert(s.document).values(names.map((name) => ({ name, workspaceId: ctx.workspace.id, createdBy: ctx.user.id })));
  refresh();
}
export async function deleteDocument(id: string) {
  const ctx = await ctxFor("documents");
  await db.update(s.document).set({ deletedAt: new Date() }).where(and(eq(s.document.id, id), eq(s.document.workspaceId, ctx.workspace.id)));
  refresh();
}

/* ── Recommenders ───────────────────────────────────────────────────── */
const RecIn = z.object({ name: z.string().trim().min(1).max(120), role: z.string().max(120).nullable().optional(), ask: z.string().max(2000).nullable().optional(), dueOn: isoDate.nullable().optional(), status: z.enum(["to_ask", "asked", "in_progress", "sent", "thanked"]).optional() });
export async function saveRecommender(id: string | null, raw: z.input<typeof RecIn>) {
  const ctx = await ctxFor("people");
  const v = RecIn.parse(raw);
  if (id) await db.update(s.recommender).set(v).where(and(eq(s.recommender.id, id), eq(s.recommender.workspaceId, ctx.workspace.id)));
  else await db.insert(s.recommender).values({ ...v, workspaceId: ctx.workspace.id, createdBy: ctx.user.id });
  refresh();
}
/** Public, token-only: the recommender updates their status. No account. */
export async function recommenderReply(token: string, status: "in_progress" | "sent", note: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error("bad token");
  const [r] = await db.select().from(s.recommender).where(and(eq(s.recommender.token, token), isNull(s.recommender.deletedAt)));
  if (!r) throw new Error("not found");
  await db.update(s.recommender).set({ status, replyNote: note.slice(0, 1000) || null }).where(eq(s.recommender.id, r.id));
  await audit({ workspaceId: r.workspaceId, actorId: `recommender:${r.id}`, action: "update", resourceType: "recommender", resourceId: r.id, meta: { status } });
}

/* ── Money & family ─────────────────────────────────────────────────── */
export async function requestExpense(label: string, amount: number, currency: string) {
  const ctx = await ctxFor("finance");
  const v = z.object({ label: z.string().trim().min(1).max(200), amount: z.number().positive().max(1e7), currency: z.string().regex(/^[A-Z]{3}$/) }).parse({ label, amount, currency });
  await db.insert(s.expense).values({ ...v, workspaceId: ctx.workspace.id, createdBy: ctx.user.id });
  refresh();
}
export async function decideExpense(id: string, approve: boolean, note?: string) {
  const ctx = await ctxFor("finance", "approve");
  await db.update(s.expense).set({ status: approve ? "approved" : "rejected", decidedBy: ctx.user.id, decidedAt: new Date(), decisionNote: note?.slice(0, 500) || null }).where(and(eq(s.expense.id, id), eq(s.expense.workspaceId, ctx.workspace.id)));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: approve ? "approve" : "reject", resourceType: "expense", resourceId: id });
  refresh();
}
export async function sendMessage(body: string) {
  const ctx = await requireWorkspace();
  const v = z.string().trim().min(1).max(2000).parse(body);
  await db.insert(s.message).values({ workspaceId: ctx.workspace.id, authorId: ctx.user.id, body: v });
  revalidatePath("/app/family");
}

/* ── Study tracking ─────────────────────────────────────────────────── */
export async function logSession(subject: string, minutes: number) {
  const ctx = await ctxFor("study");
  const v = z.object({ subject: z.string().trim().min(1).max(80), minutes: z.number().int().min(1).max(600) }).parse({ subject, minutes });
  await db.insert(s.studySession).values({ ...v, workspaceId: ctx.workspace.id, startedAt: new Date(Date.now() - v.minutes * 60000), createdBy: ctx.user.id });
  refresh();
}
export async function logTest(raw: { exam: string; section: string; score: number; maxScore: number; takenOn: string }) {
  const ctx = await ctxFor("study");
  const v = z.object({ exam: z.string().trim().min(1).max(40), section: z.string().trim().min(1).max(60), score: z.number().min(0).max(10000), maxScore: z.number().positive().max(10000), takenOn: isoDate }).parse(raw);
  await db.insert(s.practiceTest).values({ ...v, workspaceId: ctx.workspace.id, createdBy: ctx.user.id });
  refresh();
}
export async function saveCheckin(raw: { energy?: number; mood?: number; sleep?: number; stress?: number }) {
  const ctx = await requireWorkspace();
  if (ctx.role !== "owner") throw new Error("private");
  const r15 = z.number().int().min(1).max(5).optional();
  const v = z.object({ energy: r15, mood: r15, sleep: r15, stress: r15 }).parse(raw);
  const day = dateInZone(new Date(), ctx.user.timezone || ctx.workspace.timezone);
  await db.insert(s.checkin).values({ ...v, workspaceId: ctx.workspace.id, day }).onConflictDoUpdate({ target: [s.checkin.workspaceId, s.checkin.day], set: v });
  refresh();
}
/** Replaces next week's auto-planned study blocks with a fresh deterministic plan. */
export async function planMyWeek() {
  const ctx = await ctxFor("calendar");
  const ws = ctx.workspace.id;
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const [plan] = await db.select().from(s.studyPlan).where(eq(s.studyPlan.workspaceId, ws)).limit(1);
  const weekly = plan?.weeklyHours ?? {};
  const today = dateInZone(new Date(), tz);
  const from = zonedToUtc(today, null, tz), to = zonedToUtc(addDays(today, 7), null, tz);
  await db.delete(s.event).where(and(eq(s.event.workspaceId, ws), eq(s.event.kind, "study_block"), gte(s.event.startsAt, from), lte(s.event.startsAt, to), isNull(s.event.completedAt)));
  const busy = (await db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), eq(s.event.allDay, false), gte(s.event.startsAt, from), lte(s.event.startsAt, to))))
    .map((e) => ({ start: e.startsAt, end: e.endsAt ?? new Date(e.startsAt.getTime() + 60 * 60000) }));
  const blocks = planWeek({ startDate: today, days: 7, timezone: tz, weeklyHours: weekly, busy, now: new Date() });
  if (blocks.length) await db.insert(s.event).values(blocks.map((b) => ({ workspaceId: ws, kind: "study_block", title: b.label, startsAt: b.start, endsAt: b.end, allDay: false, timezone: tz, confidence: "confirmed" as const, priority: "medium" as const, createdBy: ctx.user.id })));
  await audit({ workspaceId: ws, actorId: ctx.user.id, action: "create", resourceType: "study_plan", resourceId: plan?.id ?? ws, meta: { blocks: blocks.length } });
  refresh();
  return blocks.length;
}

/* ── Scoring model versions ─────────────────────────────────────────── */
export async function saveModel(params: Record<string, unknown>) {
  const ctx = await ctxFor("settings");
  const ws = ctx.workspace.id;
  const [cur] = await db.select().from(s.scoringModel).where(and(eq(s.scoringModel.workspaceId, ws), eq(s.scoringModel.isActive, true))).orderBy(desc(s.scoringModel.version)).limit(1);
  const version = (cur?.version ?? 0) + 1;
  await db.update(s.scoringModel).set({ isActive: false }).where(eq(s.scoringModel.workspaceId, ws));
  await db.insert(s.scoringModel).values({ workspaceId: ws, version, name: cur?.name ?? "Modelo", params, isActive: true, createdBy: ctx.user.id });
  await audit({ workspaceId: ws, actorId: ctx.user.id, action: "create", resourceType: "scoring_model", resourceId: String(version) });
  refresh();
  return version;
}

/* ── Essays ─────────────────────────────────────────────────────────── */
export async function createEssay(title: string) {
  const ctx = await ctxFor("writing");
  const [e] = await db.insert(s.essay).values({ workspaceId: ctx.workspace.id, title: z.string().trim().min(1).max(200).parse(title), createdBy: ctx.user.id }).returning({ id: s.essay.id });
  revalidatePath("/app/essays");
  return e.id;
}
export async function saveEssay(id: string, raw: { title?: string; prompt?: string | null; wordLimit?: number | null; body: string }) {
  const ctx = await ctxFor("writing");
  const v = z.object({ title: z.string().trim().min(1).max(200).optional(), prompt: z.string().max(4000).nullable().optional(), wordLimit: z.number().int().positive().max(10000).nullable().optional(), body: z.string().max(60000) }).parse(raw);
  const [e] = await db.select().from(s.essay).where(and(eq(s.essay.id, id), eq(s.essay.workspaceId, ctx.workspace.id)));
  if (!e) throw new Error("not found");
  const versions = e.body && e.body !== v.body ? [...e.versions, { at: new Date().toISOString(), body: e.body }].slice(-30) : e.versions;
  await db.update(s.essay).set({ ...v, versions }).where(eq(s.essay.id, id));
  revalidatePath("/app/essays");
}

/* ── AI copilot (Anthropic API; off without a key) ──────────────────── */
import { askModel } from "@/lib/server/llm";
const claude = askModel;
/** Owner-only: store (encrypted) or clear the AI key. The key never travels back to the browser. */
export async function saveAiKey(raw: { provider: "anthropic" | "openrouter"; key: string; model?: string } | null) {
  const ctx = await ctxFor("settings", "edit");
  assertCan(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "settings" });
  const [w] = await db.select({ settings: s.workspace.settings }).from(s.workspace).where(eq(s.workspace.id, ctx.workspace.id));
  const settings = { ...(w?.settings ?? {}) } as Record<string, unknown>;
  if (!raw) delete settings.ai;
  else {
    const v = z.object({ provider: z.enum(["anthropic", "openrouter"]), key: z.string().trim().min(20).max(300), model: z.string().trim().max(120).optional() }).parse(raw);
    settings.ai = { provider: v.provider, key: seal(v.key), model: v.model || undefined, last4: v.key.slice(-4) };
  }
  await db.update(s.workspace).set({ settings }).where(eq(s.workspace.id, ctx.workspace.id));
  await audit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "update", resourceType: "workspace", resourceId: ctx.workspace.id, meta: { ai: raw ? raw.provider : "removed" } });
  revalidatePath("/app", "layout");
}
export async function askCopilot(question: string): Promise<{ ok: boolean; text?: string; off?: boolean }> {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const now = new Date();
  const [events, list, route, apps] = await Promise.all([
    db.select({ title: s.event.title, kind: s.event.kind, at: s.event.startsAt, conf: s.event.confidence, prio: s.event.priority, done: s.event.completedAt }).from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), gte(s.event.startsAt, new Date(now.getTime() - 7 * 864e5)), lte(s.event.startsAt, new Date(now.getTime() + 45 * 864e5)))).orderBy(asc(s.event.startsAt)).limit(60),
    db.select({ label: s.targetListItem.label, status: s.targetListItem.status, category: s.targetListItem.category }).from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ws), isNull(s.targetListItem.deletedAt))),
    db.select({ n: s.studyResource.position, topic: s.studyResource.topic, done: s.studyResource.done }).from(s.studyResource).where(and(eq(s.studyResource.workspaceId, ws), eq(s.studyResource.kind, "route"))).orderBy(asc(s.studyResource.position)),
    db.select({ title: s.application.title, status: s.application.status }).from(s.application).where(and(eq(s.application.workspaceId, ws), isNull(s.application.deletedAt))),
  ]);
  const data = {
    hoy: dateInZone(now, tz), zona: tz,
    fechas: events.map((e) => ({ t: e.title, tipo: e.kind, fecha: dateInZone(e.at, tz), confianza: e.conf, prioridad: e.prio, hecho: !!e.done })),
    lista: list.filter((l) => l.status === "shortlist" || l.status === "pursuing"), solicitudes: apps,
    rutaEstudio: { hechos: route.filter((r) => r.done).length, total: route.length, siguiente: route.find((r) => !r.done) ?? null },
  };
  const system = "Eres Kumo, copiloto calmado y directo de un estudiante que aplica a universidades y becas. Responde en el idioma de la pregunta, en 3–8 frases o una lista corta. Usa SOLO los datos JSON dados; si algo no está, dilo y sugiere verificarlo en la fuente. Prioriza por plazo y prioridad. Nunca culpes; propone el siguiente paso concreto con tiempo estimado. No inventes fechas ni cifras.";
  try {
    const text = await claude(ws, system, `Datos:\n${JSON.stringify(data)}\n\nPregunta: ${z.string().trim().min(1).max(1000).parse(question)}`);
    return text === null ? { ok: false, off: true } : { ok: true, text };
  } catch { return { ok: false }; }
}
export async function coachEssay(id: string): Promise<{ ok: boolean; text?: string; off?: boolean }> {
  const ctx = await ctxFor("writing", "comment");
  const [e] = await db.select().from(s.essay).where(and(eq(s.essay.id, id), eq(s.essay.workspaceId, ctx.workspace.id)));
  if (!e) return { ok: false };
  const system = "Eres un coach de ensayos de admisión. NO reescribas el texto ni des frases para copiar. Señala: claridad, especificidad, voz propia, mostrar vs. contar, clichés y lo que sobra. Haz 3–5 preguntas que ayuden al estudiante a profundizar. Recuerda que todo debe ser verdadero y verificable. Responde en el idioma del ensayo, breve y con viñetas.";
  try {
    const text = await claude(ctx.workspace.id, system, `Consigna: ${e.prompt ?? "(sin consigna)"}\nLímite: ${e.wordLimit ?? "—"} palabras\n\nEnsayo:\n${e.body}`);
    return text === null ? { ok: false, off: true } : { ok: true, text };
  } catch { return { ok: false }; }
}
