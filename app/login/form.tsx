"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Field, inputCls } from "@/components/ui";

export function LoginForm({ next, initialMode = "signin" }: { next: string; initialMode?: "signin" | "signup" }) {
  const t = useTranslations("login");
  const tc = useTranslations("common");
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: "email" | "password" | "form"; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setError({ field: "email", msg: t("invalidEmail") });
    if (password.length < 8) return setError({ field: "password", msg: t("shortPassword") });
    setError(null); setBusy(true);
    const res = mode === "signup"
      ? await authClient.signUp.email({ email: em, password, name: em.split("@")[0] })
      : await authClient.signIn.email({ email: em, password });
    setBusy(false);
    if (res.error) {
      const code = res.error.code ?? "";
      if (/USER_ALREADY_EXISTS/.test(code)) return setError({ field: "email", msg: t("exists") });
      if (/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|USER_NOT_FOUND/.test(code) || res.error.status === 401) return setError({ field: "form", msg: t("badCredentials") });
      return setError({ field: "form", msg: tc("errorGeneric") });
    }
    // New accounts go to onboarding unless they came from an invitation.
    window.location.href = mode === "signup" && !next.startsWith("/invite") ? "/onboarding" : next;
  }

  return (
    <form onSubmit={submit} className="grid gap-5 enter" noValidate>
      <div className="grid gap-2"><h1 className="text-4xl">{mode === "signup" ? t("signUpTitle") : t("title")}</h1><p className="text-ink-2 text-lg">{t("lead")}</p></div>
      <Field id="email" label={t("email")} error={error?.field === "email" ? error.msg : null}>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")} className={inputCls} aria-invalid={error?.field === "email"} aria-describedby={error?.field === "email" ? "email-err" : undefined} />
      </Field>
      <Field id="password" label={t("password")} hint={mode === "signup" ? t("passwordHint") : undefined} error={error?.field === "password" ? error.msg : null}>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-24`} aria-invalid={error?.field === "password"} aria-describedby={error?.field === "password" ? "password-err" : undefined} />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1 top-1/2 min-h-11 -translate-y-1/2 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-paper-2">{show ? t("hidePassword") : t("showPassword")}</button>
        </div>
      </Field>
      {error?.field === "form" ? <p role="alert" className="text-[var(--lacquer)]">{error.msg}</p> : null}
      <Button type="submit" size="lg" disabled={busy}>{busy ? tc("loading") : mode === "signup" ? t("signUp") : t("signIn")}</Button>
      <button type="button" className="min-h-11 justify-self-center font-medium text-ink-2 underline underline-offset-4" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}>
        {mode === "signup" ? t("toSignIn") : t("toSignUp")}
      </button>
    </form>
  );
}
