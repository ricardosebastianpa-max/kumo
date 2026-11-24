"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { recommenderReply } from "@/app/actions/plan";
import { Button, inputCls } from "@/components/ui";
export function Reply({ token, student }: { token: string; student: string }) {
  const t = useTranslations("recs");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p role="status" className="text-lg font-bold">{t("publicThanks", { student })}</p>;
  const send = (st: "in_progress" | "sent") => start(async () => { await recommenderReply(token, st, note); setDone(true); });
  return (
    <div className="grid gap-3">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("publicNote")} aria-label={t("publicNote")} rows={3} className={`${inputCls} py-3`} />
      <div className="flex flex-wrap gap-2"><Button size="lg" disabled={pending} onClick={() => send("sent")}>{t("publicSent")}</Button><Button size="lg" variant="secondary" disabled={pending} onClick={() => send("in_progress")}>{t("publicWriting")}</Button></div>
    </div>
  );
}
