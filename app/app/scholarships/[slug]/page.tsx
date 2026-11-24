import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { fmtWhen } from "@/lib/format";
import { Card, ConfidenceBadge } from "@/components/ui";

export default async function ScholarshipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "catalog" })) notFound();
  const [t, tc, locale] = await Promise.all([getTranslations("catalog"), getTranslations("common"), getLocale()]);
  const [x] = await db.select().from(s.scholarship).where(and(eq(s.scholarship.workspaceId, ws), eq(s.scholarship.slug, slug), isNull(s.scholarship.deletedAt)));
  if (!x) notFound();
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const [events, sources, inst] = await Promise.all([
    db.select().from(s.event).where(and(eq(s.event.scholarshipId, x.id), isNull(s.event.deletedAt))).orderBy(asc(s.event.startsAt)),
    db.select({ title: s.source.title, url: s.source.url, confidence: s.fieldSource.confidence }).from(s.fieldSource).innerJoin(s.source, eq(s.source.id, s.fieldSource.sourceId)).where(inArray(s.fieldSource.resourceId, [x.id])),
    x.institutionId ? db.select({ slug: s.institution.slug, name: s.institution.name }).from(s.institution).where(eq(s.institution.id, x.institutionId)) : Promise.resolve([]),
  ]);
  const cov = (x.coverage ?? {}) as { text?: string; summary?: string; items?: string[]; amount?: string; type?: string; englishTaught?: string };
  const el = (x.eligibility ?? {}) as { ageLimit?: string; exams?: string };
  const link = x.howToApply && /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(x.howToApply) ? `https://${x.howToApply}` : null;
  return (
    <div className="grid max-w-3xl gap-6 pt-2">
      <Link href="/app/scholarships" className="min-h-11 content-center text-sm font-semibold text-ink-2 hover:underline">← {t("back")}</Link>
      <header className="grid gap-2">
        <div className="flex flex-wrap gap-2"><ConfidenceBadge level={x.confidence} label={tc(`confidence.${x.confidence}`)} />{x.scope && t.has(`scopes.${x.scope}`) && <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold">{t(`scopes.${x.scope}` as "scopes.private")}</span>}</div>
        <h1 className="text-[clamp(2rem,5vw,3rem)] leading-[1.05]">{x.name}</h1>
        <p className="text-ink-2">{[x.country, x.region].filter(Boolean).join(" · ")}{inst[0] && <> · <Link href={`/app/universities/${inst[0].slug}`} className="font-semibold underline underline-offset-2">{inst[0].name}</Link></>}</p>
      </header>
      <Card className="grid gap-3 p-6"><h2 className="text-xl">{t("coverage")}</h2>
        {cov.summary && <p className="font-semibold">{cov.summary}</p>}
        {cov.text && <p className="leading-relaxed text-ink-2">{cov.text}</p>}
        {cov.items?.length ? <p className="text-ink-2">{cov.items.join(" · ")}</p> : null}
        {cov.amount && <p className="text-ink-2">{cov.amount}</p>}
      </Card>
      {(el.ageLimit || el.exams) && <Card className="grid gap-1 p-6"><h2 className="text-xl">{t("eligibility")}</h2>{el.exams && <p className="text-ink-2">{el.exams}</p>}{el.ageLimit && <p className="text-sm text-mute">{el.ageLimit}</p>}</Card>}
      <Card className="grid gap-3 p-6"><h2 className="text-xl">{t("deadlines")}</h2>
        {events.length ? <ul className="grid gap-2">{events.map((e) => { const w = fmtWhen(e, tz, locale); return <li key={e.id}><Link href={`/app/calendar?e=${e.id}`} className="font-semibold hover:underline">{w.main}</Link> <span className="text-sm text-mute">· {tc(`confidence.${e.confidence}`)}</span></li>; })}</ul> : <p className="text-ink-2">{x.deadlineText ?? t("noDeadline")}</p>}
        {x.deadlineText && events.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(x.deadlineText) && <p className="text-sm text-mute">{x.deadlineText}</p>}
      </Card>
      {(x.howToApply || x.notes) && <Card className="grid gap-2 p-6">
        {x.howToApply && <><h2 className="text-xl">{t("howToApply")}</h2>{link ? <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">{x.howToApply}</a> : <p className="text-ink-2">{x.howToApply}</p>}</>}
        {x.notes && <p className="leading-relaxed text-ink-2">{x.notes}</p>}
      </Card>}
      <Card className="grid gap-2 p-6"><h2 className="text-xl">{t("sources")}</h2>{sources.length ? sources.map((y, k) => <p key={k} className="text-sm">{y.url ? <a href={y.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{y.title}</a> : y.title} · {tc(`confidence.${y.confidence}`)}</p>) : <p className="text-sm text-mute">—</p>}</Card>
    </div>
  );
}
