"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { saveRecommender } from "@/app/actions/plan";
import { Button, Card, inputCls } from "@/components/ui";

type Rec = { id: string; name: string; role: string | null; ask: string | null; dueOn: string | null; status: string; replyNote: string | null; link: string | null };
const ST = ["to_ask", "asked", "in_progress", "sent", "thanked"] as const;
export function RecsView({ recs, canEdit }: { recs: Rec[]; canEdit: boolean }) {
  const t = useTranslations("recs");
  const [, start] = useTransition();
  const [f, setF] = useState({ name: "", role: "", ask: "", dueOn: "" });
  return (
    <div className="grid max-w-3xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      <ul className="grid gap-3">
        {recs.map((r) => (
          <li key={r.id}><Card className="grid gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{r.name}</p><p className="text-sm text-mute">{[r.role, r.dueOn].filter(Boolean).join(" · ")}</p></div>
              <select disabled={!canEdit} defaultValue={r.status} onChange={(e) => start(() => saveRecommender(r.id, { name: r.name, status: e.target.value as never }))} aria-label={r.name} className={`${inputCls} min-h-11 w-auto text-sm`}>{ST.map((st) => <option key={st} value={st}>{t(`statuses.${st}`)}</option>)}</select></div>
            {r.ask && <p className="text-sm text-ink-2">{r.ask}</p>}
            {r.replyNote && <p className="rounded-xl bg-paper-2 p-2 text-sm">{t("reply", { note: r.replyNote })}</p>}
            {r.link && <div className="flex flex-wrap items-center gap-2"><input readOnly value={r.link} onFocus={(e) => e.currentTarget.select()} aria-label={t("link")} className={`${inputCls} min-h-11 flex-1 font-mono text-xs`} />
              <a href={`https://wa.me/?text=${encodeURIComponent(`${r.ask ?? ""} ${r.link}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-medium">{t("whatsapp")}</a></div>}
          </Card></li>
        ))}
      </ul>
      {canEdit && <Card className="grid gap-2 p-4">
        <h2 className="text-xl">{t("add")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("name")} aria-label={t("name")} className={inputCls} />
          <input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder={t("role")} aria-label={t("role")} className={inputCls} />
          <textarea value={f.ask} onChange={(e) => setF({ ...f, ask: e.target.value })} placeholder={t("ask")} aria-label={t("ask")} rows={2} className={`${inputCls} py-2 sm:col-span-2`} />
          <label className="flex items-center gap-2 text-sm text-ink-2">{t("due")}<input type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} className={`${inputCls} w-auto`} /></label>
        </div>
        <Button className="justify-self-start" onClick={() => { if (!f.name.trim()) return; start(() => saveRecommender(null, { name: f.name, role: f.role || null, ask: f.ask || null, dueOn: f.dueOn || null, status: "to_ask" })); setF({ name: "", role: "", ask: "", dueOn: "" }); }}>{t("add")}</Button>
      </Card>}
    </div>
  );
}
