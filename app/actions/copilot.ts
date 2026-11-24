"use server";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { institutionsScored } from "@/lib/server/catalog";
import { dateInZone } from "@/lib/domain/time";
import { askModel } from "@/lib/server/llm";

export type CopilotAction =
  | { type: "navigate"; path: string; label?: string }
  | { type: "shortlist"; kind: "institution" | "scholarship"; slug: string; stage: "shortlist" | "pursuing" | "discarded"; label?: string }
  | { type: "task"; title: string; date: string; label?: string };

const ROUTES = `Rutas que puedes abrir (navigate.path):
/app (Hoy) · /app/list (Mi lista) · /app/applications · /app/documents · /app/people · /app/family · /app/progress · /app/focus · /app/essays · /app/model · /app/study?tab=route|deep|channel
/app/calendar?view=month|week|agenda|timeline|year&d=YYYY-MM-DD[&list=all]
/app/universities?q=TEXTO&cat=safety|target|reach|dream&sort=score|name|tuition&mode=gallery|table   (filtros opcionales)
/app/universities/{slug}
/app/scholarships?q=TEXTO&country=PAIS_EXACTO&scope=institutional|government|local_government|private&upcoming=0|1
/app/scholarships/{slug}
/app/compare?ids=institution:{id},institution:{id}`;

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), path: z.string().regex(/^\/app(\/[\w\-/]*)?(\?[\w\-=&%.,:+]*)?$/), label: z.string().max(80).optional() }),
  z.object({ type: z.literal("shortlist"), kind: z.enum(["institution", "scholarship"]), slug: z.string().max(120), stage: z.enum(["shortlist", "pursuing", "discarded"]), label: z.string().max(80).optional() }),
  z.object({ type: z.literal("task"), title: z.string().min(1).max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().max(80).optional() }),
]);

/** One copilot turn: answers from a workspace snapshot and returns UI actions (navigation is applied
 *  directly by the client; anything that writes is shown as a button the student confirms). */
export async function copilotTurn(history: { role: "user" | "assistant"; content: string }[], path: string): Promise<{ ok: boolean; off?: boolean; text?: string; actions?: CopilotAction[] }> {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id, tz = ctx.user.timezone || ctx.workspace.timezone, now = new Date();
  const h = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).parse(history);
  const [unis, schs, events, list] = await Promise.all([
    institutionsScored(ws),
    db.select({ slug: s.scholarship.slug, name: s.scholarship.name, country: s.scholarship.country, scope: s.scholarship.scope }).from(s.scholarship).where(and(eq(s.scholarship.workspaceId, ws), isNull(s.scholarship.deletedAt))),
    db.select({ title: s.event.title, kind: s.event.kind, at: s.event.startsAt, prio: s.event.priority, conf: s.event.confidence, done: s.event.completedAt }).from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), gte(s.event.startsAt, new Date(now.getTime() - 3 * 864e5)), lte(s.event.startsAt, new Date(now.getTime() + 40 * 864e5)))).orderBy(asc(s.event.startsAt)).limit(50),
    db.select({ label: s.targetListItem.label, status: s.targetListItem.status }).from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ws), isNull(s.targetListItem.deletedAt))),
  ]);
  const snapshot = {
    hoy: dateInZone(now, tz), paginaActual: path,
    universidades: unis.map(({ i, score }) => [i.id, i.slug, i.name, i.city, score?.total, score?.category, (i.finance as { tuitionYear?: number } | null)?.tuitionYear ?? null]),
    paisesBecas: [...new Set(schs.map((x) => x.country).filter(Boolean))],
    becas: schs.slice(0, 200).map((x) => [x.slug, x.name, x.country]),
    proximasFechas: events.map((e) => [e.title, e.kind, dateInZone(e.at, tz), e.prio, e.conf, !!e.done]),
    miLista: list.filter((l) => l.status !== "exploring").map((l) => [l.label, l.status]),
  };
  const system = `Eres Kumo, una nube simpática que ayuda a un estudiante a aplicar a universidades y becas. Hablas en el idioma del estudiante, cálido, breve (1–4 frases), sin exclamaciones excesivas.
Puedes ACTUAR en la app devolviendo acciones. Responde SIEMPRE y SOLO con JSON: {"reply":"texto","actions":[...]}.
Tipos de acción:
- {"type":"navigate","path":"/app/...","label":"texto corto"}  → abre una página con filtros. Úsala para buscar, filtrar, abrir fichas o vistas.
- {"type":"shortlist","kind":"institution|scholarship","slug":"...","stage":"shortlist|pursuing|discarded","label":"..."} → el estudiante lo confirma con un botón.
- {"type":"task","title":"...","date":"YYYY-MM-DD","label":"..."} → crear tarea, el estudiante confirma.
Máximo 1 navigate y 3 acciones en total. Usa solo slugs, ids y países que existan en los datos (universidades: [id, slug, nombre, ciudad, puntaje, categoría, matrícula]). Si algo no está en los datos, dilo.
${ROUTES}`;
  const convo = h.map((m) => `${m.role === "user" ? "Estudiante" : "Kumo"}: ${m.content}`).join("\n");
  let raw: string | null;
  try { raw = await askModel(ws, system, `Datos de la app (JSON):\n${JSON.stringify(snapshot)}\n\nConversación:\n${convo}`); } catch { return { ok: false }; }
  if (raw === null) return { ok: false, off: true };
  const m = raw.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : raw) as { reply?: string; actions?: unknown[] };
    const actions = (j.actions ?? []).map((a) => ActionSchema.safeParse(a)).filter((r) => r.success).map((r) => r.data as CopilotAction).slice(0, 3);
    return { ok: true, text: j.reply ?? "", actions };
  } catch { return { ok: true, text: raw, actions: [] }; }
}

/** Confirmed write from a copilot suggestion: stage by slug. */
export async function copilotShortlist(kind: "institution" | "scholarship", slug: string, stage: "shortlist" | "pursuing" | "discarded") {
  const ctx = await requireWorkspace();
  const table = kind === "institution" ? s.institution : s.scholarship;
  const [r] = await db.select({ id: table.id }).from(table).where(and(eq(table.workspaceId, ctx.workspace.id), eq(table.slug, slug)));
  if (!r) throw new Error("not found");
  const { setStage } = await import("./list");
  await setStage(kind, r.id, stage);
}
