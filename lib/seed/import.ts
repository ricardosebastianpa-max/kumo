/**
 * Idempotent seed-pack importer. Upserts by slug/externalKey inside one workspace, inside one transaction.
 * `dryRun` returns the preview (create/update/unchanged counts per entity) without writing.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/db/schema";
import { PackPack, type SeedPack } from "./schema";
import { zonedToUtc } from "@/lib/domain/time";
import { slugify } from "./adapters/centro-v0";

export interface ImportPreview { [entity: string]: { create: number; update: number; unchanged: number } }
export interface ImportResult { preview: ImportPreview; unresolved: string[]; seedPackId?: string }

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
function same(row: Record<string, unknown>, data: Record<string, unknown>): boolean {
  return Object.entries(data).every(([k, v]) => {
    const r = row[k];
    if (v instanceof Date || r instanceof Date) return new Date(r as string).getTime() === new Date(v as string).getTime();
    return stable(r ?? null) === stable(v ?? null);
  });
}

export async function importSeedPack(db: DB, workspaceId: string, raw: unknown, opts: { actorId: string; dryRun?: boolean }): Promise<ImportResult> {
  const pack: SeedPack = PackPack.parse(raw);
  const preview: ImportPreview = {};
  const unresolved = new Set<string>();
  const bump = (e: string, k: "create" | "update" | "unchanged") => { (preview[e] ??= { create: 0, update: 0, unchanged: 0 })[k]++; };

  const run = async (tx: Tx) => {
    const now = new Date();
    const log = (action: string, resourceType: string, resourceId: string) =>
      opts.dryRun ? Promise.resolve() : tx.insert(s.activityLog).values({ workspaceId, actorId: opts.actorId, action, resourceType, resourceId, meta: { pack: pack.slug, version: pack.version } });

    /** Generic upsert keyed by (workspace_id, keyCol). */
    async function upsert<T extends typeof s.institution | typeof s.program | typeof s.scholarship | typeof s.exam | typeof s.examSession | typeof s.requirementTemplate | typeof s.event | typeof s.studyGoal | typeof s.budgetScenario>(
      entity: string, table: T, keyCol: "slug" | "externalKey" | "key", key: string, data: Record<string, unknown>,
    ): Promise<string> {
      const t = table as unknown as typeof s.institution & Record<string, never>;
      const col = (t as unknown as Record<string, typeof s.institution.slug>)[keyCol];
      const [row] = await tx.select().from(table as typeof s.institution).where(and(eq(t.workspaceId, workspaceId), eq(col, key))).limit(1);
      if (!row) {
        bump(entity, "create");
        if (opts.dryRun) return `dry:${key}`;
        const [ins] = await tx.insert(table as typeof s.institution).values({ ...data, workspaceId, [keyCol]: key, createdBy: opts.actorId } as never).returning({ id: t.id });
        await log("import", entity, ins.id);
        return ins.id;
      }
      if (same(row as Record<string, unknown>, data) && !row.deletedAt) { bump(entity, "unchanged"); return row.id; }
      bump(entity, "update");
      if (!opts.dryRun) {
        await tx.update(table as typeof s.institution).set({ ...data, deletedAt: null, updatedAt: now } as never).where(eq(t.id, row.id));
        await log("import", entity, row.id);
      }
      return row.id;
    }

    async function attachSource(resourceType: string, resourceId: string, src: { url?: string | null; title: string } | null | undefined, confidence: "confirmed" | "estimated" | "unverified") {
      if (!src || opts.dryRun) return;
      const [existing] = await tx.select().from(s.source).where(and(eq(s.source.workspaceId, workspaceId), eq(s.source.title, src.title))).limit(1);
      const sourceId = existing?.id ?? (await tx.insert(s.source).values({ workspaceId, url: src.url ?? null, title: src.title, createdBy: opts.actorId }).returning({ id: s.source.id }))[0].id;
      const [link] = await tx.select().from(s.fieldSource).where(and(eq(s.fieldSource.sourceId, sourceId), eq(s.fieldSource.resourceId, resourceId))).limit(1);
      if (!link) await tx.insert(s.fieldSource).values({ sourceId, resourceType, resourceId, field: "*", confidence });
    }

    // Profile
    if (pack.profile) {
      const [row] = await tx.select().from(s.studentProfile).where(eq(s.studentProfile.workspaceId, workspaceId)).limit(1);
      const data = { ...pack.profile, displayName: pack.profile.displayName };
      if (!row) { bump("profile", "create"); if (!opts.dryRun) await tx.insert(s.studentProfile).values({ ...data, workspaceId, createdBy: opts.actorId }); }
      else if (same(row as Record<string, unknown>, data)) bump("profile", "unchanged");
      else { bump("profile", "update"); if (!opts.dryRun) await tx.update(s.studentProfile).set(data).where(eq(s.studentProfile.id, row.id)); }
    }

    for (const b of pack.budgets) await upsert("budget", s.budgetScenario, "key", b.key, { label: b.label, currency: b.currency, amountPerYear: b.amountPerYear, weight: b.weight ?? null, isCentral: !!b.isCentral, incomes: b.incomes ?? null });
    if (!opts.dryRun) for (const f of pack.fx) {
      await tx.insert(s.fxRate).values({ workspaceId, base: f.base, quote: f.quote, rate: f.rate })
        .onConflictDoUpdate({ target: [s.fxRate.workspaceId, s.fxRate.base, s.fxRate.quote], set: { rate: f.rate, updatedAt: now } });
    }

    const inst = new Map<string, string>();
    for (const i of pack.institutions) {
      const { slug, source, ...rest } = i;
      const id = await upsert("institution", s.institution, "slug", slug, { ...rest, names: rest.names ?? null, kind: rest.kind ?? null, country: rest.country ?? null, city: rest.city ?? null, region: rest.region ?? null, lat: rest.lat ?? null, lon: rest.lon ?? null, climate: rest.climate ?? null, costOfLiving: rest.costOfLiving ?? null, admission: rest.admission ?? null, finance: rest.finance ?? null, details: rest.details ?? null });
      inst.set(slug, id);
      await attachSource("institution", id, source, i.confidence);
    }
    for (const p of pack.programs) {
      const institutionId = inst.get(p.institution);
      if (!institutionId) { unresolved.add(`program:${p.slug}→${p.institution}`); continue; }
      await upsert("program", s.program, "slug", p.slug, { institutionId, name: p.name, field: p.field ?? null, language: p.language ?? null, level: p.level, durationYears: p.durationYears ?? null, tuition: p.tuition ?? null, requirements: p.requirements ?? null, confidence: p.confidence });
    }
    const sch = new Map<string, string>();
    for (const x of pack.scholarships) {
      const id = await upsert("scholarship", s.scholarship, "slug", x.slug, {
        name: x.name, institutionId: x.institution ? inst.get(x.institution) ?? null : null, issuer: x.issuer ?? null, scope: x.scope ?? null, country: x.country ?? null, region: x.region ?? null,
        coverage: x.coverage ?? null, eligibility: x.eligibility ?? null, howToApply: x.howToApply ?? null, deadlineText: x.deadlineText ?? null, notes: x.notes ?? null, confidence: x.confidence,
      });
      sch.set(x.slug, id);
      await attachSource("scholarship", id, x.source, x.confidence);
    }
    const exams = new Map<string, string>();
    for (const e of pack.exams) {
      const examId = await upsert("exam", s.exam, "slug", e.slug, { name: e.name, sections: e.sections ?? null });
      exams.set(e.slug, examId);
      for (const ss of e.sessions) {
        const tz = ss.timezone ?? "UTC";
        await upsert("exam_session", s.examSession, "slug", ss.slug, {
          examId, startsOn: ss.startsOn ?? null, endsOn: ss.endsOn ?? null, timezone: tz, location: ss.location ?? null, status: ss.status ?? null, confidence: ss.confidence,
          registrationOpensAt: ss.registrationOpens ? zonedToUtc(ss.registrationOpens.date, ss.registrationOpens.time, tz) : null,
          registrationClosesAt: ss.registrationCloses ? zonedToUtc(ss.registrationCloses.date, ss.registrationCloses.time, tz) : null,
        });
      }
    }

    // Tags for relations that are not catalog entities (resolved last so unknown slugs become tags).
    const tags = new Set<string>();
    for (const ev of pack.events) {
      const rel = ev.related ?? null;
      const institutionId = rel ? inst.get(rel) ?? null : null;
      const scholarshipId = rel && !institutionId ? sch.get(rel) ?? null : null;
      const tagList: string[] = [];
      if (rel && !institutionId && !scholarshipId) { const t = slugify(rel); tagList.push(t); tags.add(`${t}|${rel}`); }
      if (rel && exams.has(rel)) tagList.push(rel);
      const allDay = !ev.time;
      await upsert("event", s.event, "externalKey", ev.key, {
        kind: ev.kind, title: ev.title, notes: ev.notes ?? null, allDay, timezone: ev.timezone,
        startsAt: zonedToUtc(ev.date, ev.time ?? null, ev.timezone), endsAt: ev.endDate ? zonedToUtc(ev.endDate, ev.time ?? null, ev.timezone) : null,
        confidence: ev.confidence, priority: ev.priority, institutionId, scholarshipId, tags: [...new Set(tagList)],
      });
    }
    if (!opts.dryRun) for (const t of tags) {
      const [slug, label] = t.split("|");
      await tx.insert(s.tag).values({ workspaceId, slug, label, createdBy: opts.actorId }).onConflictDoNothing();
    }

    for (const r of pack.requirementTemplates) await upsert("requirement_template", s.requirementTemplate, "slug", r.slug, { name: r.name, items: r.items });
    for (const g of pack.studyGoals) await upsert("study_goal", s.studyGoal, "externalKey", g.key, { subject: g.subject, target: g.target ?? null, deadline: g.deadline ?? null, deadlineText: g.deadlineText ?? null, notes: g.notes ?? null });

    // Lists & plans: replaced as a whole per list name (no natural keys).
    if (pack.targetList.length) {
      const lists = [...new Set(pack.targetList.map((t) => t.list))];
      for (const list of lists) {
        const items = pack.targetList.filter((t) => t.list === list);
        const existing = await tx.select({ id: s.targetListItem.id }).from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, workspaceId), eq(s.targetListItem.list, list), isNull(s.targetListItem.deletedAt)));
        if (existing.length === items.length) { preview.target_list = { create: 0, update: 0, unchanged: (preview.target_list?.unchanged ?? 0) + items.length }; continue; }
        preview.target_list = { create: (preview.target_list?.create ?? 0) + items.length, update: 0, unchanged: preview.target_list?.unchanged ?? 0 };
        if (opts.dryRun) continue;
        await tx.update(s.targetListItem).set({ deletedAt: now }).where(and(eq(s.targetListItem.workspaceId, workspaceId), eq(s.targetListItem.list, list)));
        await tx.insert(s.targetListItem).values(items.map((t) => ({ workspaceId, list, label: t.label, institutionId: t.institution ? inst.get(t.institution) ?? null : null, category: t.category ?? null, reasons: t.reasons ?? null, createdBy: opts.actorId })));
      }
    }
    for (const p of pack.studyPlans) {
      const [row] = await tx.select().from(s.studyPlan).where(and(eq(s.studyPlan.workspaceId, workspaceId), eq(s.studyPlan.name, p.name))).limit(1);
      if (row) { bump("study_plan", same(row as Record<string, unknown>, { weeklyHours: p.weeklyHours }) ? "unchanged" : "update"); if (!opts.dryRun) await tx.update(s.studyPlan).set({ weeklyHours: p.weeklyHours, notes: p.notes ?? null }).where(eq(s.studyPlan.id, row.id)); }
      else { bump("study_plan", "create"); if (!opts.dryRun) await tx.insert(s.studyPlan).values({ workspaceId, name: p.name, weeklyHours: p.weeklyHours, notes: p.notes ?? null, createdBy: opts.actorId }); }
    }
    if (pack.scoringModel) {
      const m = pack.scoringModel;
      const [row] = await tx.select().from(s.scoringModel).where(and(eq(s.scoringModel.workspaceId, workspaceId), eq(s.scoringModel.version, m.version))).limit(1);
      if (!row) { bump("scoring_model", "create"); if (!opts.dryRun) await tx.insert(s.scoringModel).values({ workspaceId, version: m.version, name: m.name, params: m.params, createdBy: opts.actorId }); }
      else if (same(row as Record<string, unknown>, { params: m.params })) bump("scoring_model", "unchanged");
      else { bump("scoring_model", "update"); if (!opts.dryRun) await tx.update(s.scoringModel).set({ params: m.params, name: m.name }).where(eq(s.scoringModel.id, row.id)); }
    }

    if (!opts.dryRun) {
      const summary = Object.fromEntries(Object.entries(preview).map(([k, v]) => [k, v.create + v.update + v.unchanged]));
      const [sp] = await tx.insert(s.seedPack).values({ workspaceId, slug: pack.slug, version: pack.version, title: pack.title, schemaVersion: pack.schemaVersion, summary, importedBy: opts.actorId }).returning({ id: s.seedPack.id });
      return sp.id;
    }
    return undefined;
  };

  let seedPackId: string | undefined;
  if (opts.dryRun) {
    // Read-only preview: run inside a transaction that is always rolled back.
    await db.transaction(async (tx) => { await run(tx); tx.rollback(); }).catch((e: unknown) => { if (!(e instanceof Error && /rollback/i.test(e.message))) throw e; });
  } else {
    seedPackId = await db.transaction(run);
  }
  return { preview, unresolved: [...unresolved], seedPackId };
}
