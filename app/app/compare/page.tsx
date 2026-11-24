import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { boardCards } from "@/lib/server/list";
import { activeModel, institutionsScored } from "@/lib/server/catalog";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { Cover } from "@/components/cover";
import { CategoryChip } from "@/components/ui";
import { Gut } from "@/components/client/gut";
import { PursueButton } from "./pursue";

type Cell = { text: React.ReactNode; v?: number | null };
export default async function Compare({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "list" })) redirect("/app");
  const [t, tl, tcat, locale] = await Promise.all([getTranslations("compare"), getTranslations("list"), getTranslations("categories"), getLocale()]);
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const keys = ((await searchParams).ids ?? "").split(",").filter(Boolean).slice(0, 4);
  const cards = await boardCards(ws, tz);
  const chosen = keys.map((k) => cards.find((c) => `${c.kind}:${c.refId}` === k)).filter(Boolean) as typeof cards;
  if (chosen.length < 2) return (
    <div className="grid max-w-xl gap-4 pt-6"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("pick")}</p><Link href="/app/list" className="font-medium underline">{t("back")}</Link></div>
  );
  const scored = new Map((await institutionsScored(ws)).map((x) => [x.i.id, x]));
  const schIds = chosen.filter((c) => c.kind === "scholarship").map((c) => c.refId);
  const schs = new Map((schIds.length ? await db.select().from(s.scholarship).where(and(eq(s.scholarship.workspaceId, ws), inArray(s.scholarship.id, schIds))) : []).map((x) => [x.id, x]));
  const central = (await activeModel(ws))?.params.categories.centralScenario ?? "B";
  const money = (n: number, cur: string) => new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  const fmtD = (d: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const dash: Cell = { text: <span className="text-mute">—</span> };

  const row = (key: string, fn: (c: (typeof chosen)[number]) => Cell, better: "max" | "min" | null = null) => {
    const cells = chosen.map(fn);
    const vals = cells.map((c) => c.v).filter((v): v is number => typeof v === "number");
    const best = better && vals.length > 1 ? (better === "max" ? Math.max(...vals) : Math.min(...vals)) : null;
    return { key, cells, best };
  };
  const inst = (c: (typeof chosen)[number]) => (c.kind === "institution" ? scored.get(c.refId) : undefined);
  const rows = [
    row("score", (c) => (inst(c)?.score ? { text: <span className="font-display text-2xl tabular-nums">{inst(c)!.score!.total.toFixed(1)}</span>, v: inst(c)!.score!.total } : dash), "max"),
    row("category", (c) => (c.category ? { text: <CategoryChip category={c.category} label={tcat(c.category as "dream")} /> } : dash)),
    row("netCost", (c) => { const x = inst(c); return x?.score ? { text: money(x.score.netCost.expected, (x.i.finance as { currency?: string })?.currency ?? "USD"), v: x.score.netCost.expected } : dash; }, "min"),
    row("afford", (c) => { const p = inst(c)?.score?.affordability[central]; return p !== undefined ? { text: `${Math.round(p * 100)}%`, v: p } : dash; }, "max"),
    row("admission", (c) => { const a = inst(c)?.i.admission as { low?: number; high?: number } | null; return a?.low != null ? { text: `${a.low}–${a.high}%`, v: ((a.low ?? 0) + (a.high ?? 0)) / 2 } : dash; }, "max"),
    row("prestige", (c) => (inst(c)?.score ? { text: inst(c)!.score!.parts.prestige.toFixed(1), v: inst(c)!.score!.parts.prestige } : dash), "max"),
    row("fit", (c) => (inst(c)?.score ? { text: inst(c)!.score!.parts.fit.toFixed(1), v: inst(c)!.score!.parts.fit } : dash), "max"),
    row("climate", (c) => (inst(c)?.score ? { text: inst(c)!.score!.parts.climate_city.toFixed(1), v: inst(c)!.score!.parts.climate_city } : dash), "max"),
    row("janLow", (c) => { const j = (inst(c)?.i.climate as { janLowC?: number } | null)?.janLowC; return j != null ? { text: `${j} °C` } : dash; }),
    row("coverage", (c) => { const x = c.kind === "scholarship" ? schs.get(c.refId) : undefined; const cov = x?.coverage as { text?: string; summary?: string } | null; return cov ? { text: <span className="text-sm">{cov.summary ?? cov.text}</span> } : dash; }),
    row("next", (c) => (c.nextDate ? { text: <span className="text-sm"><span className="font-medium">{fmtD(c.nextDate)}</span> · {c.nextTitle}</span> } : dash)),
    row("gut", (c) => (c.gut ? { text: <Gut value={c.gut} size={16} />, v: c.gut } : dash), "max"),
    row("pros", (c) => (c.pros.length ? { text: <ul className="grid gap-1 text-sm">{c.pros.map((p) => <li key={p}>+ {p}</li>)}</ul>, v: c.pros.length } : dash), "max"),
    row("cons", (c) => (c.cons.length ? { text: <ul className="grid gap-1 text-sm">{c.cons.map((p) => <li key={p}>− {p}</li>)}</ul> } : dash)),
  ].filter((r) => r.cells.some((c) => c !== dash));
  const canEdit = can(ctx.actor, "edit", { workspaceId: ws, module: "list" });
  const cols = `minmax(120px,160px) repeat(${chosen.length}, minmax(200px, 1fr))`;

  return (
    <div className="grid gap-6 pt-2">
      <Link href="/app/list" className="min-h-11 content-center text-sm font-medium text-ink-2 hover:underline">← {t("back")}</Link>
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="grid min-w-max gap-x-3" style={{ gridTemplateColumns: cols }} role="table" aria-label={t("title")}>
          <div role="row" className="contents">
            <div role="columnheader" className="sticky left-0 z-10 bg-paper" />
            {chosen.map((c) => (
              <div key={c.refId} role="columnheader" className="grid content-start gap-2">
                <Cover src={c.cover} seed={c.slug} category={c.category} alt="" className="aspect-[16/10] rounded-2xl" />
                <Link href={c.kind === "institution" ? `/app/universities/${c.slug}` : `/app/scholarships/${c.slug}`} className="font-display text-lg leading-snug hover:underline">{c.name}</Link>
                <p className="-mt-1 text-sm text-mute">{c.subtitle}</p>
                {canEdit && <PursueButton kind={c.kind} refId={c.refId} pursuing={c.stage === "pursuing"} label={t("pursue")} done={tl("stages.pursuing")} />}
              </div>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.key} role="row" className="contents">
              <div role="rowheader" className="sticky left-0 z-10 border-t border-line bg-paper py-3 pr-2 text-sm font-medium text-ink-2">{t(`rows.${r.key}` as "rows.score")}</div>
              {r.cells.map((c, i) => {
                const best = r.best !== null && c.v === r.best;
                return (
                  <div key={i} role="cell" className={`border-t border-line px-3 py-3 ${best ? "rounded-xl bg-[color-mix(in_srgb,var(--conf-confirmed)_12%,transparent)]" : ""}`}>
                    {c.text}{best ? <span className="ml-2 text-xs font-medium text-[var(--conf-confirmed)]">{t("best")}</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
