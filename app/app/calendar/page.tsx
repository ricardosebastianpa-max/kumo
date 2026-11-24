import { getLocale, getTranslations } from "next-intl/server";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { dateInZone } from "@/lib/domain/time";
import { addDays, isIsoDate, rangeFor } from "@/lib/domain/calendar";
import { fmtTime, zoneCity } from "@/lib/format";
import { CalendarView, type CalEvent } from "./view";
import type { TlRow } from "./timeline";
import { normStage } from "@/lib/server/list";
import { addMonths, monthStart } from "@/lib/domain/calendar";

export async function generateMetadata() { return { title: (await getTranslations("calendar"))("title") }; }

type View = "month" | "week" | "agenda" | "year" | "timeline";
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "calendar" })) redirect("/app");
  const sp = await searchParams;
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const locale = await getLocale();
  const today = dateInZone(new Date(), tz);
  const view: View = (["month", "week", "agenda", "year", "timeline"] as const).find((v) => v === sp.view) ?? "month";
  const anchor = isIsoDate(sp.d) ? sp.d : today;
  const TL_MONTHS = 8;
  const [from, to] = view === "timeline" ? [monthStart(anchor), addDays(addMonths(monthStart(anchor), TL_MONTHS), -1)] : rangeFor(view, anchor);
  const rows = await db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt),
    gte(s.event.startsAt, new Date(`${addDays(from, -1)}T00:00:00Z`)), lte(s.event.startsAt, new Date(`${addDays(to, 2)}T00:00:00Z`))));
  const events: CalEvent[] = rows.map((r) => {
    const date = dateInZone(r.startsAt, r.allDay ? r.timezone : tz);
    return {
      id: r.id, title: r.title, kind: r.kind, date, confidence: r.confidence, priority: r.priority, done: !!r.completedAt,
      time: r.allDay ? null : fmtTime(r.startsAt, tz, locale), sortKey: r.allDay ? `${date} 00` : `${date} 1${r.startsAt.toISOString()}`,
      original: !r.allDay && r.timezone !== tz ? `${fmtTime(r.startsAt, r.timezone, locale)} ${zoneCity(r.timezone)}` : null,
    };
  }).filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  let timeline: { rows: TlRow[]; from: string; months: number; onlyList: boolean } | undefined;
  if (view === "timeline") {
    const onlyList = sp.list !== "all";
    const [insts, schs, items] = await Promise.all([
      db.select({ id: s.institution.id, name: s.institution.name, slug: s.institution.slug }).from(s.institution).where(and(eq(s.institution.workspaceId, ws), isNull(s.institution.deletedAt))),
      db.select({ id: s.scholarship.id, name: s.scholarship.name, slug: s.scholarship.slug }).from(s.scholarship).where(and(eq(s.scholarship.workspaceId, ws), isNull(s.scholarship.deletedAt))),
      db.select({ i: s.targetListItem.institutionId, sch: s.targetListItem.scholarshipId, st: s.targetListItem.status }).from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ws), eq(s.targetListItem.list, "main"), isNull(s.targetListItem.deletedAt))),
    ]);
    const stageOf = new Map(items.map((x) => [(x.i ?? x.sch)!, normStage(x.st)]));
    const refs = new Map<string, { name: string; href: string }>([
      ...insts.map((x) => [x.id, { name: x.name, href: `/app/universities/${x.slug}` }] as const),
      ...schs.map((x) => [x.id, { name: x.name, href: `/app/scholarships/${x.slug}` }] as const),
    ]);
    const all = await db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt)));
    const byRef = new Map<string, TlRow["events"]>();
    for (const r of all) {
      const ref = r.institutionId ?? r.scholarshipId;
      if (!ref || !refs.has(ref)) continue;
      (byRef.get(ref) ?? byRef.set(ref, []).get(ref)!).push({ id: r.id, kind: r.kind, title: r.title, done: !!r.completedAt, estimated: r.confidence !== "confirmed", date: dateInZone(r.startsAt, r.allDay ? r.timezone : tz) });
    }
    const order = { pursuing: 0, shortlist: 1, exploring: 2, discarded: 3 } as const;
    const rows: TlRow[] = [...byRef.entries()]
      .map(([ref, evs]) => ({ key: ref, ...refs.get(ref)!, stage: stageOf.get(ref) ?? "exploring", events: evs.sort((a, b) => a.date.localeCompare(b.date)) }))
      .filter((r) => r.events.some((e) => e.date >= from && e.date <= to) && (!onlyList || r.stage === "shortlist" || r.stage === "pursuing"))
      .sort((a, b) => order[a.stage as keyof typeof order] - order[b.stage as keyof typeof order] || (a.events.find((e) => e.date >= from)?.date ?? "").localeCompare(b.events.find((e) => e.date >= from)?.date ?? ""));
    timeline = { rows, from, months: TL_MONTHS, onlyList };
  }
  return (
    <CalendarView timeline={timeline} view={view} anchor={anchor} today={today} events={events} hidden={(sp.hide ?? "").split(",").filter(Boolean)}
      canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "calendar" })} openId={sp.e ?? null} userTz={tz} />
  );
}
