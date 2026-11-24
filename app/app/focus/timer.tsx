"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { logSession } from "@/app/actions/plan";
import { Kumo } from "@/components/kumo";
import { Button, inputCls } from "@/components/ui";
import { useToast } from "@/components/client/toast";

/** Big, distraction-free timer. Elapsed time survives tab switches (wall-clock based). Saves the session on finish. */
export function FocusTimer({ subjects, initial }: { subjects: string[]; initial: string | null }) {
  const t = useTranslations("focus");
  const toast = useToast();
  const [subject, setSubject] = useState(initial ?? subjects[0]);
  const [goal, setGoal] = useState(50);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null), base = useRef(0);
  const [, start] = useTransition();
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(base.current + (Date.now() - startedAt.current!) / 1000), 500);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (running && elapsed >= goal * 60) { setRunning(false); base.current = elapsed; try { navigator.vibrate?.([30, 60, 30]); } catch {} } }, [elapsed, goal, running]);
  const left = Math.max(0, goal * 60 - elapsed), mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(Math.floor(left % 60)).padStart(2, "0");
  const toggle = () => { if (running) { base.current = elapsed; setRunning(false); } else { startedAt.current = Date.now(); setRunning(true); } };
  const finish = () => { const m = Math.max(1, Math.round(elapsed / 60)); setRunning(false); start(async () => { await logSession(subject, m); toast({ text: t("saved", { m, s: subject }) }); }); base.current = 0; setElapsed(0); };
  return (
    <div className="grid min-h-[70dvh] content-center justify-items-center gap-6 text-center">
      <Kumo state={running ? "focused" : elapsed ? "resting" : "awake"} size={120} className={`text-ink ${running ? "kumo-float" : ""}`} />
      {!running && !elapsed && (
        <div className="grid w-full max-w-sm gap-2">
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={t("subject")} className={inputCls}>{subjects.map((x) => <option key={x}>{x}</option>)}</select>
          <div role="radiogroup" aria-label="min" className="flex justify-center gap-2">{[25, 50, 90].map((m) => <button key={m} type="button" role="radio" aria-checked={goal === m} onClick={() => setGoal(m)} className={`min-h-11 rounded-xl border px-4 font-semibold ${goal === m ? "border-[var(--ink)] bg-brand text-brand-ink" : "border-line"}`}>{t("minutes", { m })}</button>)}</div>
        </div>
      )}
      <p className="font-display text-[clamp(4.5rem,18vw,9rem)] leading-none tabular-nums" aria-live="off" role="timer">{mm}:{ss}</p>
      <p className="text-ink-2">{running ? subject : t("breathe")}</p>
      <div className="flex gap-3">
        <Button size="lg" onClick={toggle}>{running ? t("pause") : elapsed ? t("resume") : t("start")}</Button>
        {elapsed > 30 && <Button size="lg" variant="secondary" onClick={finish}>{t("finish")}</Button>}
      </div>
    </div>
  );
}
