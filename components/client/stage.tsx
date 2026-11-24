"use client";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { Cloud } from "lucide-react";
import { setStage, type Stage } from "@/app/actions/list";
import { useToast } from "./toast";

/** One-tap "Me interesa" cloud: exploring ↔ shortlist. Optimistic. */
export function ShortlistToggle({ kind, refId, stage, compact = false }: { kind: "institution" | "scholarship"; refId: string; stage: Stage; compact?: boolean }) {
  const t = useTranslations("list");
  const toast = useToast();
  const [opt, setOpt] = useOptimistic(stage);
  const [, start] = useTransition();
  const on = opt === "shortlist" || opt === "pursuing";
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const next: Stage = on ? "exploring" : "shortlist";
    start(async () => { setOpt(next); try { navigator.vibrate?.(8); } catch {} await setStage(kind, refId, next); if (next === "shortlist") toast({ text: t("added") }); });
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? t("remove") : t("add")} title={on ? t("added") : t("add")}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full font-semibold transition-all active:scale-95 ${compact ? "size-11 justify-center bg-card/90 shadow-[var(--shadow-1)] backdrop-blur" : "border px-4 " + (on ? "border-[var(--lacquer)] bg-lacquer-soft text-[var(--lacquer)]" : "border-line bg-card")}`}>
      <Cloud size={compact ? 22 : 18} aria-hidden className={on ? "fill-[var(--lacquer)] text-[var(--lacquer)]" : "text-ink-2"} />
      {compact ? null : on ? t("added") : t("add")}
    </button>
  );
}

/** Segmented stage control for detail pages. */
export function StagePicker({ kind, refId, stage }: { kind: "institution" | "scholarship"; refId: string; stage: Stage }) {
  const t = useTranslations("list");
  const [opt, setOpt] = useOptimistic(stage);
  const [, start] = useTransition();
  const stages: Stage[] = ["exploring", "shortlist", "pursuing", "discarded"];
  return (
    <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-1 sm:grid-cols-4">
      {stages.map((st) => (
        <button key={st} type="button" role="radio" aria-checked={opt === st} onClick={() => start(async () => { setOpt(st); await setStage(kind, refId, st); })}
          className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors ${opt === st ? (st === "pursuing" ? "bg-[var(--lacquer)] text-white" : "bg-brand text-brand-ink") : "text-ink-2 hover:bg-paper-2"}`}>
          {t(`stages.${st}`)}
        </button>
      ))}
    </div>
  );
}
