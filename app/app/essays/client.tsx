"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { coachEssay, createEssay, saveEssay } from "@/app/actions/plan";
import { Button, Card, inputCls } from "@/components/ui";
import { useToast } from "@/components/client/toast";

type Essay = { id: string; title: string; prompt: string | null; wordLimit: number | null; body: string; versions: { at: string; body: string }[] };
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function EssaysClient({ essays, canEdit, canCoach, aiOn }: { essays: Essay[]; canEdit: boolean; canCoach: boolean; aiOn: boolean }) {
  const t = useTranslations("essays");
  const ta = useTranslations("ai");
  const toast = useToast();
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(essays[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const e = essays.find((x) => x.id === sel);
  const [draft, setDraft] = useState<Record<string, Partial<Essay>>>({});
  const cur = e ? { ...e, ...draft[e.id] } : null;
  const [review, setReview] = useState<string | null>(null);
  const set = (p: Partial<Essay>) => e && setDraft((d) => ({ ...d, [e.id]: { ...d[e.id], ...p } }));
  return (
    <div className="grid max-w-5xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="grid content-start gap-2">
          {essays.map((x) => <button key={x.id} type="button" onClick={() => { setSel(x.id); setReview(null); }} aria-pressed={sel === x.id} className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm font-bold ${sel === x.id ? "bg-brand text-brand-ink" : "hover:bg-paper-2"}`}>{x.title}<span className="block text-xs font-normal opacity-70">{t("words", { n: words(x.body) })}</span></button>)}
          {essays.length === 0 && <p className="text-sm text-mute">{t("empty")}</p>}
          {canEdit && <form className="grid gap-2" onSubmit={(ev) => { ev.preventDefault(); if (!title.trim()) return; start(async () => { const id = await createEssay(title); setTitle(""); setSel(id); router.refresh(); }); }}>
            <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={t("titlePh")} aria-label={t("new")} className={`${inputCls} min-h-11 text-sm`} /><Button type="submit" variant="secondary">{t("new")}</Button></form>}
        </div>
        {cur && (
          <Card className="grid gap-3 p-5">
            <input value={cur.title} disabled={!canEdit} onChange={(ev) => set({ title: ev.target.value })} aria-label="Título" className="font-display text-2xl bg-transparent outline-none" />
            <textarea value={cur.prompt ?? ""} disabled={!canEdit} onChange={(ev) => set({ prompt: ev.target.value })} placeholder={t("prompt")} aria-label={t("prompt")} rows={2} className={`${inputCls} py-2 text-sm`} />
            <label className="flex items-center gap-2 text-sm text-ink-2">{t("limit")}<input inputMode="numeric" value={cur.wordLimit ?? ""} disabled={!canEdit} onChange={(ev) => set({ wordLimit: Number(ev.target.value) || null })} className={`${inputCls} min-h-10 w-24`} /></label>
            <textarea value={cur.body} disabled={!canEdit} onChange={(ev) => set({ body: ev.target.value })} rows={16} aria-label={cur.title} className={`${inputCls} py-3 font-serif text-[1.05rem] leading-relaxed`} />
            <p className={`text-sm ${cur.wordLimit && words(cur.body) > cur.wordLimit ? "font-bold text-[var(--lacquer)]" : "text-mute"}`}>{t("words", { n: words(cur.body) })}{cur.wordLimit ? ` / ${cur.wordLimit}` : ""} · {t("versions", { n: cur.versions.length })}</p>
            <div className="flex flex-wrap gap-2">
              {canEdit && <Button disabled={pending} onClick={() => start(async () => { await saveEssay(cur.id, { title: cur.title, prompt: cur.prompt, wordLimit: cur.wordLimit, body: cur.body }); toast({ text: t("saved") }); router.refresh(); })}>{t("save")}</Button>}
              {canCoach && <Button variant="secondary" disabled={pending || !aiOn} title={aiOn ? undefined : ta("off")} onClick={() => start(async () => { setReview(ta("thinking")); const r = await coachEssay(cur.id); setReview(r.ok ? r.text! : r.off ? ta("off") : ta("error")); })}>{t("coachRun")}</Button>}
              {canEdit && cur.versions.length > 0 && <select aria-label={t("restore")} onChange={(ev) => { const v = cur.versions[Number(ev.target.value)]; if (v) set({ body: v.body }); }} defaultValue="" className={`${inputCls} min-h-11 w-auto text-sm`}><option value="" disabled>{t("restore")}</option>{cur.versions.map((v, i) => <option key={i} value={i}>{new Date(v.at).toLocaleString()} · {words(v.body)}</option>)}</select>}
            </div>
            {!aiOn && <p className="text-xs text-mute">{ta("off")}</p>}
            {review && <section className="grid gap-1 rounded-2xl bg-paper-2 p-4"><h2 className="font-sans text-sm font-bold">{t("coach")}</h2><p className="whitespace-pre-wrap text-sm leading-relaxed">{review}</p></section>}
          </Card>
        )}
      </div>
    </div>
  );
}
