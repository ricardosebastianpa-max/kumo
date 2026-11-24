import "server-only";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { institutionsScored } from "./catalog";
import { dateInZone } from "@/lib/domain/time";

export type Stage = "exploring" | "shortlist" | "pursuing" | "discarded";
export const normStage = (st: string | null): Stage => (st === "shortlist" || st === "pursuing" || st === "discarded" ? st : "exploring");

export interface ListCard {
  kind: "institution" | "scholarship"; refId: string; slug: string; name: string; subtitle: string; stage: Stage;
  gut: number | null; pros: string[]; cons: string[]; notes: string | null; position: number;
  score: number | null; category: string | null; cover: string | null; nextDate: string | null; nextTitle: string | null;
}

/** Everything on the student's board: institutions (with live scores) and scholarships, with cover photo and next date. */
export async function boardCards(ws: string, tz: string): Promise<ListCard[]> {
  const [items, scored, schs, covers] = await Promise.all([
    db.select().from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ws), eq(s.targetListItem.list, "main"), isNull(s.targetListItem.deletedAt))),
    institutionsScored(ws),
    db.select().from(s.scholarship).where(and(eq(s.scholarship.workspaceId, ws), isNull(s.scholarship.deletedAt))),
    db.select({ id: s.media.id, rid: s.media.resourceId }).from(s.media).where(and(eq(s.media.workspaceId, ws), eq(s.media.isCover, true), isNull(s.media.deletedAt))),
  ]);
  const coverOf = new Map(covers.map((c) => [c.rid, `/api/media/${c.id}`]));
  const refIds = items.map((i) => i.institutionId ?? i.scholarshipId).filter(Boolean) as string[];
  const evs = refIds.length ? await db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), isNull(s.event.completedAt), gte(s.event.startsAt, new Date(Date.now() - 86400000)))).orderBy(asc(s.event.startsAt)) : [];
  const next = new Map<string, { d: string; t: string }>();
  for (const e of evs) { const k = e.institutionId ?? e.scholarshipId; if (k && !next.has(k)) next.set(k, { d: dateInZone(e.startsAt, e.allDay ? e.timezone : tz), t: e.title }); }
  const instById = new Map(scored.map((x) => [x.i.id, x]));
  const schById = new Map(schs.map((x) => [x.id, x]));
  const cards: ListCard[] = [];
  for (const it of items) {
    const base = { stage: normStage(it.status), gut: it.gut, pros: it.pros, cons: it.cons, notes: it.notes, position: it.position };
    if (it.institutionId && instById.has(it.institutionId)) {
      const { i, score } = instById.get(it.institutionId)!;
      cards.push({ ...base, kind: "institution", refId: i.id, slug: i.slug, name: i.name, subtitle: [i.city, i.tiers.slice(0, 2).join(" · ")].filter(Boolean).join(" · "), score: score?.total ?? null, category: score?.category ?? null, cover: coverOf.get(i.id) ?? null, nextDate: next.get(i.id)?.d ?? null, nextTitle: next.get(i.id)?.t ?? null });
    } else if (it.scholarshipId && schById.has(it.scholarshipId)) {
      const x = schById.get(it.scholarshipId)!;
      cards.push({ ...base, kind: "scholarship", refId: x.id, slug: x.slug, name: x.name, subtitle: [x.country, x.scope].filter(Boolean).join(" · "), score: null, category: null, cover: coverOf.get(x.id) ?? null, nextDate: next.get(x.id)?.d ?? null, nextTitle: next.get(x.id)?.t ?? null });
    }
  }
  return cards;
}

/** Stage lookup for catalog pages (stars / buttons). */
export async function stagesFor(ws: string, ids: string[]) {
  if (!ids.length) return new Map<string, Stage>();
  const rows = await db.select({ i: s.targetListItem.institutionId, sch: s.targetListItem.scholarshipId, st: s.targetListItem.status }).from(s.targetListItem)
    .where(and(eq(s.targetListItem.workspaceId, ws), eq(s.targetListItem.list, "main"), isNull(s.targetListItem.deletedAt)));
  const set = new Set(ids);
  return new Map(rows.filter((r) => set.has((r.i ?? r.sch)!)).map((r) => [(r.i ?? r.sch)!, normStage(r.st)]));
}
