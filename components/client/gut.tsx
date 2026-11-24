"use client";
import { useTranslations } from "next-intl";
import { Cloud } from "lucide-react";

/** Gut feeling as 1–5 little clouds (Kumo = cloud). Read-only when no onChange. */
export function Gut({ value, onChange, size = 18 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  const t = useTranslations("list");
  const label = value ? t(`gutLabels.${value}` as "gutLabels.1") : t("gut");
  if (!onChange) return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${t("gut")}: ${label}`}>
      {[1, 2, 3, 4, 5].map((i) => <Cloud key={i} size={size} aria-hidden className={i <= (value ?? 0) ? "fill-[var(--lacquer)] text-[var(--lacquer)]" : "text-line"} />)}
    </span>
  );
  return (
    <div className="grid gap-1">
      <div role="radiogroup" aria-label={t("gut")} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={t(`gutLabels.${i}` as "gutLabels.1")} onClick={() => onChange(value === i ? null : i)}
            className="grid size-11 place-items-center rounded-xl transition-transform hover:scale-110 active:scale-95">
            <Cloud size={26} aria-hidden className={`transition-colors ${i <= (value ?? 0) ? "fill-[var(--lacquer)] text-[var(--lacquer)]" : "text-mute"}`} />
          </button>
        ))}
      </div>
      <p className="text-sm font-bold text-ink-2" aria-live="polite">{label}</p>
    </div>
  );
}
