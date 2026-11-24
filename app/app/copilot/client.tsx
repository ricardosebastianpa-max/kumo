"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { askCopilot, saveAiKey } from "@/app/actions/plan";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/client/toast";
import { Kumo } from "@/components/kumo";
import { Button, Card, inputCls } from "@/components/ui";

type Status = { on: boolean; source: "app" | "env" | null; provider: "anthropic" | "openrouter" | null; model: string | null; last4: string | null };
export function CopilotClient({ status, owner }: { status: Status; owner: boolean }) {
  const aiOn = status.on;
  const t = useTranslations("ai");
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [pending, start] = useTransition();
  const ask = (question: string) => start(async () => { const r = await askCopilot(question); setLog((l) => [{ q: question, a: r.ok ? r.text! : r.off ? t("off") : t("error") }, ...l]); });
  return (
    <div className="grid max-w-2xl gap-6 pt-2">
      <div className="flex items-center gap-4"><Kumo state={pending ? "focused" : "awake"} size={80} className="text-ink" /><div className="grid gap-1"><h1 className="text-4xl">{t("title")}</h1><p className="text-ink-2">{t("lead")}</p></div></div>
      {owner && <KeyCard status={status} />}
      {!aiOn && <p className="rounded-2xl bg-paper-2 p-4 text-sm text-ink-2">{t("off")}</p>}
      <Button size="lg" disabled={!aiOn || pending} onClick={() => ask(t("what"))} className="justify-self-start">{t("what")}</Button>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { ask(q.trim()); setQ(""); } }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} aria-label={t("ask")} disabled={!aiOn} className={inputCls} /><Button type="submit" disabled={!aiOn || pending}>{t("ask")}</Button>
      </form>
      {pending && <p className="text-mute" role="status">{t("thinking")}</p>}
      {log.map((x, i) => <Card key={i} className="grid gap-2 p-5"><p className="text-sm font-bold text-mute">{x.q}</p><p className="whitespace-pre-wrap leading-relaxed">{x.a}</p></Card>)}
    </div>
  );
}

function KeyCard({ status }: { status: Status }) {
  const t = useTranslations("ai");
  const router = useRouter();
  const toast = useToast();
  const [provider, setProvider] = useState<"anthropic" | "openrouter">(status.provider ?? "openrouter");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(status.model ?? "");
  const [pending, start] = useTransition();
  return (
    <Card className="grid gap-3 p-5">
      <div className="grid gap-1"><h2 className="text-xl">{t("keyTitle")}</h2><p className="text-sm text-ink-2">{t("keyLead")}</p></div>
      {status.source === "app" && <p className="flex flex-wrap items-center gap-3 font-bold text-[var(--conf-confirmed)]">{t("connected", { provider: status.provider === "openrouter" ? "OpenRouter" : "Anthropic", last4: status.last4 ? ` ··${status.last4}` : "" })}
        <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-bold text-[var(--lacquer)] hover:bg-lacquer-soft" onClick={() => start(async () => { await saveAiKey(null); router.refresh(); })}>{t("remove")}</button></p>}
      {status.source === "env" && <p className="text-sm text-mute">{t("envOn")}</p>}
      <div role="radiogroup" aria-label={t("provider")} className="flex w-fit rounded-xl border border-line bg-card p-1">
        {(["openrouter", "anthropic"] as const).map((p) => <button key={p} type="button" role="radio" aria-checked={provider === p} onClick={() => setProvider(p)} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${provider === p ? "bg-brand text-brand-ink" : "text-ink-2"}`}>{p === "openrouter" ? "OpenRouter" : "Anthropic"}</button>)}
      </div>
      <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (key.trim().length < 20) return; start(async () => { await saveAiKey({ provider, key: key.trim(), model: model.trim() || undefined }); setKey(""); toast({ text: t("savedKey") }); router.refresh(); }); }}>
        <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={provider === "openrouter" ? "sk-or-v1-…" : "sk-ant-…"} aria-label={t("key")} className={inputCls} />
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("model")} aria-label={t("model")} aria-describedby="model-hint" className={inputCls} />
        <p id="model-hint" className="text-xs text-mute">{t("modelHint")}</p>
        <Button type="submit" disabled={pending || key.trim().length < 20} className="justify-self-start">{t("connect")}</Button>
      </form>
    </Card>
  );
}
