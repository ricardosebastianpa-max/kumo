"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { rotateIcsToken } from "@/app/actions/events";
import { Button, inputCls } from "@/components/ui";
import { useToast } from "@/components/client/toast";

export function SubscribeClient({ url }: { url: string }) {
  const t = useTranslations("ics");
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const webcal = url.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const a = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-[0.9375rem] font-medium";
  return (
    <>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="ICS" className={`${inputCls} font-mono text-sm`} data-testid="ics-url" />
      <div className="flex flex-wrap gap-2">
        <a href={google} target="_blank" rel="noopener noreferrer" className={`${a} bg-brand text-brand-ink`}>{t("google")}</a>
        <a href={webcal} className={`${a} border border-line bg-card`}>{t("apple")}</a>
        <Button type="button" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}>{copied ? t("copied") : t("copy")}</Button>
      </div>
      <p className="text-sm text-mute">{t("googleSteps")}</p>
      <p className="rounded-xl bg-paper-2 p-3 text-sm text-ink-2">{t("warning")}</p>
      <Button type="button" variant="danger" disabled={pending} className="justify-self-start" onClick={() => start(async () => { await rotateIcsToken(); toast({ text: t("regenerated") }); })}>{t("regenerate")}</Button>
    </>
  );
}
