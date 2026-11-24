"use client";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { setEventDone } from "@/app/actions/events";
import { useToast } from "./toast";

/** Optimistic completion with undo; vibrates softly on phones that support it. */
export function DoneButton({ id, done = false, label }: { id: string; done?: boolean; label?: string }) {
  const t = useTranslations("today");
  const toast = useToast();
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  const toggle = () => start(async () => {
    const next = !optimistic;
    setOptimistic(next);
    if (next) { try { navigator.vibrate?.(12); } catch {} }
    await setEventDone(id, next);
    if (next) toast({ text: t("doneToast"), action: { label: t("undo"), run: () => start(() => setEventDone(id, false)) } });
  });
  return (
    <button type="button" onClick={toggle} aria-pressed={optimistic} aria-label={label ?? t("markDone")}
      className={`grid size-11 shrink-0 place-items-center rounded-full border-2 transition-colors ${optimistic ? "border-[var(--conf-confirmed)] bg-[var(--conf-confirmed)] text-white" : "border-line text-transparent hover:border-[var(--conf-confirmed)] hover:text-[var(--conf-confirmed)]"}`}>
      <Check size={20} strokeWidth={3} aria-hidden />
    </button>
  );
}
