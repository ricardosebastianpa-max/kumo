"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { Check, ExternalLink, Search } from "lucide-react";
import { saveStudy, setStudyDone } from "@/app/actions/study";
import { useToast } from "@/components/client/toast";
import { Button, inputCls } from "@/components/ui";

export interface StudyRow { id: string; kind: string; position: number; phase: string | null; topic: string | null; level: string | null; lang: string | null; title: string; source: string | null; type: string | null; focus: string | null; url: string | null; urlIsSearch: boolean; done: boolean; notes: string | null }
type Tab = "route" | "deep" | "channel";

function StudyItem({ r, showLevel = false, isNext, canEdit, open, setOpen, toggle, patch }: { r: StudyRow; showLevel?: boolean; isNext: boolean; canEdit: boolean; open: boolean; setOpen: (v: boolean) => void; toggle: (r: StudyRow) => void; patch: (id: string, p: Partial<StudyRow>) => void }) {
const t = useTranslations("study");
const [, start] = useTransition();
  const [notes, setNotes] = useState(r.notes ?? "");
  const [link, setLink] = useState("");
  return (
    <li className={`rounded-2xl border bg-card transition-colors ${isNext ? "border-[var(--lacquer)] shadow-[var(--shadow-1)]" : "border-line"}`} data-testid="study-row">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        {canEdit ? (
          <button type="button" onClick={() => toggle(r)} aria-pressed={r.done} aria-label={`${t("markDone")}: ${r.title}`}
            className={`mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border-2 transition-colors ${r.done ? "border-[var(--conf-confirmed)] bg-[var(--conf-confirmed)] text-white" : "border-line text-transparent hover:border-[var(--conf-confirmed)] hover:text-[var(--conf-confirmed)]"}`}>
            <Check size={20} strokeWidth={3} aria-hidden />
          </button>
        ) : null}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="grid min-w-0 flex-1 gap-1 text-left">
          <span className="flex flex-wrap items-baseline gap-x-2">
            {r.kind === "route" && <span className="font-display text-sm tabular-nums text-mute">#{r.position}</span>}
            <span className={`font-bold leading-snug ${r.done ? "text-mute line-through" : ""}`}>{r.kind === "route" && r.topic ? r.topic : r.title}</span>
          </span>
          <span className="text-sm text-ink-2">{r.kind === "route" ? r.title : null}{r.kind === "route" && r.source ? " · " : null}{r.source}{r.type ? ` · ${r.type}` : ""}{r.lang ? ` · ${r.lang}` : ""}{showLevel && r.level ? ` · ${r.level}` : ""}</span>
          {r.focus && <span className="text-sm text-mute">{r.focus}</span>}
        </button>
        {r.url && (
          <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`${r.urlIsSearch ? t("search") : t("open")}: ${r.title}`} title={r.urlIsSearch ? t("searchHint") : t("open")}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-line hover:bg-paper-2">{r.urlIsSearch ? <Search size={18} aria-hidden /> : <ExternalLink size={18} aria-hidden />}</a>
        )}
      </div>
      {open && canEdit && (
        <div className="grid gap-2 border-t border-line p-3 sm:p-4">
          <label className="grid gap-1 text-sm font-bold text-ink-2">{t("notes")}
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (r.notes ?? "") && start(async () => { await saveStudy(r.id, { notes: notes || null }); patch(r.id, { notes }); })} placeholder={t("notesPh")} className={`${inputCls} py-2 font-normal`} />
          </label>
          {r.urlIsSearch && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!/^https?:\/\/\S+\.\S+/.test(link)) return; start(async () => { await saveStudy(r.id, { url: link }); patch(r.id, { url: link, urlIsSearch: false }); setLink(""); }); }}>
              <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="https://…" aria-label={t("setLink")} className={`${inputCls} min-h-11 text-sm`} />
              <Button type="submit" variant="secondary">{t("setLink")}</Button>
            </form>
          )}
          {r.urlIsSearch && <p className="text-xs text-mute">{t("searchHint")}</p>}
        </div>
      )}
    </li>
  );
}

export function StudyView({ rows, tab, canEdit }: { rows: StudyRow[]; tab: Tab; canEdit: boolean }) {
  const t = useTranslations("study");
  const toast = useToast();
  const [items, setItems] = useState(rows);
  const [, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const byKind = (k: Tab) => items.filter((r) => r.kind === k);
  const route = byKind("route");
  const doneN = route.filter((r) => r.done).length;
  const next = route.find((r) => !r.done) ?? null;

  const toggle = (r: StudyRow) => {
    const done = !r.done;
    setItems((xs) => xs.map((x) => (x.id === r.id ? { ...x, done } : x)));
    if (done) { try { navigator.vibrate?.(12); } catch {} toast({ text: t("doneToast") }); }
    start(() => setStudyDone(r.id, done));
  };

  const patch = (id: string, p: Partial<StudyRow>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const row = (r: StudyRow, showLevel = false) => (
    <StudyItem key={r.id} r={r} showLevel={showLevel} isNext={r.id === next?.id} canEdit={canEdit} open={openId === r.id} setOpen={(v) => setOpenId(v ? r.id : null)} toggle={toggle} patch={patch} />
  );
  /* Route: phases in order, the one holding the next step open by default. */
  const phases = useMemo(() => { const m = new Map<string, StudyRow[]>(); for (const r of route) (m.get(r.phase ?? "—") ?? m.set(r.phase ?? "—", []).get(r.phase ?? "—")!).push(r); return [...m.entries()]; }, [route]);
  /* Deep: filters. */
  const deep = byKind("deep");
  const [topic, setTopic] = useState(""); const [level, setLevel] = useState(""); const [lang, setLang] = useState(""); const [hideDone, setHideDone] = useState(false);
  const topics = [...new Set(deep.map((r) => r.topic).filter(Boolean))] as string[];
  const levels = [...new Set(deep.map((r) => r.level).filter(Boolean))].sort() as string[];
  const deepShown = deep.filter((r) => (!topic || r.topic === topic) && (!level || r.level === level) && (!lang || (r.lang ?? "").includes(lang)) && (!hideDone || !r.done));
  const pct = route.length ? Math.round((doneN / route.length) * 100) : 0;

  return (
    <div className="grid max-w-3xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      <div role="tablist" aria-label={t("title")} className="flex w-fit flex-wrap rounded-2xl border border-line bg-card p-1">
        {(["route", "deep", "channel"] as const).filter((k) => byKind(k).length).map((k) => (
          <Link key={k} role="tab" aria-selected={tab === k} href={`/app/study?tab=${k}`} className={`min-h-11 content-center rounded-xl px-4 font-bold ${tab === k ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-paper-2"}`}>{t(`tabs.${k}`)}</Link>
        ))}
      </div>

      {tab === "route" && route.length > 0 && (
        <>
          <section className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-card p-5" aria-label={t("progress", { done: doneN, total: route.length })}>
            <div className="flex items-end justify-between gap-3"><p className="font-display text-5xl leading-none tabular-nums">{pct}%</p><p className="text-sm font-bold text-ink-2" data-testid="route-progress">{t("progress", { done: doneN, total: route.length })}</p></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuemin={0} aria-valuemax={route.length} aria-valuenow={doneN}><div className="h-full rounded-full bg-[var(--conf-confirmed)] transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
            <p className="text-sm text-mute">{next ? t("rule") : t("finished")}</p>
          </section>
          {phases.map(([ph, list]) => {
            const d = list.filter((r) => r.done).length;
            return (
              <details key={ph} open={list.includes(next!) || undefined} className="group grid gap-2">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl px-2 font-display text-xl">{ph}<span className="font-sans text-sm font-bold text-mute">{t("phaseDone", { done: d, total: list.length })}</span></summary>
                <ul className="mt-2 grid gap-2">{list.map((r) => row(r))}</ul>
              </details>
            );
          })}
        </>
      )}

      {tab === "deep" && (
        <>
          <p className="text-ink-2">{t("deepHint")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t("allTopics")} className={inputCls}><option value="">{t("allTopics")}</option>{topics.map((x) => <option key={x}>{x}</option>)}</select>
            <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t("allLevels")} className={inputCls}><option value="">{t("allLevels")}</option>{levels.map((x) => <option key={x}>{x}</option>)}</select>
            <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t("allLangs")} className={inputCls}><option value="">{t("allLangs")}</option><option value="ES">ES</option><option value="EN">EN</option></select>
          </div>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-ink-2"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="size-5 accent-[var(--ink)]" />{t("hideDone")}</label>
          {[...new Set(deepShown.map((r) => r.topic))].map((tp) => (
            <section key={tp ?? "—"} className="grid gap-2"><h2 className="text-xl">{tp}</h2>
              <ul className="grid gap-2">{deepShown.filter((r) => r.topic === tp).sort((a, b) => (a.level ?? "").localeCompare(b.level ?? "")).map((r) => row(r, true))}</ul>
            </section>
          ))}
        </>
      )}

      {tab === "channel" && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {byKind("channel").map((r) => (
            <li key={r.id}><a href={r.url ?? "#"} target="_blank" rel="noopener noreferrer" className="grid h-full gap-1 rounded-2xl border border-line bg-card p-4 hover:bg-paper-2">
              <span className="flex items-center justify-between gap-2 font-bold">{r.title}<span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs">{r.lang}</span></span>
              <span className="text-sm text-mute">{r.topic}</span><span className="text-sm text-ink-2">{r.focus}</span>
            </a></li>
          ))}
        </ul>
      )}
    </div>
  );
}
