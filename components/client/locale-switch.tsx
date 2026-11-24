"use client";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions";

export function LocaleSwitch() {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, start] = useTransition();
  const next = locale === "es" ? "en" : "es";
  return (
    <button type="button" onClick={() => start(() => setLocale(next))} disabled={pending} aria-label={`${t("language")}: ${next === "en" ? "English" : "Español"}`}
      className="min-h-11 min-w-11 rounded-xl px-3 text-sm font-medium text-ink-2 hover:bg-paper-2">
      {next.toUpperCase()}
    </button>
  );
}
