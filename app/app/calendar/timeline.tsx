"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { daysBetween } from "@/lib/domain/time";
import { addMonths } from "@/lib/domain/calendar";

export interface TlRow { key: string; name: string; href: string; stage: string; events: { id: string; date: string; kind: string; title: string; done: boolean; estimated: boolean }[] }

/** Roadmap: one row per option, months across. Windows as bars (window → next deadline), deadlines as diamonds, tasks as circles. */
export function Timeline({ rows, from, months, today, onOpen, onlyList, toggleHref }: { rows: TlRow[]; from: string; months: number; today: string; onOpen: (id: string) => void; onlyList: boolean; toggleHref: string }) {
  const t = useTranslations("timeline");
  const tl = useTranslations("list");
  const locale = useLocale();
  const to = addMonths(from, months);
  const span = daysBetween(from, to);
  const pct = (d: string) => `${Math.min(100, Math.max(0, (daysBetween(from, d) / span) * 100))}%`;
  const ms = Array.from({ length: months }, (_, i) => addMonths(from, i));
  const fmtM = (d: string) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const fmtD = (d: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const inRange = (d: string) => d >= from && d < to;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={toggleHref} aria-pressed={onlyList} className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${onlyList ? "border-[var(--ink)] bg-paper-2" : "border-line"}`}>{onlyList ? `✓ ${t("onlyList")}` : t("onlyList")}</Link>
        <p className="text-sm text-mute">{t("legend")}</p>
      </div>
      {rows.length === 0 ? <p className="rounded-2xl border border-line bg-card p-6 text-ink-2">{t("empty")}</p> : (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="min-w-[760px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-card" data-testid="timeline">
            <div className="grid grid-cols-[220px_1fr] border-b border-line">
              <div />
              <div className="relative h-9">
                {ms.map((m) => <span key={m} className="absolute top-0 flex h-full items-center border-l border-line pl-2 text-xs font-semibold uppercase tracking-wide text-mute" style={{ left: pct(m) }}>{fmtM(m)}</span>)}
              </div>
            </div>
            {rows.map((r) => {
              const evs = r.events.filter((e) => inRange(e.date));
              const bars: { a: string; b: string }[] = [];
              for (const w of r.events.filter((e) => e.kind === "window")) {
                const end = r.events.find((e) => e.kind === "deadline" && e.date >= w.date);
                if (end && (inRange(w.date) || inRange(end.date) || (w.date < from && end.date >= to))) bars.push({ a: w.date < from ? from : w.date, b: end.date >= to ? to : end.date });
              }
              return (
                <div key={r.key} className="grid grid-cols-[220px_1fr] border-b border-line last:border-0">
                  <Link href={r.href} className="grid content-center gap-0.5 border-r border-line px-3 py-2 hover:bg-paper-2">
                    <span className="truncate text-sm font-semibold">{r.name}</span>
                    <span className={`text-xs ${r.stage === "pursuing" ? "font-semibold text-[var(--lacquer)]" : "text-mute"}`}>{tl(`stages.${r.stage}` as "stages.shortlist")}</span>
                  </Link>
                  <div className="relative h-14">
                    {ms.map((m) => <span key={m} className="absolute inset-y-0 border-l border-line/70" style={{ left: pct(m) }} aria-hidden />)}
                    {today >= from && today < to && <span className="absolute inset-y-0 w-0.5 bg-[var(--lacquer)]" style={{ left: pct(today) }} aria-hidden />}
                    {bars.map((b, i) => <span key={i} className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--k-window)_35%,transparent)]" style={{ left: pct(b.a), width: `calc(${pct(b.b)} - ${pct(b.a)})` }} aria-hidden />)}
                    {evs.map((e) => (
                      <button key={e.id} type="button" onClick={() => onOpen(e.id)} title={`${fmtD(e.date)} · ${e.title}`} aria-label={`${fmtD(e.date)}: ${e.title}`}
                        className="absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg hover:bg-paper-2" style={{ left: pct(e.date) }}>
                        <span className={`block ${e.kind === "deadline" || e.kind === "registration" ? "size-3 rotate-45 rounded-[2px]" : "size-3 rounded-full"} ${e.done ? "opacity-40" : ""}`}
                          style={{ background: e.estimated ? "transparent" : `var(--k-${e.kind in { deadline: 1, registration: 1, window: 1, task: 1, exam: 1, milestone: 1 } ? e.kind : "event"})`, border: `2px ${e.estimated ? "dashed" : "solid"} var(--k-${e.kind in { deadline: 1, registration: 1, window: 1, task: 1, exam: 1, milestone: 1 } ? e.kind : "event"})` }} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
