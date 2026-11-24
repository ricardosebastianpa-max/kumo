"use client";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { decideExpense, requestExpense, sendMessage } from "@/app/actions/plan";
import { Button, Card, inputCls } from "@/components/ui";

type Exp = { id: string; label: string; amount: number; currency: string; status: string };
type Msg = { id: string; body: string; mine: boolean; who: string; at: string };
export function FamilyClient({ expenses, messages, canApprove, canRequest }: { expenses: Exp[]; messages: Msg[]; canApprove: boolean; canRequest: boolean; me: string }) {
  const t = useTranslations("family");
  const locale = useLocale();
  const [, start] = useTransition();
  const [exps, setExps] = useState(expenses);
  const [body, setBody] = useState("");
  const [f, setF] = useState({ label: "", amount: "", currency: "USD" });
  const money = (n: number, c: string) => new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  const decide = (e: Exp, ok: boolean) => { setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, status: ok ? "approved" : "rejected" } : x))); start(() => decideExpense(e.id, ok)); };
  return (
    <>
      <Card className="grid gap-3 p-5"><h2 className="text-xl">{t("expenses")}</h2>
        {exps.length === 0 ? <p className="text-sm text-mute">{t("noExpenses")}</p> : (
          <ul className="grid gap-2">{exps.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2" data-testid="expense">
              <span><span className="font-medium">{e.label}</span> · {money(e.amount, e.currency)}</span>
              {e.status === "pending" && canApprove ? <span className="flex gap-2"><Button onClick={() => decide(e, true)}>{t("approve")}</Button><Button variant="secondary" onClick={() => decide(e, false)}>{t("reject")}</Button></span>
                : <span className="text-sm font-medium text-ink-2">{t(`statuses.${e.status}` as "statuses.pending")}</span>}
            </li>))}</ul>)}
        {canRequest && <form className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_120px_90px_auto]" onSubmit={(e) => { e.preventDefault(); const n = Number(f.amount); if (!f.label.trim() || !(n > 0)) return; start(() => requestExpense(f.label.trim(), n, f.currency)); setExps((xs) => [{ id: String(Date.now()), label: f.label, amount: n, currency: f.currency, status: "pending" }, ...xs]); setF({ ...f, label: "", amount: "" }); }}>
          <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={t("label")} aria-label={t("label")} className={`${inputCls} min-h-11`} />
          <input value={f.amount} inputMode="decimal" onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder={t("amount")} aria-label={t("amount")} className={`${inputCls} min-h-11`} />
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} aria-label="Moneda" className={`${inputCls} min-h-11 px-2`}>{["USD", "NIO", "CNY", "EUR"].map((c) => <option key={c}>{c}</option>)}</select>
          <Button type="submit">{t("request")}</Button>
        </form>}
      </Card>
      <Card className="grid gap-3 p-5"><h2 className="text-xl">{t("messages")}</h2>
        <ul className="grid max-h-80 gap-2 overflow-y-auto">{messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "justify-self-end bg-brand text-brand-ink" : "bg-paper-2"}`}><span className="block text-xs opacity-70">{m.who}</span>{m.body}</li>))}</ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) { start(() => sendMessage(body)); setBody(""); } }}>
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("write")} aria-label={t("write")} className={`${inputCls} min-h-11`} /><Button type="submit">{t("send")}</Button>
        </form>
      </Card>
    </>
  );
}
