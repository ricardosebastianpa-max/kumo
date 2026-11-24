import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { AlertTriangle, BookOpen, CalendarClock, Layers } from "lucide-react";
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

export default async function Today() {
  const ctx = await requireWorkspace();
  if (ctx.role === "guardian") redirect("/app/family");
  const [t, tc, tk, tp, th, ts, locale] = await Promise.all([getTranslations("today"), getTranslations("common"), getTranslations("kinds"), getTranslations("priority"), getTranslations("home"), getTranslations("study"), getLocale()]);
  const ws = ctx.workspace.id;
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const now = new Date();
  const canView = can(ctx.actor, "view", { workspaceId: ws, module: "calendar" });
  const canEdit = can(ctx.actor, "edit", { workspaceId: ws, module: "calendar" });
  const [rows, [routeNext]] = await Promise.all([
    canView ? db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), gte(s.event.startsAt, new Date(now.getTime() - 15 * 864e5)), lte(s.event.startsAt, new Date(now.getTime() + 32 * 864e5)))).orderBy(asc(s.event.startsAt)) : Promise.resolve([]),
    can(ctx.actor, "view", { workspaceId: ws, module: "study" }) ? db.select().from(s.studyResource).where(and(eq(s.studyResource.workspaceId, ws), eq(s.studyResource.kind, "route"), eq(s.studyResource.done, false), isNull(s.studyResource.deletedAt))).orderBy(asc(s.studyResource.position)).limit(1) : Promise.resolve([]),
  ]);
  const items: TodayItem[] = rows.filter((r) => r.kind !== "study_block").map((r) => ({ id: r.id, title: r.title, kind: r.kind, startsAt: r.startsAt, allDay: r.allDay, timezone: r.timezone, priority: r.priority, confidence: r.confidence, done: !!r.completedAt }));
  const blocks = rows.filter((r) => r.kind === "study_block" && !r.completedAt);
  const plan = planToday(items, now, tz);
  const next30 = items.filter((i) => !i.done && daysUntil(i, now, tz) >= 0 && daysUntil(i, now, tz) <= 30 && i.id !== plan.main?.id && !plan.secondary.some((x) => x.id === i.id));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  const greet = hour < 12 ? "morning" : hour < 19 ? "afternoon" : "evening";
  const name = (ctx.user.name || "").split(" ")[0];
  const dateTitle = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now);
  const cap = (x: string) => x.charAt(0).toLocaleUpperCase(locale) + x.slice(1);
  const isTask = (k: string) => k === "task" || k === "milestone";
  const when = (i: TodayItem) => { const d = daysUntil(i, now, tz); return d < 0 ? t("overdue", { n: -d }) : t("inDays", { n: d }); };
  const byId = new Map(items.map((i) => [i.id, i]));
  const todayBlocks = blocks.filter((b) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(b.startsAt) === new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now));

  const Header = (
    <header className="grid gap-1">
      <p className="text-ink-2">{t(greet, { name })}</p>
      <h1 className="text-[clamp(2rem,4vw,2.75rem)] leading-tight">{cap(dateTitle)}</h1>
    </header>
  );

  if (!items.length) return (
    <div className="grid max-w-2xl gap-8">
      {Header}
      <Card className="grid justify-items-start gap-4 p-8">
        <Kumo state="resting" size={110} className="text-ink" />
        <h2 className="text-2xl">{t("emptyTitle")}</h2>
        <p className="text-lg text-ink-2">{ctx.role === "owner" ? t("emptyBody") : th("noData")}</p>
        {ctx.role === "owner" && <ButtonLink href="/app/import">{th("importCta")}</ButtonLink>}
      </Card>
    </div>
  );

  const Row = ({ i }: { i: TodayItem }) => {
    const w = fmtWhen(i, tz, locale);
    return (
      <div className="flex items-center gap-3">
        {canEdit && isTask(i.kind) ? <DoneButton id={i.id} done={i.done} /> : null}
        <Link href={`/app/calendar?e=${i.id}`} className="grid min-w-0 flex-1 gap-0.5 py-1">
          <span className="font-medium leading-snug">{i.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
            <span>{tk(i.kind as "deadline")}</span><span aria-hidden>·</span><span>{w.main}</span>
            {w.original ? <span>({w.original})</span> : null}
            {i.confidence !== "confirmed" ? <ConfidenceBadge level={i.confidence} label={tc(`confidence.${i.confidence}`)} /> : null}
          </span>
        </Link>
      </div>
    );
  };

  const m = plan.main;
  const mDays = m ? daysUntil(m, now, tz) : 0;
  const mWhen = m ? fmtWhen(m, tz, locale) : null;

  return (
    <div className="grid gap-8">
      {Header}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-8">
          {/* The moment: a boarding pass for the one thing that matters now */}
          {m ? (
            <section aria-labelledby="main-label" className="fold enter overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-2)]">
              <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
                <div className="grid gap-3">
                  <p id="main-label" className="text-sm font-medium text-[var(--lacquer)]">{t("mainLabel")}</p>
                  <Link href={`/app/calendar?e=${m.id}`} className="font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.15] hover:underline decoration-1 underline-offset-4">{m.title}</Link>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-display text-[clamp(3.5rem,8vw,5.5rem)] leading-none tabular-nums">{Math.max(mDays, 0)}</p>
                  <p className="text-sm text-mute">{mDays < 0 ? t("overdue", { n: -mDays }) : th("daysLeft", { n: Math.max(mDays, 0) })}</p>
                </div>
              </div>
              <div className="perf mx-6 sm:mx-8" aria-hidden />
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5 sm:px-8">
                <div className="grid"><span className="text-xs text-mute">{t("ticketType")}</span><span className="font-medium">{tk(m.kind as "deadline")} · {tp(m.priority)}</span></div>
                <div className="grid"><span className="text-xs text-mute">{t("ticketWhen")}</span><span className="font-medium tabular-nums">{mWhen!.main}{mWhen!.original ? ` · ${mWhen!.original}` : ""}</span></div>
                {m.confidence !== "confirmed" && <ConfidenceBadge level={m.confidence} label={tc(`confidence.${m.confidence}`)} />}
                <div className="ml-auto flex items-center gap-3">
                  {canEdit && isTask(m.kind) ? <DoneButton id={m.id} done={m.done} /> : null}
                  <Kumo state="focused" size={56} className="text-ink max-sm:hidden" />
                </div>
              </div>
            </section>
          ) : (
            <Card className="flex items-center gap-4 p-6"><Kumo state="resting" size={64} className="text-ink" /><p className="text-lg text-ink-2">{t("allClear")}</p></Card>
          )}

          {plan.secondary.length > 0 && (
            <section className="grid gap-3" aria-labelledby="sec">
              <h2 id="sec" className="text-xl">{t("secondaryLabel")}</h2>
              <Card className="divide-y divide-[var(--line)]">
                {plan.secondary.map((i) => <div key={i.id} className="flex items-center gap-3 px-5 py-3"><div className="min-w-0 flex-1"><Row i={i} /></div><span className="shrink-0 text-sm text-ink-2">{when(i)}</span></div>)}
              </Card>
            </section>
          )}

          {next30.length > 0 && (
            <section className="grid gap-3" aria-labelledby="n30">
              <div className="flex items-baseline justify-between gap-3"><h2 id="n30" className="text-xl">{t("nextTitle")}</h2><Link href="/app/calendar?view=agenda" className="min-h-11 content-center text-sm font-medium text-ink-2 hover:text-ink">{t("viewCalendar")}</Link></div>
              <Card className="divide-y divide-[var(--line)]">
                {next30.slice(0, 12).map((i) => {
                  const d = daysUntil(i, now, tz);
                  return (
                    <div key={i.id} className="flex items-center gap-4 px-5 py-3">
                      <span className="w-10 shrink-0 text-right font-display text-xl leading-none tabular-nums text-ink-2">{d}</span>
                      <div className="min-w-0 flex-1"><Row i={i} /></div>
                      {i.priority === "critical" ? <span className="shrink-0 text-xs font-medium text-[var(--lacquer)]">{tp("critical")}</span> : null}
                    </div>
                  );
                })}
              </Card>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-6">
          <section className="grid gap-3" aria-labelledby="day">
            <h2 id="day" className="text-xl">{t("agendaTitle")}</h2>
            {plan.agenda.length || todayBlocks.length ? (
              <Card className="divide-y divide-[var(--line)]">
                {plan.agenda.map((i) => <div key={i.id} className="px-4 py-2"><Row i={i} /></div>)}
                {todayBlocks.map((b) => <Link key={b.id} href={`/app/focus?s=${encodeURIComponent(b.title)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-2/60"><span className="font-medium">{b.title}</span><span className="text-sm tabular-nums text-mute">{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(b.startsAt)}</span></Link>)}
              </Card>
            ) : <p className="text-ink-2">{t("agendaEmpty")}</p>}
          </section>
          {routeNext && (
            <Link href="/app/study" className="grid gap-1 rounded-2xl border border-line bg-card p-5 transition-colors hover:bg-paper-2/60" data-testid="today-study">
              <span className="flex items-center gap-2 text-sm font-medium text-ink-2"><BookOpen size={16} strokeWidth={1.5} aria-hidden />{ts("next")}</span>
              <span className="font-medium">#{routeNext.position} · {routeNext.topic ?? routeNext.title}</span>
              <span className="truncate text-sm text-mute">{routeNext.title}{routeNext.source ? ` · ${routeNext.source}` : ""}</span>
            </Link>
          )}
          {plan.alerts.map((a) => (
            <div key={a.type} className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
              {a.type === "verify" ? <AlertTriangle size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[var(--conf-estimated)]" aria-hidden /> : a.type === "cluster" ? <Layers size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-mute" aria-hidden /> : <CalendarClock size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-mute" aria-hidden />}
              <div className="grid gap-1">
                <p className="text-sm text-ink">{a.type === "verify" ? t("alertVerify", { n: a.itemIds.length }) : a.type === "overdue" ? t("alertOverdue", { n: a.itemIds.length }) : t("alertCluster", { n: a.itemIds.length })}</p>
                <p className="text-xs text-mute">{a.itemIds.slice(0, 3).map((id) => byId.get(id)?.title).join(" · ")}</p>
              </div>
            </div>
          ))}
          <CalmButton main={m?.title ?? null} />
        </aside>
      </div>
    </div>
  );
}
