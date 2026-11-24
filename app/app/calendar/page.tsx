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

export async function generateMetadata() { return { title: (await getTranslations("calendar"))("title") }; }

type View = "month" | "week" | "agenda" | "year";
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "calendar" })) redirect("/app");
  const sp = await searchParams;
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const locale = await getLocale();
  const today = dateInZone(new Date(), tz);
  const view: View = (["month", "week", "agenda", "year"] as const).find((v) => v === sp.view) ?? "month";
  const anchor = isIsoDate(sp.d) ? sp.d : today;
  const [from, to] = rangeFor(view, anchor);
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
  return (
    <CalendarView view={view} anchor={anchor} today={today} events={events} hidden={(sp.hide ?? "").split(",").filter(Boolean)}
      canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "calendar" })} openId={sp.e ?? null} userTz={tz} />
  );
}
