import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { daysUntil, planToday, type TodayItem } from "@/lib/domain/today";
import { fmtWhen } from "@/lib/format";
import { Kumo } from "@/components/kumo";
import { ButtonLink, Card, ConfidenceBadge } from "@/components/ui";
import { DoneButton } from "@/components/client/done-button";
import { CalmButton } from "@/components/client/calm";
import { AlertTriangle, BookOpen, CalendarClock, Layers } from "lucide-react";

export default async function Today() {
  const ctx = await requireWorkspace();
  if (ctx.role === "guardian") redirect("/app/family");
  const [t, tc, tk, tp, locale] = await Promise.all([getTranslations("today"), getTranslations("common"), getTranslations("kinds"), getTranslations("priority"), getLocale()]);
  const th = await getTranslations("home");
  const ws = ctx.workspace.id;
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const now = new Date();
  const canView = can(ctx.actor, "view", { workspaceId: ws, module: "calendar" });
  const canEdit = can(ctx.actor, "edit", { workspaceId: ws, module: "calendar" });
  const rows = canView ? await db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt),
    gte(s.event.startsAt, new Date(now.getTime() - 15 * 86400000)), lte(s.event.startsAt, new Date(now.getTime() + 32 * 86400000)))).orderBy(asc(s.event.startsAt)) : [];
  const ts = await getTranslations("study");
  const [routeNext] = can(ctx.actor, "view", { workspaceId: ws, module: "study" }) ? await db.select().from(s.studyResource)
    .where(and(eq(s.studyResource.workspaceId, ws), eq(s.studyResource.kind, "route"), eq(s.studyResource.done, false), isNull(s.studyResource.deletedAt))).orderBy(asc(s.studyResource.position)).limit(1) : [];
  const items: TodayItem[] = rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, startsAt: r.startsAt, allDay: r.allDay, timezone: r.timezone, priority: r.priority, confidence: r.confidence, done: !!r.completedAt }));
  const plan = planToday(items, now, tz);
  const next30 = items.filter((i) => !i.done && daysUntil(i, now, tz) >= 0 && daysUntil(i, now, tz) <= 30 && i.id !== plan.main?.id && !plan.secondary.some((x) => x.id === i.id));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  const greet = hour < 12 ? "morning" : hour < 19 ? "afternoon" : "evening";
  const name = (ctx.user.name || "").split(" ")[0];
  const isTask = (k: string) => k === "task" || k === "milestone";
  const when = (i: TodayItem) => { const d = daysUntil(i, now, tz); return d < 0 ? t("overdue", { n: -d }) : t("inDays", { n: d }); };
  const byId = new Map(items.map((i) => [i.id, i]));

  if (!items.length) return (
    <div className="grid max-w-2xl gap-8 pt-2">
      <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight enter">{t(greet, { name })}</h1>
      <Card className="grid justify-items-start gap-4 p-8">
        <Kumo state="resting" size={110} className="text-ink" />
        <h2 className="text-2xl">{t("emptyTitle")}</h2>
        <p className="text-ink-2 text-lg">{ctx.role === "owner" ? t("emptyBody") : th("noData")}</p>
        {ctx.role === "owner" && <ButtonLink href="/app/import">{th("importCta")}</ButtonLink>}
      </Card>
    </div>
  );

  const Row = ({ i, big = false }: { i: TodayItem; big?: boolean }) => {
    const w = fmtWhen(i, tz, locale);
    return (
      <div className="flex items-center gap-4">
        {canEdit && isTask(i.kind) ? <DoneButton id={i.id} done={i.done} /> : null}
        <Link href={`/app/calendar?e=${i.id}`} className="grid min-w-0 flex-1 gap-1 rounded-xl py-1">
          <span className={`font-semibold leading-snug ${big ? "text-[clamp(1.25rem,3vw,1.6rem)] font-display font-medium" : ""}`}>{i.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
            <span>{tk(i.kind)}</span><span aria-hidden>·</span><span>{w.main}</span>
            {w.original ? <span className="text-ink-2">({w.original})</span> : null}
            {i.confidence !== "confirmed" ? <ConfidenceBadge level={i.confidence} label={tc(`confidence.${i.confidence}`)} /> : null}
          </span>
        </Link>
      </div>
    );
  };

  return (
    <div className="grid max-w-3xl gap-8 pt-2">
      <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight enter">{t(greet, { name })}</h1>
      <CalmButton main={plan.main?.title ?? null} />

      {plan.main ? (
        <Card className="relative grid gap-4 overflow-hidden p-6 sm:p-8 enter" aria-labelledby="main-label">
          <div className="flex items-center justify-between gap-3">
            <p id="main-label" className="text-sm font-semibold text-[var(--lacquer)]">{t("mainLabel")}</p>
            <span className="rounded-full bg-paper-2 px-3 py-1 text-sm font-semibold">{when(plan.main)}</span>
          </div>
          <Row i={plan.main} big />
          <Kumo state="focused" size={84} className="pointer-events-none absolute -bottom-3 -right-2 text-ink opacity-90 max-sm:hidden" />
        </Card>
      ) : (
        <Card className="flex items-center gap-4 p-6"><Kumo state="resting" size={72} className="text-ink" /><p className="text-lg text-ink-2">{t("allClear")}</p></Card>
      )}

      {routeNext && (
        <Link href="/app/study" className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-card p-5 hover:bg-paper-2" data-testid="today-study">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paper-2"><BookOpen size={22} aria-hidden /></span>
          <span className="grid min-w-0 gap-0.5">
            <span className="text-sm font-semibold text-[var(--lacquer)]">{ts("next")}</span>
            <span className="font-semibold">#{routeNext.position} · {routeNext.topic ?? routeNext.title}</span>
            <span className="truncate text-sm text-mute">{routeNext.title}{routeNext.source ? ` · ${routeNext.source}` : ""}</span>
          </span>
        </Link>
      )}

      {plan.alerts.length > 0 && (
        <section className="grid gap-2" aria-label="alerts">
          {plan.alerts.map((a) => (
            <div key={a.type} className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
              {a.type === "verify" ? <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[var(--conf-estimated)]" aria-hidden /> : a.type === "cluster" ? <Layers size={20} className="mt-0.5 shrink-0 text-ink-2" aria-hidden /> : <CalendarClock size={20} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />}
              <div className="grid gap-1">
                <p className="text-ink-2">{a.type === "verify" ? t("alertVerify", { n: a.itemIds.length }) : a.type === "overdue" ? t("alertOverdue", { n: a.itemIds.length }) : t("alertCluster", { n: a.itemIds.length })}</p>
                <p className="text-sm text-mute">{a.itemIds.slice(0, 3).map((id) => byId.get(id)?.title).join(" · ")}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {plan.secondary.length > 0 && (
        <section className="grid gap-3" aria-labelledby="sec">
          <h2 id="sec" className="text-xl">{t("secondaryLabel")}</h2>
          <Card className="divide-y divide-[var(--line)]">
            {plan.secondary.map((i) => <div key={i.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><Row i={i} /></div><span className="shrink-0 text-sm font-semibold text-ink-2">{when(i)}</span></div>)}
          </Card>
        </section>
      )}

      <section className="grid gap-3" aria-labelledby="day">
        <h2 id="day" className="text-xl">{t("agendaTitle")}</h2>
        {plan.agenda.length ? (
          <Card className="divide-y divide-[var(--line)]">{plan.agenda.map((i) => <div key={i.id} className="p-4"><Row i={i} /></div>)}</Card>
        ) : <p className="text-ink-2">{t("agendaEmpty")}</p>}
      </section>

      {next30.length > 0 && (
        <section className="grid gap-3" aria-labelledby="n30">
          <div className="flex items-baseline justify-between gap-3"><h2 id="n30" className="text-xl">{t("nextTitle")}</h2><Link href="/app/calendar?view=agenda" className="min-h-11 content-center text-sm font-semibold underline underline-offset-4">{t("viewCalendar")}</Link></div>
          <Card className="divide-y divide-[var(--line)]">
            {next30.slice(0, 12).map((i) => {
              const d = daysUntil(i, now, tz);
              return (
                <div key={i.id} className="flex items-center gap-4 p-4">
                  <div className="w-12 shrink-0 text-center"><p className="font-display text-2xl leading-none">{d}</p><p className="text-xs text-mute">{th("daysLeft", { n: d })}</p></div>
                  <div className="min-w-0 flex-1"><Row i={i} /></div>
                  {i.priority === "critical" ? <span className="shrink-0 text-xs font-semibold text-[var(--lacquer)]">{tp("critical")}</span> : null}
                </div>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}
