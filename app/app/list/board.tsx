"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GitCompare } from "lucide-react";
import type { ListCard } from "@/lib/server/list";
import { setStage, type Stage } from "@/app/actions/list";
import { Cover, ScoreRing } from "@/components/cover";
import { CategoryChip, ButtonLink } from "@/components/ui";
import { Gut } from "@/components/client/gut";
import { Kumo } from "@/components/kumo";
import { daysBetween } from "@/lib/domain/time";

const COLS: Stage[] = ["shortlist", "pursuing", "discarded"];

export function Board({ cards: initial, today, canEdit }: { cards: ListCard[]; today: string; canEdit: boolean }) {
  const t = useTranslations("list");
  const tcat = useTranslations("categories");
  const tcat2 = useTranslations("catalog");
  const tm = useTranslations("model");
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  useEffect(() => setCards(initial), [initial]);
  const [sel, setSel] = useState<string[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [, start] = useTransition();
  const key = (c: ListCard) => `${c.kind}:${c.refId}`;
  const byStage = useMemo(() => Object.fromEntries(COLS.map((s) => [s, cards.filter((c) => c.stage === s).sort((a, b) => (b.gut ?? 0) - (a.gut ?? 0) || (b.score ?? 0) - (a.score ?? 0))])) as Record<Stage, ListCard[]>, [cards]);

  const move = (k: string, to: Stage) => {
    const c = cards.find((x) => key(x) === k);
    if (!c || c.stage === to) return;
    setCards((cs) => cs.map((x) => (key(x) === k ? { ...x, stage: to } : x)));
    start(async () => { await setStage(c.kind, c.refId, to); router.refresh(); });
  };
  const toggleSel = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length >= 4 ? s : [...s, k]));

  if (!cards.length) return (
    <div className="grid max-w-xl justify-items-start gap-4 pt-6">
      <Kumo state="cheering" size={120} className="text-ink" />
      <h1 className="text-4xl">{t("emptyTitle")}</h1>
      <p className="text-lg text-ink-2">{t("emptyBody")}</p>
      <ButtonLink href="/app/universities">{t("explore")}</ButtonLink>
    </div>
  );

  const Card = ({ c }: { c: ListCard }) => {
    const k = key(c);
    const d = c.nextDate ? daysBetween(today, c.nextDate) : null;
    const idx = COLS.indexOf(c.stage);
    const href = c.kind === "institution" ? `/app/universities/${c.slug}` : `/app/scholarships/${c.slug}`;
    return (
      <article draggable={canEdit} onDragStart={(e) => { e.dataTransfer.setData("text/plain", k); setDrag(k); }} onDragEnd={() => setDrag(null)}
        className={`group grid overflow-hidden rounded-[20px] border bg-card shadow-[var(--shadow-1)] transition-shadow duration-150 hover:shadow-[var(--shadow-2)] ${drag === k ? "opacity-40" : ""} ${sel.includes(k) ? "border-[var(--ink)] ring-2 ring-[var(--ink)]" : "border-line"} ${c.stage === "discarded" ? "opacity-70 grayscale-[.4]" : ""}`}
        data-testid="board-card">
        <Link href={href} className="relative block" aria-label={c.name}>
          <Cover src={c.cover} seed={c.slug} category={c.category} alt="" className="aspect-[16/9]" />
          {c.score !== null && <span className="absolute bottom-2 right-2"><ScoreRing value={c.score} size={46} label={tcat2("score")} /></span>}
        </Link>
        <div className="grid gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={href} className="font-display text-lg leading-snug hover:underline">{c.name}</Link>
            <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-paper-2" title={t("select")}>
              <input type="checkbox" checked={sel.includes(k)} onChange={() => toggleSel(k)} aria-label={`${t("select")}: ${c.name}`} className="size-5 accent-[var(--ink)]" />
            </label>
          </div>
          <p className="-mt-1 text-sm text-mute">{c.subtitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            {c.category && <CategoryChip category={c.category} label={tcat(c.category as "dream")} />}
            {c.gut ? <Gut value={c.gut} size={15} /> : null}
          </div>
          <p className="text-sm">{d !== null ? <><span className="font-medium">{t("inDays", { n: Math.max(d, 0) })}</span> <span className="text-mute">· {c.nextTitle}</span></> : <span className="text-mute">{t("noNext")}</span>}</p>
          {canEdit && (
            <div className="mt-1 flex items-center justify-between border-t border-line pt-2">
              <button type="button" disabled={idx <= 0} onClick={() => move(k, COLS[idx - 1])} aria-label={idx > 0 ? t("moveTo", { stage: t(`stages.${COLS[idx - 1]}`) }) : undefined} className="grid size-11 place-items-center rounded-xl text-ink-2 hover:bg-paper-2 disabled:invisible"><ChevronLeft size={18} aria-hidden /></button>
              <span className="text-xs font-medium text-mute">{t(`stages.${c.stage}`)}</span>
              <button type="button" disabled={idx >= COLS.length - 1} onClick={() => move(k, COLS[idx + 1])} aria-label={idx < COLS.length - 1 ? t("moveTo", { stage: t(`stages.${COLS[idx + 1]}`) }) : undefined} className="grid size-11 place-items-center rounded-xl text-ink-2 hover:bg-paper-2 disabled:invisible"><ChevronRight size={18} aria-hidden /></button>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="grid gap-6 pt-2">
      <div className="grid gap-2">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="max-w-[62ch] text-lg text-ink-2">{t("lead")}</p>
        {byStage.pursuing.length > 0 && <p className="font-medium text-[var(--lacquer)]">{t("pursuingCount", { n: byStage.pursuing.length })}</p>}
        {byStage.pursuing.length > 0 && (() => { const c = (k: string) => byStage.pursuing.filter((x) => x.category === k).length; return (
          <p className="text-sm text-ink-2">{tm("balance", { safety: c("safety"), target: c("target"), reach: c("reach"), dream: c("dream") })}{c("safety") === 0 ? <span className="ml-2 font-medium text-[var(--conf-estimated)]">{tm("noSafety")}</span> : null}</p>); })()}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_.7fr] lg:grid-cols-2">
        {COLS.map((col) => (
          <section key={col} aria-labelledby={`col-${col}`}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(col); } }} onDragLeave={() => setOver((o) => (o === col ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); const k = e.dataTransfer.getData("text/plain"); if (k) move(k, col); }}
            className={`grid content-start gap-3 rounded-[24px] p-3 transition-colors ${over === col ? "bg-lacquer-soft" : col === "pursuing" ? "bg-[color-mix(in_srgb,var(--lacquer)_6%,transparent)]" : "bg-paper-2/70"} ${col === "discarded" ? "lg:col-span-2 xl:col-span-1" : ""}`}>
            <header className="grid gap-0.5 px-1 pt-1">
              <h2 id={`col-${col}`} className="flex items-baseline justify-between text-xl">{t(`stages.${col}`)}<span className="font-sans text-sm font-medium text-mute">{t("count", { n: byStage[col].length })}</span></h2>
              <p className="text-sm text-mute">{t(`stageHelp.${col}` as "stageHelp.shortlist")}</p>
            </header>
            {byStage[col].length === 0 ? <p className="grid min-h-24 place-items-center rounded-2xl border-2 border-dashed border-line text-sm text-mute">{t("dropHere")}</p> : (
              <div className={`grid gap-3 ${col === "discarded" ? "" : "sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2"}`}>{byStage[col].map((c) => <Card key={key(c)} c={c} />)}</div>
            )}
          </section>
        ))}
      </div>
      {sel.length > 0 && (
        <div className="sticky bottom-20 z-30 mx-auto flex w-full max-w-lg items-center gap-3 rounded-2xl bg-brand p-2 pl-4 text-brand-ink shadow-[var(--shadow-2)] lg:bottom-6">
          <span className="flex-1 text-sm font-medium">{sel.length < 2 ? t("selectHint") : t("compare", { n: sel.length })}</span>
          <button type="button" onClick={() => setSel([])} className="min-h-11 rounded-xl px-3 text-sm font-medium underline underline-offset-4">{t("clearSel")}</button>
          <Link href={`/app/compare?ids=${sel.join(",")}`} aria-disabled={sel.length < 2} className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ink px-4 font-medium text-brand ${sel.length < 2 ? "pointer-events-none opacity-40" : ""}`} data-testid="compare-go"><GitCompare size={18} aria-hidden />{t("compare", { n: sel.length })}</Link>
        </div>
      )}
    </div>
  );
}
