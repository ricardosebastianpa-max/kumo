"use client";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Cloud } from "lucide-react";
import { Button } from "@/components/ui";

/** "Me siento abrumado": one-minute breathing with the cloud and only the main thing. */
export function CalmButton({ main }: { main: string | null }) {
  const t = useTranslations("calm");
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink-2 hover:bg-paper-2"><Cloud size={16} aria-hidden />{t("button")}</button>
      <dialog ref={ref} aria-labelledby="calm-t" className="m-auto w-[min(440px,calc(100%-32px))] rounded-[28px] border border-line bg-card p-8 text-center text-ink shadow-[var(--shadow-2)] backdrop:bg-[rgba(14,20,34,.45)]">
        <h2 id="calm-t" className="text-3xl">{t("title")}</h2>
        <p className="mt-2 text-ink-2">{t("lead")}</p>
        <div className="my-8 grid place-items-center"><Cloud size={96} aria-hidden className="calm-breathe fill-[var(--paper-2)] text-ink-2" /></div>
        <p className="text-sm font-semibold text-mute">{t("only")}</p>
        <p className="mt-1 font-display text-xl">{main ?? t("none")}</p>
        <Button size="lg" className="mt-6" onClick={() => ref.current?.close()}>{t("done")}</Button>
      </dialog>
    </>
  );
}
