"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CategoryChip, ConfidenceBadge, inputCls } from "@/components/ui";
import { Cover, ScoreRing } from "@/components/cover";
import { ShortlistToggle } from "@/components/client/stage";
import type { Stage } from "@/app/actions/list";

export interface UniRow { id: string; cover: string | null; stage: Stage; slug: string; name: string; alt: string | null; city: string | null; tiers: string[]; score: number | null; rank: number; category: string | null; tuition: number | null; currency: string; tuitionEstimated: boolean; confidence: "confirmed" | "estimated" | "unverified" }
const CATS = ["safety", "target", "reach", "dream"] as const;

/** Notion-like list: search, category filter, sort; table on desktop, cards on phones. Filters live in the URL-free local state (instant). */
export function UniTable({ rows, canList }: { rows: UniRow[]; canList: boolean }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const tcat = useTranslations("categories");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [sort, setSort] = useState<"score" | "name" | "tuition">("score");
  const [mode, setMode] = useState<"gallery" | "table">("gallery");
  const te = useTranslations("explore");
  const money = (n: number, cur: string) => new Intl.NumberFormat(locale, { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(n);
  const shown = useMemo(() => {
    const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const nq = norm(q.trim());
    return rows.filter((r) => (!cat || r.category === cat) && (!nq || norm(`${r.name} ${r.alt ?? ""} ${r.city ?? ""} ${r.tiers.join(" ")}`).includes(nq)))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "tuition" ? (a.tuition ?? 1e12) - (b.tuition ?? 1e12) : (b.score ?? 0) - (a.score ?? 0));
  }, [rows, q, cat, sort]);
  const counts = useMemo(() => Object.fromEntries(CATS.map((c) => [c, rows.filter((r) => r.category === c).length])), [rows]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={inputCls} />
        <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={te("gallery")} className="flex rounded-xl border border-line bg-card p-1">
          {(["gallery", "table"] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${mode === m ? "bg-brand text-brand-ink" : "text-ink-2"}`}>{te(m)}</button>)}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">{t("sort")}
          <select value={sort} onChange={(e) => setSort(e.target.value as never)} className={`${inputCls} w-auto min-h-11`}>
            <option value="score">{t("sortScore")}</option><option value="name">{t("sortName")}</option><option value="tuition">{t("sortTuition")}</option>
          </select>
        </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("category")}>
        <button type="button" onClick={() => setCat("")} aria-pressed={!cat} className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${!cat ? "border-[var(--ink)] bg-paper-2" : "border-line"}`}>{t("allCategories")} · {rows.length}</button>
        {CATS.map((c) => <button key={c} type="button" onClick={() => setCat(cat === c ? "" : c)} aria-pressed={cat === c} className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${cat === c ? "border-[var(--ink)] bg-paper-2" : "border-line"}`}>{tcat(c)} · {counts[c]}</button>)}
      </div>
      <p className="text-sm text-mute" aria-live="polite">{t("count", { n: shown.length, total: rows.length })}</p>
      {shown.length === 0 ? (
        <div className="grid justify-items-start gap-2 rounded-2xl border border-line bg-card p-6"><p>{t("noMatch")}</p><button type="button" onClick={() => { setQ(""); setCat(""); }} className="min-h-11 font-semibold underline">{t("clear")}</button></div>
      ) : mode === "gallery" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <li key={r.slug} className="group relative overflow-hidden rounded-[22px] border border-line bg-card shadow-[var(--shadow-1)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]" data-testid="uni-card">
              <Link href={`/app/universities/${r.slug}`} className="grid">
                <Cover src={r.cover} seed={r.slug} category={r.category} alt="" className="aspect-[16/10]" />
                <span className="grid gap-1 p-4 pr-16">
                  <span className="font-display text-lg leading-snug">{r.name}</span>
                  <span className="text-sm text-mute">{[r.city, r.tiers.slice(0, 3).join(" · ")].filter(Boolean).join(" · ")}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">{r.category ? <CategoryChip category={r.category} label={tcat(r.category as never)} /> : null}{r.tuition != null ? <span className="text-sm text-ink-2">{money(r.tuition, r.currency)}</span> : null}</span>
                </span>
              </Link>
              <span className="pointer-events-none absolute bottom-4 right-4"><ScoreRing value={r.score} label={t("score")} /></span>
              {canList && <span className="absolute right-3 top-3"><ShortlistToggle kind="institution" refId={r.id} stage={r.stage} compact /></span>}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-mute"><tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">#</th><th className="px-2 py-3 font-semibold">{t("name")}</th><th className="px-2 py-3 font-semibold">{t("city")}</th>
                <th className="px-2 py-3 font-semibold">{t("category")}</th><th className="px-2 py-3 text-right font-semibold">{t("score")}</th><th className="px-2 py-3 text-right font-semibold">{t("tuition")}</th><th className="px-4 py-3 font-semibold">{t("confidence")}</th>
              </tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.slug} className="border-b border-line last:border-0 hover:bg-paper-2">
                    <td className="px-4 py-3 tabular-nums text-mute">{r.rank}</td>
                    <td className="px-2 py-3"><Link href={`/app/universities/${r.slug}`} className="font-semibold hover:underline">{r.name}</Link>{r.alt ? <span className="ml-2 text-mute">{r.alt}</span> : null}<div className="text-xs text-mute">{r.tiers.join(" · ")}</div></td>
                    <td className="px-2 py-3 text-ink-2">{r.city}</td>
                    <td className="px-2 py-3">{r.category ? <CategoryChip category={r.category} label={tcat(r.category as never)} /> : null}</td>
                    <td className="px-2 py-3 text-right font-display text-lg tabular-nums">{r.score?.toFixed(1) ?? "—"}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.tuition != null ? money(r.tuition, r.currency) : "—"}{r.tuitionEstimated ? <span className="text-mute">*</span> : null}</td>
                    <td className="px-4 py-3"><ConfidenceBadge level={r.confidence} label={tc(`confidence.${r.confidence}`)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2 md:hidden">
            {shown.map((r) => (
              <li key={r.slug}>
                <Link href={`/app/universities/${r.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
                  <span className="w-12 shrink-0 text-center font-display text-2xl tabular-nums">{r.score?.toFixed(0) ?? "—"}</span>
                  <span className="grid min-w-0 flex-1 gap-1"><span className="font-semibold leading-snug">{r.name}</span><span className="text-sm text-mute">{r.city}{r.tuition != null ? ` · ${money(r.tuition, r.currency)}` : ""}</span></span>
                  {r.category ? <CategoryChip category={r.category} label={tcat(r.category as never)} /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
