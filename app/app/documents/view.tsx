"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteDocument, saveDocument, seedDocuments } from "@/app/actions/plan";
import { Button, Card, inputCls } from "@/components/ui";
import { daysBetween } from "@/lib/domain/time";

type Doc = { id: string; name: string; status: string; expiresOn: string | null; notes: string | null };
const ST = ["missing", "in_progress", "ready", "translated", "apostilled"] as const;
const COLOR: Record<string, string> = { missing: "var(--conf-unverified)", in_progress: "var(--conf-estimated)", ready: "var(--conf-confirmed)", translated: "var(--conf-confirmed)", apostilled: "var(--conf-confirmed)" };

export function DocsView({ docs, canEdit, today }: { docs: Doc[]; canEdit: boolean; today: string }) {
  const t = useTranslations("docs");
  const [, start] = useTransition();
  const [name, setName] = useState("");
  const save = (d: Doc, p: Partial<Doc>) => start(() => saveDocument(d.id, { name: d.name, status: d.status as never, expiresOn: d.expiresOn, notes: d.notes, ...p } as never));
  const ready = docs.filter((d) => d.status !== "missing" && d.status !== "in_progress").length;
  return (
    <div className="grid max-w-3xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p>{docs.length > 0 && <p className="font-semibold">{ready}/{docs.length}</p>}</div>
      {canEdit && docs.length === 0 && <Button onClick={() => start(() => seedDocuments())} className="justify-self-start">{t("seed")}</Button>}
      <ul className="grid gap-2">
        {docs.map((d) => {
          const left = d.expiresOn ? daysBetween(today, d.expiresOn) : null;
          return (
            <li key={d.id}><Card className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div className="grid gap-0.5"><span className="font-semibold">{d.name}</span>
                {left !== null && left < 0 ? <span className="text-sm font-semibold text-[var(--lacquer)]">{t("expired")}</span> : left !== null && left <= 183 ? <span className="text-sm text-[var(--conf-estimated)]">{t("expiring", { n: left })}</span> : null}
              </div>
              <select disabled={!canEdit} defaultValue={d.status} onChange={(e) => save(d, { status: e.target.value })} aria-label={`${t("status")}: ${d.name}`} className={`${inputCls} min-h-11 w-auto text-sm font-semibold`} style={{ color: COLOR[d.status] }}>
                {ST.map((st) => <option key={st} value={st}>{t(`statuses.${st}`)}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-mute">{t("expires")}<input type="date" disabled={!canEdit} defaultValue={d.expiresOn ?? ""} onChange={(e) => save(d, { expiresOn: e.target.value || null })} className={`${inputCls} min-h-11 w-auto text-sm`} /></label>
              {canEdit && <div className="flex gap-2 sm:col-span-3"><input defaultValue={d.notes ?? ""} onBlur={(e) => e.target.value !== (d.notes ?? "") && save(d, { notes: e.target.value || null })} placeholder={t("notes")} aria-label={t("notes")} className={`${inputCls} min-h-11 text-sm`} /><Button variant="danger" onClick={() => start(() => deleteDocument(d.id))}>{t("delete")}</Button></div>}
            </Card></li>
          );
        })}
      </ul>
      {canEdit && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { start(() => saveDocument(null, { name: name.trim() })); setName(""); } }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} aria-label={t("name")} className={inputCls} /><Button type="submit">{t("add")}</Button>
      </form>}
    </div>
  );
}
