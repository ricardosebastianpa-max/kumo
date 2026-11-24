"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { askCopilot } from "@/app/actions/plan";
import { Kumo } from "@/components/kumo";
import { Button, Card, inputCls } from "@/components/ui";

export function CopilotClient({ aiOn }: { aiOn: boolean }) {
  const t = useTranslations("ai");
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [pending, start] = useTransition();
  const ask = (question: string) => start(async () => { const r = await askCopilot(question); setLog((l) => [{ q: question, a: r.ok ? r.text! : r.off ? t("off") : t("error") }, ...l]); });
  return (
    <div className="grid max-w-2xl gap-6 pt-2">
      <div className="flex items-center gap-4"><Kumo state={pending ? "focused" : "awake"} size={80} className="text-ink" /><div className="grid gap-1"><h1 className="text-4xl">{t("title")}</h1><p className="text-ink-2">{t("lead")}</p></div></div>
      {!aiOn && <p className="rounded-2xl bg-paper-2 p-4 text-sm text-ink-2">{t("off")}</p>}
      <Button size="lg" disabled={!aiOn || pending} onClick={() => ask(t("what"))} className="justify-self-start">{t("what")}</Button>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { ask(q.trim()); setQ(""); } }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} aria-label={t("ask")} disabled={!aiOn} className={inputCls} /><Button type="submit" disabled={!aiOn || pending}>{t("ask")}</Button>
      </form>
      {pending && <p className="text-mute" role="status">{t("thinking")}</p>}
      {log.map((x, i) => <Card key={i} className="grid gap-2 p-5"><p className="text-sm font-semibold text-mute">{x.q}</p><p className="whitespace-pre-wrap leading-relaxed">{x.a}</p></Card>)}
    </div>
  );
}
