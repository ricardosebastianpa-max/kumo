import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { fmtWhen } from "@/lib/format";
import { Card } from "@/components/ui";
import { FamilyClient } from "./client";

export async function generateMetadata() { return { title: (await getTranslations("family"))("title") }; }
export default async function Family() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  const [t, tk, ta, locale] = await Promise.all([getTranslations("family"), getTranslations("kinds"), getTranslations("apps"), getLocale()]);
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const [events, apps, sessions, plan, expenses, msgs, users] = await Promise.all([
    db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), gte(s.event.startsAt, new Date(now.getTime() - 14 * 864e5)), lte(s.event.startsAt, new Date(now.getTime() + 21 * 864e5)))).orderBy(asc(s.event.startsAt)),
    db.select().from(s.application).where(and(eq(s.application.workspaceId, ws), isNull(s.application.deletedAt))),
    db.select({ m: s.studySession.minutes }).from(s.studySession).where(and(eq(s.studySession.workspaceId, ws), gte(s.studySession.startedAt, weekAgo))),
    db.select().from(s.studyPlan).where(eq(s.studyPlan.workspaceId, ws)).limit(1),
    db.select().from(s.expense).where(and(eq(s.expense.workspaceId, ws), isNull(s.expense.deletedAt))).orderBy(desc(s.expense.createdAt)).limit(20),
    db.select().from(s.message).where(eq(s.message.workspaceId, ws)).orderBy(desc(s.message.createdAt)).limit(30),
    db.select({ id: s.user.id, name: s.user.name }).from(s.membership).innerJoin(s.user, eq(s.user.id, s.membership.userId)).where(eq(s.membership.workspaceId, ws)),
  ]);
  const items = apps.length ? await db.select().from(s.applicationItem).where(inArray(s.applicationItem.applicationId, apps.map((a) => a.id))) : [];
  const overdue = events.filter((e) => e.kind === "task" && !e.completedAt && e.startsAt < now);
  const soonCritical = events.filter((e) => e.priority === "critical" && !e.completedAt && e.startsAt >= now && e.startsAt.getTime() - now.getTime() < 7 * 864e5);
  const light = overdue.some((e) => e.priority === "critical") || overdue.length > 3 ? "red" : overdue.length || soonCritical.length ? "yellow" : "green";
  const hours = Math.round(sessions.reduce((a, x) => a + x.m, 0) / 6) / 10;
  const goal = Object.values(plan[0]?.weeklyHours ?? {}).reduce((a, b) => a + b, 0);
  const upcoming = events.filter((e) => e.startsAt >= now && e.kind !== "study_block").slice(0, 8);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const LC = { green: "var(--conf-confirmed)", yellow: "var(--conf-estimated)", red: "var(--lacquer)" } as const;
  return (
    <div className="grid max-w-3xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      <Card className="flex items-center gap-4 p-5" role="status"><span className="size-6 shrink-0 rounded-full" style={{ background: LC[light] }} aria-hidden /><span className="font-display text-2xl">{t(`light.${light}`)}</span></Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="grid content-start gap-2 p-5"><h2 className="text-xl">{t("hours")}</h2><p className="font-display text-4xl tabular-nums">{t("hoursOf", { h: hours, goal })}</p>
          <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${goal ? Math.min(100, (hours / goal) * 100) : 0}%` }} /></div></Card>
        <Card className="grid content-start gap-2 p-5"><h2 className="text-xl">{t("pipeline")}</h2>
          {apps.length ? <ul className="grid gap-1.5 text-sm">{apps.map((a) => { const it = items.filter((i) => i.applicationId === a.id); const d = it.filter((i) => i.done).length; return <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.title}</span><span className="shrink-0 text-mute">{ta(`statuses.${a.status}` as "statuses.preparing")} · {d}/{it.length}</span></li>; })}</ul> : <p className="text-sm text-mute">—</p>}</Card>
      </div>
      <Card className="grid gap-2 p-5"><h2 className="text-xl">{t("deadlines")}</h2>
        <ul className="grid gap-1.5">{upcoming.map((e) => <li key={e.id} className="flex justify-between gap-3 text-sm"><span>{e.title}</span><span className="shrink-0 text-mute">{tk(e.kind as "deadline")} · {fmtWhen(e, tz, locale).main}</span></li>)}</ul></Card>
      <FamilyClient canApprove={can(ctx.actor, "approve", { workspaceId: ws, module: "finance" })} canRequest={can(ctx.actor, "edit", { workspaceId: ws, module: "finance" })} me={ctx.user.id}
        expenses={expenses.map((x) => ({ id: x.id, label: x.label, amount: x.amount, currency: x.currency, status: x.status }))}
        messages={msgs.reverse().map((m) => ({ id: m.id, body: m.body, mine: m.authorId === ctx.user.id, who: names.get(m.authorId) ?? "", at: m.createdAt.toISOString() }))} />
      {ctx.role === "guardian" && <p className="text-sm text-mute">{t("tip")}</p>}
    </div>
  );
}
