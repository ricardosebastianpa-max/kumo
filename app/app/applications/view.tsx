"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Check, Lock, Plus } from "lucide-react";
import { addAppItem, toggleAppItem, updateApplication } from "@/app/actions/plan";
import { Button, Card, inputCls } from "@/components/ui";
import { Kumo } from "@/components/kumo";
import { useToast } from "@/components/client/toast";

type Item = { id: string; key: string; label: string; done: boolean; dependsOn: string[] };
type App = { id: string; title: string; status: string; portalUrl: string | null; portalUser: string | null; appNumber: string | null; notes: string | null; submittedAt: string | null; href: string | null; items: Item[] };
const STATUSES = ["preparing", "submitted", "interview", "admitted", "waitlisted", "rejected", "accepted", "declined"] as const;

export function AppsView({ apps: initial, canEdit }: { apps: App[]; canEdit: boolean }) {
  const t = useTranslations("apps");
  const locale = useLocale();
  const toast = useToast();
  const [apps, setApps] = useState(initial);
  const [, start] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const blockedBy = (a: App, i: Item) => i.dependsOn.map((k) => a.items.find((x) => x.key === k)).filter((x) => x && !x.done).map((x) => x!.label);
  const toggle = (a: App, i: Item) => {
    setApps((as) => as.map((x) => (x.id === a.id ? { ...x, items: x.items.map((y) => (y.id === i.id ? { ...y, done: !y.done } : y)) } : x)));
    start(() => toggleAppItem(i.id, !i.done));
  };
  const patch = (a: App, p: Partial<App>) => {
    setApps((as) => as.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
    start(async () => { await updateApplication(a.id, p as never); });
    if (p.status === "submitted") { setCelebrate(true); toast({ text: t("celebrate") }); setTimeout(() => setCelebrate(false), 3500); }
  };
  const missing = apps.filter((a) => a.status === "preparing").flatMap((a) => a.items.filter((i) => !i.done).map((i) => ({ a, i })));
  return (
    <div className="grid max-w-3xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      {celebrate && <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,20,34,.25)]" aria-hidden><Kumo state="celebrating" size={220} className="kumo-float text-ink" /></div>}
      {missing.length > 0 && (
        <details className="rounded-[var(--radius-card)] border border-line bg-card p-4">
          <summary className="min-h-10 cursor-pointer content-center font-display text-xl">{t("missing")} <span className="font-sans text-sm text-mute">· {missing.length}</span></summary>
          <ul className="mt-3 grid gap-1.5 text-sm">{missing.slice(0, 40).map(({ a, i }) => { const b = blockedBy(a, i); return <li key={i.id} className="flex gap-2"><span className="font-bold">{a.title}:</span><span>{i.label}</span>{b.length ? <span className="text-mute">({t("blocked", { by: b.join(", ") })})</span> : null}</li>; })}</ul>
        </details>
      )}
      {apps.map((a) => {
        const done = a.items.filter((i) => i.done).length, pct = a.items.length ? Math.round((done / a.items.length) * 100) : 0;
        return (
          <Card key={a.id} className="grid gap-4 p-5" data-testid="application">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">{a.href ? <Link href={a.href} className="font-display text-2xl hover:underline">{a.title}</Link> : <h2 className="text-2xl">{a.title}</h2>}
                <p className="text-sm text-mute">{a.submittedAt ? t("submittedOn", { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(a.submittedAt)) }) : t("progress", { done, total: a.items.length })}</p></div>
              <select value={a.status} disabled={!canEdit} onChange={(e) => patch(a, { status: e.target.value })} aria-label={t("status")} className={`${inputCls} w-auto min-h-11`}>{STATUSES.map((st) => <option key={st} value={st}>{t(`statuses.${st}`)}</option>)}</select>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-[var(--conf-confirmed)] transition-[width]" style={{ width: `${pct}%` }} /></div>
            <ul className="grid gap-1.5">
              {a.items.map((i) => { const b = blockedBy(a, i); return (
                <li key={i.id} className="flex items-center gap-3">
                  <button type="button" disabled={!canEdit || (b.length > 0 && !i.done)} onClick={() => toggle(a, i)} aria-pressed={i.done} aria-label={i.label}
                    className={`grid size-11 shrink-0 place-items-center rounded-full border-2 ${i.done ? "border-[var(--conf-confirmed)] bg-[var(--conf-confirmed)] text-white" : "border-line text-mute"}`}>{b.length && !i.done ? <Lock size={14} aria-hidden /> : <Check size={18} strokeWidth={3} aria-hidden className={i.done ? "" : "opacity-0"} />}</button>
                  <span className={`text-sm ${i.done ? "text-mute line-through" : ""}`}>{i.label}{b.length && !i.done ? <span className="block text-xs text-mute">{t("blocked", { by: b.join(", ") })}</span> : null}</span>
                </li>); })}
            </ul>
            {pct === 100 && a.status === "preparing" && <p className="font-bold text-[var(--conf-confirmed)]">{t("allDone")}</p>}
            {canEdit && <AppExtras a={a} onPatch={(p) => patch(a, p)} onAdd={(label) => start(async () => { await addAppItem(a.id, label); })} />}
          </Card>
        );
      })}
    </div>
  );
}

function AppExtras({ a, onPatch, onAdd }: { a: App; onPatch: (p: Partial<App>) => void; onAdd: (l: string) => void }) {
  const t = useTranslations("apps");
  const [step, setStep] = useState("");
  const [f, setF] = useState({ portalUrl: a.portalUrl ?? "", portalUser: a.portalUser ?? "", appNumber: a.appNumber ?? "", notes: a.notes ?? "" });
  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (step.trim()) { onAdd(step.trim()); setStep(""); } }}>
        <input value={step} onChange={(e) => setStep(e.target.value)} placeholder={t("addItem")} aria-label={t("addItem")} className={`${inputCls} min-h-11 text-sm`} />
        <button type="submit" aria-label={t("addItem")} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line hover:bg-paper-2"><Plus size={18} aria-hidden /></button>
      </form>
      <details><summary className="min-h-10 cursor-pointer content-center text-sm font-bold text-ink-2">{t("portal")} · {t("appNumber")} · {t("notes")}</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={f.portalUrl} onChange={(e) => setF({ ...f, portalUrl: e.target.value })} placeholder={t("portal")} aria-label={t("portal")} className={`${inputCls} min-h-11 text-sm`} />
          <input value={f.portalUser} onChange={(e) => setF({ ...f, portalUser: e.target.value })} placeholder={t("portalUser")} aria-label={t("portalUser")} autoComplete="off" className={`${inputCls} min-h-11 text-sm`} />
          <input value={f.appNumber} onChange={(e) => setF({ ...f, appNumber: e.target.value })} placeholder={t("appNumber")} aria-label={t("appNumber")} className={`${inputCls} min-h-11 text-sm`} />
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={t("notes")} aria-label={t("notes")} rows={2} className={`${inputCls} py-2 text-sm sm:col-span-2`} />
          <Button type="button" variant="secondary" onClick={() => onPatch({ portalUrl: f.portalUrl || null, portalUser: f.portalUser || null, appNumber: f.appNumber || null, notes: f.notes || null })} className="justify-self-start">{t("save")}</Button>
        </div>
      </details>
    </div>
  );
}
