import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { activeModel } from "@/lib/server/catalog";
import { scoreInstitution } from "@/lib/domain/score-institution";
import { fmtWhen } from "@/lib/format";
import { Card, CategoryChip, ConfidenceBadge } from "@/components/ui";
import { InstitutionEditor } from "./editor";

export default async function UniversityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "catalog" })) notFound();
  const [t, tc, tcat, tk, locale] = await Promise.all([getTranslations("catalog"), getTranslations("common"), getTranslations("categories"), getTranslations("kinds"), getLocale()]);
  const [i] = await db.select().from(s.institution).where(and(eq(s.institution.workspaceId, ws), eq(s.institution.slug, slug), isNull(s.institution.deletedAt)));
  if (!i) notFound();
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const [model, programs, schs, events, sources, budgets, history] = await Promise.all([
    activeModel(ws),
    db.select().from(s.program).where(and(eq(s.program.institutionId, i.id), isNull(s.program.deletedAt))),
    db.select().from(s.scholarship).where(and(eq(s.scholarship.institutionId, i.id), isNull(s.scholarship.deletedAt))),
    db.select().from(s.event).where(and(eq(s.event.institutionId, i.id), isNull(s.event.deletedAt))).orderBy(asc(s.event.startsAt)),
    db.select({ title: s.source.title, url: s.source.url, confidence: s.fieldSource.confidence }).from(s.fieldSource).innerJoin(s.source, eq(s.source.id, s.fieldSource.sourceId)).where(inArray(s.fieldSource.resourceId, [i.id])),
    db.select().from(s.budgetScenario).where(eq(s.budgetScenario.workspaceId, ws)),
    db.select({ at: s.activityLog.createdAt, action: s.activityLog.action, diff: s.activityLog.diff, who: s.user.name }).from(s.activityLog).leftJoin(s.user, eq(s.user.id, s.activityLog.actorId))
      .where(and(eq(s.activityLog.resourceType, "institution"), eq(s.activityLog.resourceId, i.id), eq(s.activityLog.action, "update"))).orderBy(desc(s.activityLog.createdAt)).limit(10),
  ]);
  const r = model ? scoreInstitution(i as never, model.params) : null;
  const fin = (i.finance ?? {}) as { currency?: string; tuitionYear?: number | null; tuitionEstimated?: boolean };
  const det = (i.details ?? {}) as { verdict?: string; requirements?: string; notes?: string; englishPrograms?: string[]; duolingo?: string; scoring?: { tierPointsOverride?: number; rankPointsOverride?: number } };
  const cur = fin.currency ?? "USD";
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  const names = (i.names ?? {}) as Record<string, string>;
  const W = model?.params.weights ?? {};
  const reasonText = (x: string) => { const [k, n, s2] = x.split(":"); return t(`reasons.${k}` as "reasons.finance", { n: n.replace("-", ""), s: (s2 ?? "").split(",").join(", ") }); };
  const canEdit = can(ctx.actor, "edit", { workspaceId: ws, module: "catalog" });
  const qs = i.rankings?.find((x) => x.source === "QS");

  return (
    <div className="grid max-w-4xl gap-6 pt-2">
      <Link href="/app/universities" className="min-h-11 content-center text-sm font-semibold text-ink-2 hover:underline">← {t("back")}</Link>
      <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">{r?.category && <CategoryChip category={r.category} label={tcat(r.category as never)} />}<ConfidenceBadge level={i.confidence} label={tc(`confidence.${i.confidence}`)} /></div>
          <h1 className="text-[clamp(2rem,5vw,3.2rem)] leading-[1.05]">{i.name}</h1>
          <p className="text-ink-2">{[names.zh, names.es, i.city, i.tiers.join(" · "), qs?.label].filter(Boolean).join(" · ")}</p>
        </div>
        {r && <div className="text-right"><p className="font-display text-6xl leading-none tabular-nums">{r.total.toFixed(1)}</p><p className="text-sm text-mute">{t("score")} / 100</p></div>}
      </header>

      {r && model && (
        <Card className="grid gap-5 p-6">
          <h2 className="text-2xl">{t("breakdown")}</h2>
          <div className="grid gap-3">
            {(["prestige", "fit", "finance", "climate_city"] as const).map((k) => (
              <div key={k} className="grid gap-1">
                <div className="flex justify-between text-sm"><span className="font-semibold">{t(`parts.${k}`)}{k === "prestige" && (det.scoring?.tierPointsOverride != null || det.scoring?.rankPointsOverride != null) ? <span className="ml-2 font-normal text-mute">({t("manual")})</span> : null}</span><span className="tabular-nums text-ink-2">{r.parts[k].toFixed(1)} / {W[k] ?? 0}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${(r.parts[k] / (W[k] || 1)) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          {r.reasons.length > 0 && <ul className="grid gap-1 text-sm text-ink-2">{r.reasons.map((x) => <li key={x}>• {reasonText(x)}</li>)}</ul>}
          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <div><p className="text-sm text-mute">{t("netCost")}</p><p className="font-display text-2xl tabular-nums">{money(r.netCost.expected)}</p></div>
            <div><p className="text-sm text-mute">{t("admission")}</p><p className="font-display text-2xl tabular-nums">{(i.admission as { low?: number })?.low ?? "—"}–{(i.admission as { high?: number })?.high ?? "—"}%</p></div>
            <div><p className="text-sm text-mute">{t("affordability")}</p>
              <ul className="mt-1 grid gap-1 text-sm">{Object.entries(r.affordability).map(([k, v]) => { const b = budgets.find((x) => x.key === k); return <li key={k} className="flex justify-between gap-2"><span>{t("scenario", { key: k })}{b ? <span className="text-mute"> · {money(b.amountPerYear)}</span> : null}</span><span className="font-semibold tabular-nums">{Math.round(v * 100)}%</span></li>; })}</ul>
            </div>
          </div>
        </Card>
      )}

      {det.verdict && <Card className="grid gap-2 p-6"><h2 className="text-xl">{t("verdict")}</h2><p className="leading-relaxed text-ink-2">{det.verdict}</p></Card>}

      <div className="grid gap-6 md:grid-cols-2">
        {events.length > 0 && (
          <Card className="grid content-start gap-3 p-6"><h2 className="text-xl">{t("deadlines")}</h2>
            <ul className="grid gap-2">{events.map((e) => { const w = fmtWhen(e, tz, locale); return (
              <li key={e.id}><Link href={`/app/calendar?e=${e.id}`} className="grid gap-0.5 rounded-lg hover:underline"><span className="font-semibold">{e.title}</span><span className="text-sm text-mute">{tk(e.kind as never)} · {w.main}{w.original ? ` (${w.original})` : ""} · {tc(`confidence.${e.confidence}`)}</span></Link></li>); })}</ul>
          </Card>
        )}
        {(det.requirements || det.duolingo) && (
          <Card className="grid content-start gap-2 p-6"><h2 className="text-xl">{t("requirements")}</h2>{det.requirements && <p className="text-ink-2">{det.requirements}</p>}{det.duolingo && <p className="text-sm text-mute">Duolingo: {det.duolingo}</p>}</Card>
        )}
        {(programs.length > 0 || (det.englishPrograms?.length ?? 0) > 0) && (
          <Card className="grid content-start gap-3 p-6"><h2 className="text-xl">{t("programs")}</h2>
            <ul className="grid gap-1 text-sm">{(programs.length ? programs.map((p) => p.name) : det.englishPrograms ?? []).map((n) => <li key={n}>• {n}</li>)}</ul>
          </Card>
        )}
        {schs.length > 0 && (
          <Card className="grid content-start gap-3 p-6"><h2 className="text-xl">{t("scholarshipsHere")}</h2>
            {schs.map((x) => <Link key={x.id} href={`/app/scholarships/${x.slug}`} className="grid gap-1 hover:underline"><span className="font-semibold">{(x.coverage as { summary?: string } | null)?.summary ?? x.name}</span></Link>)}
          </Card>
        )}
      </div>

      <Card className="grid gap-2 p-6"><h2 className="text-xl">{t("sources")}</h2>
        {sources.length ? sources.map((x, k) => <p key={k} className="text-sm">{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">{x.title}</a> : x.title} · {tc(`confidence.${x.confidence}`)}</p>) : <p className="text-sm text-mute">—</p>}
        {history.length > 0 && <ul className="mt-2 grid gap-1 text-sm text-mute">{history.map((h, k) => <li key={k}>{h.who ?? "Kumo"} · {Object.keys(h.diff ?? {}).join(", ")} · {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(h.at)}</li>)}</ul>}
      </Card>

      {canEdit && <InstitutionEditor slug={i.slug} currency={cur} initial={{ tuitionYear: fin.tuitionYear ?? null, livingMonth: i.costOfLiving?.month ?? null, admissionLow: (i.admission as { low?: number })?.low ?? null, admissionHigh: (i.admission as { high?: number })?.high ?? null, confidence: i.confidence, notes: det.notes ?? "" }} />}
    </div>
  );
}
