"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { logTest, planMyWeek, saveCheckin } from "@/app/actions/plan";
import { Button, Card, inputCls } from "@/components/ui";
import { useToast } from "@/components/client/toast";

type Test = { id: string; exam: string; section: string; score: number; maxScore: number; takenOn: string };
const label = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Least-squares slope of score % per attempt. */
function slope(ys: number[]) { const n = ys.length; if (n < 2) return 0; const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; ys.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; }); return den ? num / den : 0; }

export function ProgressClient({ goals, done, tests, owner, overload, today, canEdit, checkin }: { goals: Record<string, number>; done: Record<string, number>; tests: Test[]; owner: boolean; overload: boolean; today: string; canEdit: boolean; checkin: { energy: number | null; mood: number | null; sleep: number | null; stress: number | null } | null }) {
  const t = useTranslations("progress");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ exam: "CSCA", section: "Matemáticas", score: "", maxScore: "100", takenOn: today });
  const [ci, setCi] = useState({ energy: checkin?.energy ?? 0, mood: checkin?.mood ?? 0, sleep: checkin?.sleep ?? 0, stress: checkin?.stress ?? 0 });
  const subjects = [...new Set([...Object.keys(goals), ...Object.keys(done)])];
  const groups = [...new Set(tests.map((x) => `${x.exam} · ${x.section}`))];
  return (
    <div className="grid max-w-3xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      {owner && overload && <p className="rounded-2xl border border-line bg-lacquer-soft p-4 text-ink-2" role="status">{t("overload")}</p>}

      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{t("week")}</h2>
          {canEdit && <Button disabled={pending} onClick={() => start(async () => { const n = await planMyWeek(); toast({ text: t("planned", { n }) }); })}>{t("planWeek")}</Button>}</div>
        <p className="text-sm text-mute">{t("planHint")}</p>
        <ul className="grid gap-3">{subjects.map((k) => { const g = goals[k] ?? 0, d = Math.round((done[k] ?? 0) * 10) / 10; return (
          <li key={k} className="grid gap-1"><div className="flex justify-between text-sm"><span className="font-bold">{label(k)}</span><span className="tabular-nums text-ink-2">{d} / {g} h</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${g ? Math.min(100, (d / g) * 100) : d ? 100 : 0}%` }} /></div></li>); })}</ul>
      </Card>

      <Card className="grid gap-4 p-5">
        <h2 className="text-2xl">{t("tests")}</h2>
        {groups.length === 0 ? <p className="text-ink-2">{t("noTests")}</p> : groups.map((g) => {
          const xs = tests.filter((x) => `${x.exam} · ${x.section}` === g), pct = xs.map((x) => (x.score / x.maxScore) * 100), sl = Math.round(slope(pct) * 10) / 10;
          const W = 220, H = 48, pts = pct.map((p, i) => `${(i / Math.max(1, pct.length - 1)) * W},${H - (p / 100) * H}`).join(" ");
          return (
            <div key={g} className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><p className="font-bold">{g}</p><p className="text-sm text-mute">{xs.map((x) => `${x.score}/${x.maxScore}`).join(" → ")} · {t("trend", { d: sl })}</p></div>
              <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} width={W} height={H} aria-hidden><polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{pct.map((p, i) => <circle key={i} cx={(i / Math.max(1, pct.length - 1)) * W} cy={H - (p / 100) * H} r="3.5" fill="var(--lacquer)" />)}</svg>
            </div>);
        })}
        {canEdit && <form className="grid gap-2 border-t border-line pt-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); const sc = Number(f.score), mx = Number(f.maxScore); if (!(sc >= 0) || !(mx > 0)) return; start(async () => { await logTest({ exam: f.exam, section: f.section, score: sc, maxScore: mx, takenOn: f.takenOn }); setF({ ...f, score: "" }); }); }}>
          <input value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })} aria-label={t("exam")} placeholder={t("exam")} className={`${inputCls} min-h-11`} />
          <input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} aria-label={t("section")} placeholder={t("section")} className={`${inputCls} min-h-11`} />
          <input value={f.score} inputMode="decimal" onChange={(e) => setF({ ...f, score: e.target.value })} aria-label={t("score")} placeholder={t("score")} className={`${inputCls} min-h-11`} />
          <input type="date" value={f.takenOn} onChange={(e) => setF({ ...f, takenOn: e.target.value })} aria-label={t("date")} className={`${inputCls} min-h-11`} />
          <Button type="submit" disabled={pending}>{t("addTest")}</Button>
        </form>}
      </Card>

      {owner && <Card className="grid gap-3 p-5">
        <div><h2 className="text-2xl">{t("checkin")}</h2><p className="text-sm text-mute">{t("private")}</p></div>
        {(["energy", "mood", "sleep", "stress"] as const).map((k) => (
          <div key={k} className="flex flex-wrap items-center gap-2"><span className="w-20 text-sm font-bold">{t(k)}</span>
            <div role="radiogroup" aria-label={t(k)} className="flex gap-1">{[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" role="radio" aria-checked={ci[k] === v} onClick={() => setCi({ ...ci, [k]: v })} className={`size-11 rounded-xl border font-bold ${ci[k] === v ? "border-[var(--ink)] bg-brand text-brand-ink" : "border-line"}`}>{v}</button>)}</div></div>
        ))}
        <Button className="justify-self-start" disabled={pending} onClick={() => start(async () => { await saveCheckin(Object.fromEntries(Object.entries(ci).filter(([, v]) => v > 0))); toast({ text: t("saved") }); })}>OK</Button>
      </Card>}
    </div>
  );
}
