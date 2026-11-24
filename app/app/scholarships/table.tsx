"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ConfidenceBadge, inputCls } from "@/components/ui";

export interface SchRow { slug: string; name: string; country: string | null; scope: string | null; confidence: "confirmed" | "estimated" | "unverified"; deadline: string | null; coverage: string | null }
const SCOPES = ["institutional", "government", "local_government", "private"] as const;

export function SchTable({ rows }: { rows: SchRow[] }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("");
  const [upcoming, setUpcoming] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const shown = useMemo(() => {
    const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const nq = norm(q.trim());
    return rows.filter((r) => (!scope || r.scope === scope) && (!upcoming || !r.deadline || r.deadline >= today) && (!nq || norm(`${r.name} ${r.country ?? ""} ${r.coverage ?? ""}`).includes(nq)));
  }, [rows, q, scope, upcoming, today]);
  const fmt = (d: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <div className="grid gap-4">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={inputCls} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setScope("")} aria-pressed={!scope} className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${!scope ? "border-[var(--ink)] bg-paper-2" : "border-line"}`}>{t("allCategories")}</button>
        {SCOPES.map((sc) => <button key={sc} type="button" onClick={() => setScope(scope === sc ? "" : sc)} aria-pressed={scope === sc} className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${scope === sc ? "border-[var(--ink)] bg-paper-2" : "border-line"}`}>{t(`scopes.${sc}`)}</button>)}
        <label className="ml-auto inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-2"><input type="checkbox" checked={upcoming} onChange={(e) => setUpcoming(e.target.checked)} className="size-5 accent-[var(--ink)]" />{t("upcomingOnly")}</label>
      </div>
      <p className="text-sm text-mute" aria-live="polite">{t("count", { n: shown.length, total: rows.length })}</p>
      {shown.length === 0 ? <p className="rounded-2xl border border-line bg-card p-6">{t("noMatch")}</p> : (
        <ul className="grid gap-2">
          {shown.map((r) => (
            <li key={r.slug}>
              <Link href={`/app/scholarships/${r.slug}`} className="grid gap-1 rounded-2xl border border-line bg-card p-4 hover:bg-paper-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
                <span className="grid min-w-0 gap-1"><span className="font-semibold leading-snug">{r.name}</span>{r.coverage ? <span className="line-clamp-1 text-sm text-ink-2">{r.coverage}</span> : null}<span className="text-xs text-mute">{[r.country, r.scope && t.has(`scopes.${r.scope}`) ? t(`scopes.${r.scope}` as "scopes.private") : r.scope].filter(Boolean).join(" · ")}</span></span>
                <span className="flex items-center gap-2 sm:justify-end"><span className="text-sm font-semibold tabular-nums">{r.deadline ? fmt(r.deadline) : <span className="font-normal text-mute">{t("noDeadline")}</span>}</span><ConfidenceBadge level={r.confidence} label={tc(`confidence.${r.confidence}`)} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
