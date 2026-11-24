"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Field, inputCls } from "@/components/ui";

export function LoginForm({ next, showOutbox }: { next: string; showOutbox: boolean }) {
  const t = useTranslations("login");
  const tc = useTranslations("common");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t("invalidEmail")); return; }
    setError(null); setState("sending");
    const { error } = await authClient.signIn.magicLink({ email: email.trim().toLowerCase(), callbackURL: next, newUserCallbackURL: next.startsWith("/invite") ? next : "/onboarding" });
    if (error) { setError(error.status === 429 ? tc("errorGeneric") : tc("errorGeneric")); setState("idle"); return; }
    setState("sent");
  }

  if (state === "sent") return (
    <div className="grid gap-3 enter" role="status">
      <h1 className="text-4xl">{t("sentTitle")}</h1>
      <p className="text-ink-2 text-lg">{t("sentBody", { email })}</p>
      {showOutbox ? <a className="font-semibold underline underline-offset-4" href="/dev/outbox">{t("devOutbox")}</a> : null}
      <button type="button" className="justify-self-start min-h-11 font-semibold text-ink-2 underline underline-offset-4" onClick={() => setState("idle")}>{t("useOther")}</button>
    </div>
  );
  return (
    <form onSubmit={submit} className="grid gap-5 enter" noValidate>
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-ink-2 text-lg">{t("lead")}</p></div>
      <Field id="email" label={t("email")} error={error}>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")} className={inputCls} aria-invalid={!!error} aria-describedby={error ? "email-err" : undefined} />
      </Field>
      <Button type="submit" size="lg" disabled={state === "sending"}>{state === "sending" ? t("sending") : t("submit")}</Button>
    </form>
  );
}
