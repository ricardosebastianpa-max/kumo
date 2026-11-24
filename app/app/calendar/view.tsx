"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, monthGrid, weekDays } from "@/lib/domain/calendar";
import { moveEvent } from "@/app/actions/events";
import { useToast } from "@/components/client/toast";
import { EventSheet } from "./sheet";
import { Timeline, type TlRow } from "./timeline";

export interface CalEvent {
  id: string; title: string; kind: string; date: string; time: string | null; original: string | null;
  confidence: "confirmed" | "estimated" | "unverified"; priority: string; done: boolean; sortKey: string;
}
type View = "month" | "week" | "agenda" | "year" | "timeline";
const LAYERS = ["deadline", "exam", "registration", "window", "task", "milestone", "interview", "study_block", "personal", "event"] as const;
const layerOf = (k: string) => ((LAYERS as readonly string[]).includes(k) ? k : "event");
const color = (k: string) => `var(--k-${layerOf(k)})`;

export function CalendarView(p: { timeline?: { rows: TlRow[]; from: string; months: number; onlyList: boolean }; view: View; anchor: string; today: string; events: CalEvent[]; hidden: string[]; canEdit: boolean; openId: string | null; userTz: string }) {
  const t = useTranslations("calendar");
  const tk = useTranslations("kinds");
  const locale = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const [events, setEvents] = useState(p.events);
  useEffect(() => setEvents(p.events), [p.events]);
  const [openId, setOpenId] = useState<string | null>(p.openId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [, start] = useTransition();

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    q.delete("e");
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") q.delete(k); else q.set(k, v); }
    return `/app/calendar?${q.toString()}`;
  };
  const hidden = new Set(p.hidden);
  const visible = useMemo(() => events.filter((e) => !hidden.has(layerOf(e.kind))), [events, p.hidden]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = useMemo(() => { const m = new Map<string, CalEvent[]>(); for (const e of visible) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e); return m; }, [visible]);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

  const move = (id: string, to: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev || ev.date === to) return;
    const from = ev.date;
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, date: to } : e)));
    start(async () => {
      await moveEvent(id, to);
      toast({ text: t("moved", { date: fmt(to, { weekday: "short", day: "numeric", month: "short" }) }), action: { label: "↺", run: () => { setEvents((es) => es.map((e) => (e.id === id ? { ...e, date: from } : e))); start(() => moveEvent(id, from)); } } });
      router.refresh();
    });
  };
  const dropProps = (day: string) => p.canEdit ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverDay(day); },
    onDragLeave: () => setOverDay((d) => (d === day ? null : d)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setOverDay(null); setDragId(null); if (id) move(id, day); },
  } : {};

  const Chip = ({ e, compact = false }: { e: CalEvent; compact?: boolean }) => (
    <button type="button" draggable={p.canEdit} onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.effectAllowed = "move"; setDragId(e.id); }} onDragEnd={() => setDragId(null)}
      onClick={() => setOpenId(e.id)} title={`${e.title}${e.original ? ` · ${e.original}` : ""}`}
      className={`group flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 text-left text-xs font-medium leading-tight transition-opacity ${compact ? "min-h-6 py-0.5" : "min-h-9 py-1.5 text-sm"} ${dragId === e.id ? "opacity-40" : ""} ${e.done ? "line-through opacity-60" : ""}`}
      style={{ background: `color-mix(in srgb, ${color(e.kind)} 12%, transparent)`, color: "var(--ink)", outline: e.confidence !== "confirmed" ? `1.5px dashed color-mix(in srgb, ${color(e.kind)} 70%, transparent)` : undefined, outlineOffset: "-1.5px" }}
      data-testid="cal-event">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color(e.kind) }} aria-hidden />
      <span className="truncate">{e.time ? <span className="text-mute">{e.time} </span> : null}{e.title}</span>
      <span className="sr-only">, {tk(layerOf(e.kind))}{e.confidence !== "confirmed" ? `, ${e.confidence}` : ""}</span>
    </button>
  );

  const prev = p.view === "timeline" ? addMonths(p.anchor, -2) : p.view === "month" ? addMonths(p.anchor, -1) : p.view === "week" ? addDays(p.anchor, -7) : p.view === "year" ? `${+p.anchor.slice(0, 4) - 1}-01-01` : addDays(p.anchor, -30);
  const next = p.view === "timeline" ? addMonths(p.anchor, 2) : p.view === "month" ? addMonths(p.anchor, 1) : p.view === "week" ? addDays(p.anchor, 7) : p.view === "year" ? `${+p.anchor.slice(0, 4) + 1}-01-01` : addDays(p.anchor, 30);
  const cap = (x: string) => x.charAt(0).toLocaleUpperCase(locale) + x.slice(1);
  const heading0 = p.view === "year" ? p.anchor.slice(0, 4) : p.view === "week" ? t("weekOf", { date: fmt(weekDays(p.anchor)[0], { day: "numeric", month: "long" }) }) : fmt(p.anchor, { month: "long", year: "numeric" });
  const heading = cap(heading0);
  const [sel, setSel] = useState<string>(p.anchor.slice(0, 7) === p.today.slice(0, 7) ? p.today : p.anchor);
  useEffect(() => setSel(p.anchor.slice(0, 7) === p.today.slice(0, 7) ? p.today : p.anchor), [p.anchor, p.today]);
  const dows = weekDays("2026-11-23").map((d) => fmt(d, { weekday: "short" }));

  return (
    <div className="grid gap-5 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h1 className="mr-2 text-3xl sm:text-4xl">{heading}</h1>
          <Link href={href({ d: prev })} aria-label={t("prev")} className="grid size-11 place-items-center rounded-xl hover:bg-paper-2"><ChevronLeft size={20} aria-hidden /></Link>
          <Link href={href({ d: next })} aria-label={t("next")} className="grid size-11 place-items-center rounded-xl hover:bg-paper-2"><ChevronRight size={20} aria-hidden /></Link>
          <Link href={href({ d: null })} className="min-h-11 content-center rounded-xl px-3 text-sm font-medium hover:bg-paper-2">{t("today")}</Link>
        </div>
        <div role="tablist" aria-label={t("title")} className="flex rounded-xl border border-line bg-card p-1">
          {(["month", "week", "agenda", "timeline", "year"] as const).map((v) => (
            <Link key={v} role="tab" aria-selected={p.view === v} href={href({ view: v === "month" ? null : v })}
              className={`min-h-10 content-center rounded-lg px-3 text-sm font-medium ${p.view === v ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-paper-2"}`}>{t(v)}</Link>
          ))}
        </div>
      </div>

      {p.view !== "timeline" && <details className="rounded-2xl border border-line bg-card px-4 py-2 open:pb-4">
        <summary className="min-h-10 cursor-pointer content-center text-sm font-medium">{t("layers")} <span className="font-normal text-mute">· {t("estimatedLegend")}</span></summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {LAYERS.map((k) => {
            const on = !hidden.has(k);
            const nextHidden = on ? [...hidden, k] : [...hidden].filter((x) => x !== k);
            return (
              <Link key={k} href={href({ hide: nextHidden.join(",") })} aria-pressed={on} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium ${on ? "border-line bg-paper-2" : "border-dashed border-line text-mute"}`}>
                <span className="size-2.5 rounded-full" style={{ background: on ? color(k) : "transparent", border: `1.5px solid ${color(k)}` }} aria-hidden />{tk(k)}
              </Link>
            );
          })}
        </div>
      </details>}

      {p.view === "month" && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card">
          <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium uppercase tracking-wide text-mute">{dows.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {monthGrid(p.anchor).map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === p.anchor.slice(0, 7);
              return (
                <div key={d} {...dropProps(d)} className={`relative min-h-14 border-b border-r border-line p-1 sm:min-h-28 ${inMonth ? "" : "bg-paper-2/60"} ${overDay === d ? "bg-lacquer-soft" : ""} ${sel === d ? "max-sm:bg-paper-2" : ""}`}>
                  <button type="button" onClick={() => setSel(d)} aria-label={`${fmt(d, { weekday: "long", day: "numeric", month: "long" })}: ${list.length}`} aria-pressed={sel === d} className="absolute inset-0 sm:hidden" />
                  <Link href={href({ view: "week", d })} className={`mb-1 inline-grid size-7 place-items-center rounded-full text-xs font-medium max-sm:pointer-events-none ${d === p.today ? "bg-[var(--lacquer)] text-white" : inMonth ? "text-ink-2" : "text-mute"}`}>{+d.slice(8)}</Link>
                  <div className="flex flex-wrap gap-0.5 px-1 sm:hidden" aria-hidden>{list.slice(0, 4).map((e) => <span key={e.id} className="size-1.5 rounded-full" style={{ background: color(e.kind) }} />)}</div>
                  <div className="hidden gap-0.5 sm:grid">
                    {list.slice(0, 3).map((e) => <Chip key={e.id} e={e} compact />)}
                    {list.length > 3 && <Link href={href({ view: "week", d })} className="px-1.5 text-xs font-medium text-mute hover:underline">{t("more", { n: list.length - 3 })}</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {p.view === "month" && (
        <section className="grid gap-1.5 sm:hidden" aria-live="polite">
          <h2 className="font-sans text-sm font-medium text-ink-2">{cap(fmt(sel, { weekday: "long", day: "numeric", month: "long" }))}</h2>
          {(byDay.get(sel) ?? []).length ? (byDay.get(sel) ?? []).map((e) => <Chip key={e.id} e={e} />) : <p className="text-sm text-mute">{t("noEvents")}</p>}
        </section>
      )}

      {p.view === "week" && (
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays(p.anchor).map((d) => (
            <section key={d} {...dropProps(d)} aria-label={fmt(d, { weekday: "long", day: "numeric", month: "long" })}
              className={`grid min-h-32 content-start gap-1.5 rounded-2xl border border-line bg-card p-2 ${overDay === d ? "bg-lacquer-soft" : ""}`}>
              <p className={`text-sm font-medium ${d === p.today ? "text-[var(--lacquer)]" : "text-ink-2"}`}>{fmt(d, { weekday: "short", day: "numeric" })}</p>
              {(byDay.get(d) ?? []).map((e) => <Chip key={e.id} e={e} />)}
            </section>
          ))}
        </div>
      )}

      {p.view === "agenda" && (
        visible.length === 0 ? <p className="text-ink-2">{t("noEvents")}</p> : (
          <div className="grid gap-4">
            {[...byDay.entries()].map(([d, list]) => (
              <section key={d} className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <h2 className={`pt-2 font-sans text-sm font-medium ${d === p.today ? "text-[var(--lacquer)]" : "text-ink-2"}`}>{fmt(d, { weekday: "long", day: "numeric", month: "short" })}</h2>
                <div className="grid gap-1.5">{list.map((e) => (
                  <div key={e.id} className="grid gap-0.5"><Chip e={e} />{e.original ? <p className="pl-6 text-xs text-mute">{e.original}</p> : null}</div>
                ))}</div>
              </section>
            ))}
          </div>
        )
      )}

      {p.view === "timeline" && p.timeline && (
        <Timeline {...p.timeline} today={p.today} onOpen={(id) => setOpenId(id)} toggleHref={href({ list: p.timeline.onlyList ? "all" : null })} />
      )}

      {p.view === "year" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }, (_, m) => `${p.anchor.slice(0, 4)}-${String(m + 1).padStart(2, "0")}-01`).map((ms) => (
            <section key={ms} className="rounded-2xl border border-line bg-card p-3">
              <Link href={href({ view: null, d: ms })} className="mb-2 block min-h-8 text-sm font-medium capitalize hover:underline">{fmt(ms, { month: "long" })}</Link>
              <div className="grid grid-cols-7 gap-0.5">
                {monthGrid(ms).map((d) => {
                  const n = d.slice(0, 7) === ms.slice(0, 7) ? (byDay.get(d)?.length ?? 0) : -1;
                  const crit = (byDay.get(d) ?? []).some((e) => e.priority === "critical");
                  return n < 0 ? <span key={d} /> : (
                    <Link key={d} href={href({ view: "week", d })} aria-label={`${fmt(d, { day: "numeric", month: "long" })}: ${n}`}
                      className="grid aspect-square place-items-center rounded-md text-[10px] font-medium"
                      style={{ background: n ? `color-mix(in srgb, var(--lacquer) ${Math.min(14 + n * 18, 80)}%, transparent)` : "var(--paper-2)", color: n > 2 ? "white" : "var(--ink-2)", outline: crit ? "1.5px solid var(--lacquer)" : undefined, outlineOffset: crit ? "1px" : undefined }}>
                      {+d.slice(8)}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {p.canEdit && (p.view === "month" || p.view === "week" || p.view === "agenda") && <p className="text-sm text-mute">{t("dragHint")}</p>}
      <EventSheet id={openId} onClose={() => setOpenId(null)} userTz={p.userTz} />
    </div>
  );
}
