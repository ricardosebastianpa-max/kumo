import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const btn = (v: Variant, size: "md" | "lg" = "md") => clsx(
  "inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold tracking-[.01em] disabled:opacity-50 disabled:pointer-events-none select-none",
  size === "lg" ? "min-h-14 px-7 text-[1.0625rem]" : "min-h-11 px-5 text-[0.9375rem]",
  v === "primary" && "btn3d bg-brand text-brand-ink [--edge:var(--brand-deep)] hover:brightness-105",
  v === "secondary" && "btn3d bg-card text-ink border-2 border-line hover:bg-paper-2",
  v === "ghost" && "text-ink hover:bg-paper-2",
  v === "danger" && "text-[var(--lacquer)] hover:bg-lacquer-soft",
);

export function Button({ variant = "primary", size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: "md" | "lg" }) {
  return <button {...p} className={clsx(btn(variant, size), className)} />;
}
export function ButtonLink({ variant = "primary", size, className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: "md" | "lg" }) {
  return <Link {...p} className={clsx(btn(variant, size), className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={clsx("rounded-[var(--radius-card)] bg-card border-2 border-line shadow-[var(--shadow-1)]", className)} />;
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string | null; children: ReactNode; id: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink-2">{label}</label>
      {children}
      {error ? <p id={`${id}-err`} role="alert" className="text-sm text-[var(--lacquer)]">{error}</p> : hint ? <p className="text-sm text-mute">{hint}</p> : null}
    </div>
  );
}
export const inputCls = "min-h-12 w-full rounded-2xl border-2 border-line font-semibold bg-card px-4 text-base text-ink placeholder:text-mute focus:outline-none focus:border-[var(--sky)] aria-[invalid=true]:border-[var(--lacquer)]";

const CONF_COLOR = { confirmed: "var(--conf-confirmed)", estimated: "var(--conf-estimated)", unverified: "var(--conf-unverified)" } as const;
/** Confidence is never color-only: icon shape + label. */
export function ConfidenceBadge({ level, label }: { level: keyof typeof CONF_COLOR; label: string }) {
  const c = CONF_COLOR[level];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        {level === "confirmed" ? <circle cx="5" cy="5" r="4" fill={c} /> : level === "estimated" ? <circle cx="5" cy="5" r="3.4" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="2 1.6" /> : <path d="M5 1 L9 9 H1 Z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />}
      </svg>
      {label}
    </span>
  );
}

const CAT_COLOR: Record<string, string> = { dream: "var(--cat-dream)", reach: "var(--cat-reach)", target: "var(--cat-target)", safety: "var(--cat-safety)" };
export function CategoryChip({ category, label }: { category: string; label: string }) {
  const c = CAT_COLOR[category] ?? "var(--mute)";
  return <span className="inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold" style={{ color: c, borderColor: `color-mix(in srgb, ${c} 35%, transparent)` }}><span className="size-1.5 rounded-full" style={{ background: c }} />{label}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-bold tracking-wide text-[var(--lacquer)]">{children}</p>;
}
