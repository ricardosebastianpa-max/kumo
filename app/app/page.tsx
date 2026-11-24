import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { AlertTriangle, BookOpen, CalendarClock, ClipboardCheck, Flame, Hourglass, Layers } from "lucide-react";
import { dateInZone } from "@/lib/domain/time";
import { addDays } from "@/lib/domain/calendar";
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
  const [acts, routeAll, apps, appItems, listRows, essays] = await Promise.all([
    db.select({ at: s.activityLog.createdAt }).from(s.activityLog).where(and(eq(s.activityLog.workspaceId, ws), eq(s.activityLog.actorId, ctx.user.id), gte(s.activityLog.createdAt, new Date(now.getTime() - 60 * 864e5)))),
    db.select({ done: s.studyResource.done }).from(s.studyResource).where(and(eq(s.studyResource.workspaceId, ws), eq(s.studyResource.kind, "route"), isNull(s.studyResource.deletedAt))),
    db.select({ id: s.application.id, status: s.application.status }).from(s.application).where(and(eq(s.application.workspaceId, ws), isNull(s.application.deletedAt))),
    db.select({ a: s.applicationItem.applicationId, done: s.applicationItem.done }).from(s.applicationItem).innerJoin(s.application, eq(s.application.id, s.applicationItem.applicationId)).where(eq(s.application.workspaceId, ws)),
    db.select({ st: s.targetListItem.status }).from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ws), isNull(s.targetListItem.deletedAt))),
    db.select({ id: s.essay.id }).from(s.essay).where(and(eq(s.essay.workspaceId, ws), isNull(s.essay.deletedAt))).limit(1),
  ]);
  const todayStr = dateInZone(now, tz);
  const activeDays = new Set(acts.map((a) => dateInZone(a.at, tz)));
  let streak = 0; for (let d = activeDays.has(todayStr) ? todayStr : addDays(todayStr, -1); activeDays.has(d); d = addDays(d, -1)) streak++;
  const routeDone = routeAll.filter((r) => r.done).length;
  const appsActive = apps.filter((a) => a.status === "preparing" || a.status === "submitted" || a.status === "interview").length;
  const has = (st: string) => apps.some((a) => a.status === st);
  const halfway = apps.some((a) => { const it = appItems.filter((x) => x.a === a.id); return it.length > 0 && it.filter((x) => x.done).length / it.length >= 0.5; });
  const station = has("accepted") ? 7 : has("admitted") ? 6 : has("submitted") || has("interview") ? 5 : halfway ? 4 : essays.length ? 3 : listRows.some((l) => l.st === "pursuing") ? 2 : listRows.some((l) => l.st === "shortlist") ? 1 : 0;
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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <p className="font-bold text-ink-2">{t(greet, { name })}</p>
        <h1 className="text-[clamp(2rem,4vw,2.75rem)] leading-tight">{cap(dateTitle)}</h1>
      </div>
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
          <span className="font-bold leading-snug">{i.title}</span>
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
  const nextDl = items.filter((i) => !i.done && (i.kind === "deadline" || i.kind === "registration") && daysUntil(i, now, tz) >= 0).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  const STATIONS = ["explore", "list", "exams", "writing", "submit", "results", "decide", "depart"] as const;
  const week = Array.from({ length: 7 }, (_, k) => addDays(todayStr, k));
  const byDay = new Map<string, TodayItem[]>(); for (const i of items) { const d = dateInZone(i.startsAt, i.allDay ? i.timezone : tz); (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(i); }
  const tiles = [
    { icon: Flame, color: "#FF9F43", label: t("streakLabel"), value: String(streak), sub: t("streak", { n: streak }), href: "/app/progress" },
    { icon: BookOpen, color: "var(--sky)", label: t("routeLabel"), value: routeAll.length ? `${Math.round((routeDone / routeAll.length) * 100)}%` : "—", sub: routeAll.length ? `${routeDone}/${routeAll.length}` : "", href: "/app/study", pct: routeAll.length ? routeDone / routeAll.length : 0 },
    { icon: ClipboardCheck, color: "#A570FF", label: t("appsLabel"), value: String(appsActive), sub: t("appsActive", { n: appsActive }), href: "/app/applications" },
    { icon: Hourglass, color: "var(--brand)", label: t("nextLabel"), value: nextDl ? String(daysUntil(nextDl, now, tz)) : "—", sub: nextDl ? nextDl.title : t("nextNone"), href: nextDl ? `/app/calendar?e=${nextDl.id}` : "/app/calendar" },
  ];
  const mDays = m ? daysUntil(m, now, tz) : 0;
  const mWhen = m ? fmtWhen(m, tz, locale) : null;

  return (
    <div className="grid gap-8">
      {Header}

      {/* Kumo speaks + colourful stat tiles */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        <div className="flex items-center gap-4 rounded-3xl border-2 border-line bg-[var(--sky-soft)] p-5 shadow-[0_4px_0_var(--line-strong)]">
          <Kumo state={m ? "cheering" : "resting"} size={112} className="shrink-0" />
          <p className="relative rounded-2xl border-2 border-line bg-card px-4 py-3 font-extrabold leading-snug before:absolute before:-left-2 before:top-6 before:size-3.5 before:rotate-45 before:border-b-2 before:border-l-2 before:border-line before:bg-card">
            {m ? t("say.main", { title: m.title }) : t("say.calm")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((x) => (
            <Link key={x.label} href={x.href} className="btn3d grid content-between gap-2 rounded-3xl border-2 border-line bg-card p-4">
              <span className="flex items-center gap-2 text-sm font-extrabold text-ink-2"><x.icon size={20} strokeWidth={2.5} style={{ color: x.color }} aria-hidden />{x.label}</span>
              <span className="font-display text-4xl leading-none tabular-nums" style={{ color: x.color }}>{x.value}</span>
              <span className="truncate text-xs font-bold text-mute">{x.sub}</span>
              {"pct" in x && x.pct !== undefined ? <span className="h-2 overflow-hidden rounded-full bg-paper-2"><span className="block h-full rounded-full" style={{ width: `${Math.round(x.pct * 100)}%`, background: x.color }} /></span> : null}
            </Link>
          ))}
        </div>
      </section>

      {/* El Camino: the whole journey as stations */}
      <section aria-labelledby="path" className="grid gap-3">
        <h2 id="path" className="text-xl">{t("path")}</h2>
        <ol className="flex items-start gap-1 overflow-x-auto pb-2">
          {STATIONS.map((st, k) => {
            const done = k < station, here = k === station;
            return (
              <li key={st} className="flex min-w-[88px] flex-1 flex-col items-center gap-2 text-center">
                <div className="flex w-full items-center">
                  <span className={`h-1.5 flex-1 rounded-full ${k === 0 ? "opacity-0" : done || here ? "bg-[var(--leaf)]" : "bg-line"}`} />
                  <span className={`grid size-12 shrink-0 place-items-center rounded-full border-2 text-lg font-black ${here ? "border-[var(--sky-deep)] bg-[var(--sky)] text-white shadow-[0_4px_0_var(--sky-deep)]" : done ? "border-[var(--leaf-deep)] bg-[var(--leaf)] text-white shadow-[0_4px_0_var(--leaf-deep)]" : "border-line bg-card text-mute shadow-[0_4px_0_var(--line-strong)]"}`} aria-current={here ? "step" : undefined}>{done ? "✓" : k + 1}</span>
                  <span className={`h-1.5 flex-1 rounded-full ${k === STATIONS.length - 1 ? "opacity-0" : done ? "bg-[var(--leaf)]" : "bg-line"}`} />
                </div>
                <span className={`text-xs font-extrabold ${here ? "text-[var(--sky-deep)]" : "text-ink-2"}`}>{t(`stations.${st}`)}</span>
                {here && <span className="rounded-full bg-[var(--sun)] px-2 py-0.5 text-[10px] font-black text-[#5A3E00]">{t("here")}</span>}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Week strip */}
      <section aria-labelledby="wk" className="grid gap-3">
        <h2 id="wk" className="text-xl">{t("week")}</h2>
        <div className="grid grid-cols-7 gap-2">
          {week.map((d, k) => {
            const list = byDay.get(d) ?? [];
            return (
              <Link key={d} href={`/app/calendar?view=week&d=${d}`} className={`grid justify-items-center gap-1 rounded-2xl border-2 p-2 text-center ${k === 0 ? "border-[var(--sky)] bg-[var(--sky-soft)]" : "border-line bg-card"}`}>
                <span className="text-[11px] font-extrabold uppercase text-mute">{new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}</span>
                <span className="font-display text-xl tabular-nums">{+d.slice(8)}</span>
                <span className="flex min-h-2 flex-wrap justify-center gap-0.5">{list.slice(0, 4).map((i) => <span key={i.id} className="size-2 rounded-full" style={{ background: `var(--k-${["deadline", "registration", "window", "task", "exam", "milestone"].includes(i.kind) ? i.kind : "event"})` }} />)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-8">
          {/* The moment: a boarding pass for the one thing that matters now */}
          {m ? (
            <section aria-labelledby="main-label" className="fold enter overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-2)]">
              <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
                <div className="grid gap-3">
                  <p id="main-label" className="w-fit rounded-full bg-[var(--sun)] px-3 py-1 text-sm font-extrabold text-[#5A3E00]">{t("mainLabel")}</p>
                  <Link href={`/app/calendar?e=${m.id}`} className="font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.15] hover:underline decoration-1 underline-offset-4">{m.title}</Link>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-display text-[clamp(3.5rem,8vw,5.5rem)] leading-none tabular-nums text-[var(--brand)]">{Math.max(mDays, 0)}</p>
                  <p className="text-sm text-mute">{mDays < 0 ? t("overdue", { n: -mDays }) : th("daysLeft", { n: Math.max(mDays, 0) })}</p>
                </div>
              </div>
              <div className="perf mx-6 sm:mx-8" aria-hidden />
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5 sm:px-8">
                <div className="grid"><span className="text-xs text-mute">{t("ticketType")}</span><span className="font-bold">{tk(m.kind as "deadline")} · {tp(m.priority)}</span></div>
                <div className="grid"><span className="text-xs text-mute">{t("ticketWhen")}</span><span className="font-bold tabular-nums">{mWhen!.main}{mWhen!.original ? ` · ${mWhen!.original}` : ""}</span></div>
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
              <div className="flex items-baseline justify-between gap-3"><h2 id="n30" className="text-xl">{t("nextTitle")}</h2><Link href="/app/calendar?view=agenda" className="min-h-11 content-center text-sm font-bold text-ink-2 hover:text-ink">{t("viewCalendar")}</Link></div>
              <Card className="divide-y divide-[var(--line)]">
                {next30.slice(0, 12).map((i) => {
                  const d = daysUntil(i, now, tz);
                  return (
                    <div key={i.id} className="flex items-center gap-4 px-5 py-3">
                      <span className="w-10 shrink-0 text-right font-display text-xl leading-none tabular-nums text-ink-2">{d}</span>
                      <div className="min-w-0 flex-1"><Row i={i} /></div>
                      {i.priority === "critical" ? <span className="shrink-0 text-xs font-bold text-[var(--lacquer)]">{tp("critical")}</span> : null}
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
                {todayBlocks.map((b) => <Link key={b.id} href={`/app/focus?s=${encodeURIComponent(b.title)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-2/60"><span className="font-bold">{b.title}</span><span className="text-sm tabular-nums text-mute">{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(b.startsAt)}</span></Link>)}
              </Card>
            ) : <p className="text-ink-2">{t("agendaEmpty")}</p>}
          </section>
          {routeNext && (
            <Link href="/app/study" className="grid gap-1 rounded-2xl border border-line bg-card p-5 transition-colors hover:bg-paper-2/60" data-testid="today-study">
              <span className="flex items-center gap-2 text-sm font-bold text-ink-2"><BookOpen size={16} strokeWidth={1.5} aria-hidden />{ts("next")}</span>
              <span className="font-bold">#{routeNext.position} · {routeNext.topic ?? routeNext.title}</span>
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
