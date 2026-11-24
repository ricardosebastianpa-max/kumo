"use client";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { completeOnboarding } from "@/app/actions";
import { Kumo, type KumoState } from "@/components/kumo";
import { Button, Field, inputCls } from "@/components/ui";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [tz, setTz] = useState("UTC");
  const [err, setErr] = useState<string | null>(null);
  const [state, action, pending] = useActionState(completeOnboarding, {});
  useEffect(() => { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); }, []);
  const kumo: KumoState[] = ["awake", "cheering", "celebrating"];
  const total = 3;
  const next = () => {
    if (step === 0 && !name.trim()) { setErr(t("nameRequired")); return; }
    setErr(null); setStep((s) => Math.min(s + 1, total - 1));
  };
  return (
    <form action={action} className="grid gap-6" onSubmit={(e) => { if (step < total - 1) { e.preventDefault(); next(); } }}>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Kumo state={kumo[step]} size={72} className="text-ink transition-transform" />
          <p className="text-sm font-semibold text-mute" aria-live="polite">{t("step", { n: step + 1, total })}</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
          <div className="h-full rounded-full bg-[var(--lacquer)] transition-[width] duration-300 ease-out" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="timezone" value={tz} />
      {step === 0 && (
        <div className="grid gap-4 enter" key="s0">
          <div className="grid gap-2"><h1 className="text-4xl">{t("nameTitle")}</h1><p className="text-ink-2 text-lg">{t("nameLead")}</p></div>
          <Field id="name" label={t("nameTitle")} error={err}>
            <input id="name" autoFocus autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className={inputCls} aria-invalid={!!err} aria-describedby={err ? "name-err" : undefined} />
          </Field>
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-4 enter" key="s1">
          <div className="grid gap-2"><h1 className="text-4xl">{t("tzTitle")}</h1><p className="text-ink-2 text-lg">{t("tzLead")}</p></div>
          <Field id="tz" label={t("tzTitle")} hint={t("tzDetected", { tz })}>
            <select id="tz" value={tz} onChange={(e) => setTz(e.target.value)} className={inputCls}>
              {Array.from(new Set([tz, ...(Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone")])).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
        </div>
      )}
      {step === 2 && (
        <div className="grid gap-4 enter" key="s2">
          <div className="grid gap-2"><h1 className="text-4xl">{t("spaceTitle")}</h1><p className="text-ink-2 text-lg">{t("spaceLead")}</p></div>
          <Field id="space" label={t("spaceTitle")} error={state?.error}>
            <input id="space" name="space" autoFocus placeholder={t("spacePlaceholder")} className={inputCls} />
          </Field>
        </div>
      )}
      <div className="flex gap-3">
        {step > 0 && <Button type="button" variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>{tc("back")}</Button>}
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>{step < total - 1 ? tc("continue") : pending ? t("creating") : t("create")}</Button>
      </div>
    </form>
  );
}
