/**
 * Adapter: converts the "Centro de Control v0" research folder (data/*.json) into a canonical SeedPack v1.
 * It only translates formats; the app never reads these legacy files directly.
 */
import type { SeedPack } from "../schema";
import { parseRank, type ScoringParams } from "@/lib/domain/scoring";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
export interface CentroFiles {
  profile?: Json; universities?: Json[]; scholarshipsGlobal?: Json[]; localScholarships?: Json[];
  cscaSessions?: Json[]; events?: Json[]; chineseRoute?: Record<string, Json[]>; studyPlan?: Json;
  checklist?: string[]; model?: Json;
}

const MONTHS: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

export function slugify(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

const CONF: Record<string, "confirmed" | "estimated" | "unverified"> = {
  confirmada: "confirmed", confirmed: "confirmed", estimada: "estimated", estimated: "estimated",
};
export const mapConfidence = (c: string | null | undefined) => CONF[(c ?? "").toLowerCase()] ?? "unverified";
const PRIO: Record<string, "critical" | "high" | "medium" | "low"> = { "crítica": "critical", critica: "critical", alta: "high", media: "medium", baja: "low" };
export const mapPriority = (p: string | null | undefined) => PRIO[(p ?? "").toLowerCase()] ?? "medium";
const CATEGORY: Record<string, string> = { "sueño": "dream", sueno: "dream", reach: "reach", target: "target", safety: "safety" };
export const mapCategory = (c: string | null | undefined) => (c ? CATEGORY[c.toLowerCase()] ?? slugify(c) : undefined);

/** "15:00 Pekín (01:00 Managua)" → { time: "15:00", tz: "Asia/Shanghai" }. */
export function parseTimeText(t: string | null | undefined): { time: string | null; tz: string | null } {
  if (!t) return { time: null, tz: null };
  const m = t.match(/(\d{1,2}):(\d{2})/);
  const tz = /pek[ií]n|beijing|china/i.test(t) ? "Asia/Shanghai" : null;
  return { time: m ? `${pad(+m[1])}:${m[2]}` : null, tz };
}

/** "19–20 dic 2026" | "30 dic – 5 ene" (+year hint) → start/end ISO dates. */
export function parseSpanishRange(text: string, yearHint: number): { start: string; end: string; startTime: string | null; endTime: string | null } | null {
  const parts = text.split(/\s[–-]\s|–/).map((x) => x.trim()).filter(Boolean);
  const re = /(\d{1,2})(?:\s+([a-zé]{3})[a-z]*)?(?:\s+(\d{4}))?(?:\s+(\d{1,2}:\d{2}))?/i;
  const parsed = parts.map((p) => p.match(re)).filter(Boolean) as RegExpMatchArray[];
  if (parsed.length === 0) return null;
  const a = parsed[0], b = parsed[parsed.length - 1];
  const mb = MONTHS[(b[2] ?? a[2] ?? "").toLowerCase()];
  const ma = MONTHS[(a[2] ?? b[2] ?? "").toLowerCase()];
  if (!ma || !mb) return null;
  const yb = b[3] ? +b[3] : a[3] ? +a[3] : yearHint;
  const ya = a[3] ? +a[3] : ma > mb ? yb - 1 : yb;
  return { start: `${ya}-${pad(ma)}-${pad(+a[1])}`, end: `${yb}-${pad(mb)}-${pad(+b[1])}`, startTime: a[4] ?? null, endTime: b[4] ?? null };
}

/** Parses "15*P(net<=A)+12*P(net<=B)+8*P(net<=C)" into scenario points. */
function financePoints(formula: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of formula.matchAll(/(\d+(?:\.\d+)?)\s*\*\s*P\(net\s*<=\s*([A-Z])\)/g)) out[m[2]] = +m[1];
  return out;
}

export function scoringParamsFromModel(model: Json): ScoringParams {
  const fp = financePoints(model.finance_formula ?? "");
  const budgets = model.budgets_cny_year ?? {};
  const scenarios = Object.entries(budgets).map(([k, v]) => {
    const key = k.split("_")[0];
    return { key, amountPerYear: Number(v), points: fp[key] ?? 0 };
  });
  const tierPoints: Record<string, number> = {};
  for (const [k, v] of Object.entries(model.prestige_tier_points ?? {})) tierPoints[k] = Number(v);
  // Tier names in the data are case-sensitive variants ("provincial" vs "Provincial").
  for (const [k, v] of Object.entries(tierPoints)) tierPoints[k.charAt(0).toUpperCase() + k.slice(1)] = v;
  const rankPoints = (model.qs_points ?? []) as [number | "unranked", number][];
  const catRe = /(Safety|Target|Reach)\s*(?:>=\s*([\d.]+)|([\d.]+)\s*-\s*([\d.]+))/g;
  const thresholds: { label: string; min: number }[] = [];
  for (const m of String(model.categories ?? "").matchAll(catRe)) thresholds.push({ label: m[1].toLowerCase(), min: Number(m[2] ?? m[3]) });
  thresholds.sort((a, b) => b.min - a.min);
  thresholds.push({ label: "dream", min: 0 });
  return {
    weights: Object.fromEntries(Object.entries(model.weights ?? {}).map(([k, v]) => [k, Number(v)])),
    prestige: {
      tierPoints,
      rankPoints,
      maxRaw: Math.max(...Object.values(tierPoints)) + Math.max(...rankPoints.map(([, p]) => p)),
    },
    fit: { points: Object.fromEntries(Object.entries(model.fit_points ?? {}).map(([k, v]) => [k, Number(v)])), maxRaw: Math.max(...Object.values(model.fit_points ?? { x: 1 }).map(Number)) },
    finance: { scenarios, tolerance: 0.05, insurancePerYear: Number(String(model.finance_formula).match(/\+\s*(\d+)\s*insurance/)?.[1] ?? 0) },
    climate: { coldBands: [[-10, 5], [-3, 4], [1, 3], [5, 1]], noHeatingPenaltyBelowC: 1, charmMax: 5 },
    categories: { thresholds, centralScenario: scenarios.find((s) => s.key === "B")?.key ?? scenarios[0]?.key ?? "B" },
  };
}

function splitPrograms(text: string | null | undefined): string[] {
  if (!text || text.trim().startsWith("(")) return [];
  return text.split(/\s*·\s*/).map((x) => x.trim()).filter((x) => x.length > 1 && !x.startsWith("("));
}

export function convertCentro(files: CentroFiles, meta: { slug: string; version: string; title: string }): SeedPack {
  const model = files.model ?? {};
  const params = scoringParamsFromModel(model);
  const fitByPoints = Object.fromEntries(Object.entries(params.fit.points).map(([k, v]) => [String(v), k]));
  const profileTz = files.profile?.timezone ?? "UTC";

  const institutions = (files.universities ?? []).map((u: Json) => {
    const rank = parseRank(u.qs_band);
    const tierP = Math.max(0, ...((u.tiers ?? []) as string[]).map((t) => params.prestige.tierPoints[t] ?? 0));
    const rankP = (() => { for (const [mx, p] of params.prestige.rankPoints) { if (mx !== "unranked" && rank !== null && rank <= mx) return p; } return params.prestige.rankPoints.find(([m]) => m === "unranked")?.[1] ?? 0; })();
    const s = u.scores ?? {};
    // Manual assessments from the research are kept as explicit, editable overrides.
    const scoring: Record<string, unknown> = { fitKey: fitByPoints[String(s.fit_20)] ?? "none" };
    if (s.tier_points !== undefined && s.tier_points !== tierP) scoring.tierPointsOverride = s.tier_points;
    if (s.qs_points !== undefined && s.qs_points !== rankP) scoring.rankPointsOverride = s.qs_points;
    const sino = (u.tiers ?? []).includes("Sino-extranjera");
    return {
      slug: u.slug, name: u.name,
      names: Object.fromEntries(Object.entries({ es: u.name_es, zh: u.name_zh }).filter(([, v]) => v)) as Record<string, string>,
      kind: sino ? "sino_foreign" : u.type ?? undefined, country: "CN", city: u.city ?? undefined, region: u.province ?? undefined,
      lat: u.lat ?? null, lon: u.lon ?? null,
      tiers: u.tiers ?? [],
      rankings: [{ source: "QS", label: u.qs_band ?? undefined, rank: rank ?? undefined }],
      climate: { janHighC: u.climate?.jan_high_c ?? null, janLowC: u.climate?.jan_low_c ?? null, centralHeating: u.climate?.central_heating ?? null, charm: u.climate?.city_charm_1to5 ?? null, note: u.climate?.city_note ?? null },
      costOfLiving: u.climate?.living_cny_month ? { currency: "CNY", month: u.climate.living_cny_month } : undefined,
      admission: { low: u.admission_pct_low ?? null, high: u.admission_pct_high ?? null },
      finance: {
        currency: "CNY",
        // Unknown tuition: back out the research's gross-cost estimate and flag it as estimated.
        tuitionYear: u.tuition_cny ?? (u.finance?.gross_cost_cny ? u.finance.gross_cost_cny - (u.climate?.living_cny_month ?? 0) * 12 - params.finance.insurancePerYear : null),
        tuitionEstimated: u.tuition_cny == null, tuitionSource: u.tuition_source ?? null,
        pFull: u.p_full_scholarship ?? 0, fullValue: u.full_value_cny ?? 0, pPartial: u.p_partial_scholarship ?? 0, partialValue: u.partial_value_cny ?? 0,
      },
      details: {
        scoring, englishPrograms: u.english_programs_all ?? [], requirements: u.requirements ?? null, duolingo: u.duolingo ?? null,
        deadlinesText: u.deadlines_text ?? null, verdict: u.verdict ?? null, notes: u.notes || null, legacy: { scores: s, category: u.category_budget_B },
      },
      confidence: u.tuition_source === "oficial" ? ("confirmed" as const) : ("estimated" as const),
      source: u.source ? { url: /^https?:/.test(u.source) ? u.source : `https://${String(u.source).split(/[ ,;·]/)[0]}`, title: String(u.source) } : null,
    };
  });
  const instByName = new Map<string, string>();
  for (const i of institutions) { instByName.set(i.name.toLowerCase(), i.slug); instByName.set(slugify(i.name), i.slug); }

  const programs: SeedPack["programs"] = [];
  const seenProg = new Set<string>();
  for (const u of files.universities ?? []) {
    for (const [field, text] of [["cs", u.cs_programs_en], ["business", u.business_programs_en]] as const) {
      for (const name of splitPrograms(text)) {
        let slug = `${u.slug}-${slugify(name)}`.slice(0, 110);
        while (seenProg.has(slug)) slug += "-2";
        seenProg.add(slug);
        programs.push({ slug, institution: u.slug, name, field, language: "en", level: "bachelor", tuition: u.tuition_cny ? { currency: "CNY", year: u.tuition_cny } : undefined, confidence: u.tuition_source === "oficial" ? "confirmed" : "estimated" });
      }
    }
  }

  const scholarships: SeedPack["scholarships"] = [];
  const seenSch = new Set<string>();
  const uniqSlug = (base: string) => { let s = base; let n = 2; while (seenSch.has(s)) s = `${base}-${n++}`; seenSch.add(s); return s; };
  for (const u of files.universities ?? []) {
    if (!u.scholarships_text) continue;
    scholarships.push({
      slug: uniqSlug(`${u.slug}-institutional`), name: `${u.name}: beca institucional`, institution: u.slug, issuer: u.name, scope: "institutional", country: "CN",
      coverage: { summary: u.scholarship_summary ?? null, text: u.scholarships_text }, notes: u.deadlines_text ?? undefined, confidence: "estimated",
    });
  }
  const globalSch = (files.scholarshipsGlobal ?? []).map((g: Json) => {
    const slug = uniqSlug(slugify(g.name));
    scholarships.push({
      slug, name: g.name, scope: g.category === "gov" ? "government" : g.category === "uni" ? "institutional" : g.category ?? undefined, country: g.country ?? undefined,
      coverage: { text: g.coverage ?? null }, eligibility: { ageLimit: g.age_limit ?? null, exams: g.exams ?? null },
      howToApply: g.how_to_apply ?? undefined, deadlineText: g.deadline ?? undefined, notes: g.notes ?? undefined,
      confidence: g.deadline ? mapConfidence(g.confidence) : "unverified",
      source: g.how_to_apply && /\./.test(g.how_to_apply) && !/\s/.test(g.how_to_apply) ? { url: `https://${g.how_to_apply}`, title: g.how_to_apply } : null,
    });
    return { slug, g };
  });
  for (const l of files.localScholarships ?? []) {
    scholarships.push({
      slug: uniqSlug(slugify(l.n)), name: l.n, scope: "local_government", country: "CN", region: l.p ?? undefined,
      coverage: { type: l.t ?? null, items: l.cov ?? [], amount: l.amt ?? null, englishTaught: l.en ?? null }, deadlineText: l.win ?? undefined, notes: l.note ?? undefined, confidence: "estimated",
    });
  }

  // Exam sessions (CSCA-style table): exam range + registration window in Beijing time.
  const sessions: SeedPack["exams"][number]["sessions"] = [];
  for (const row of files.cscaSessions ?? []) {
    const yr = Number(String(row.exam).match(/\d{4}/)?.[0] ?? new Date().getFullYear());
    const ex = parseSpanishRange(String(row.exam), yr);
    if (!ex) continue;
    const reg = parseSpanishRange(String(row.registration ?? ""), Number(ex.start.slice(0, 4)));
    const status = String(row.status ?? "").replace(/[⚑]/g, "").trim();
    sessions.push({
      slug: `csca-${ex.start}`, startsOn: ex.start, endsOn: ex.end, timezone: "Asia/Shanghai",
      registrationOpens: reg ? { date: reg.start, time: reg.startTime ?? "00:00" } : undefined,
      registrationCloses: reg ? { date: reg.end, time: reg.endTime ?? "23:59" } : undefined,
      status: status && status !== "—" ? status : undefined, confidence: "confirmed",
    });
  }
  const exams: SeedPack["exams"] = sessions.length ? [{ slug: "csca", name: "CSCA", sections: [{ key: "math", label: "Matemáticas" }, { key: "physics", label: "Física" }], sessions }] : [];

  const chineseInst = new Set(institutions.map((i) => i.slug));
  const events: SeedPack["events"] = [];
  (files.events ?? []).forEach((e: Json, i: number) => {
    const { time, tz } = parseTimeText(e.time);
    let related: string | null = e.related ?? null;
    if (related && !chineseInst.has(related)) related = instByName.get(related.toLowerCase()) ?? instByName.get(slugify(related)) ?? related;
    const zone = tz ?? (related && (chineseInst.has(related) || related === "csca") ? "Asia/Shanghai" : profileTz);
    events.push({
      key: `ev:${e.date}:${slugify(e.title).slice(0, 40)}:${i}`, kind: e.type === "window_open" ? "window" : e.type, title: e.title, notes: e.notes || undefined,
      date: e.date, endDate: e.end_date ?? null, time, timezone: zone,
      // The student's own tasks/milestones are plans, not third-party facts.
      confidence: e.type === "task" || e.type === "milestone" ? "confirmed" : mapConfidence(e.confidence), priority: mapPriority(e.priority), related,
      source: e.source ? { url: null, title: e.source } : null,
    });
  });
  for (const { slug, g } of globalSch) {
    if (!g.deadline) continue;
    events.push({ key: `sch:${slug}`, kind: "deadline", title: `${g.name}: plazo`, date: g.deadline, timezone: profileTz, confidence: mapConfidence(g.confidence), priority: "medium", related: slug, source: null });
  }

  const targetList: SeedPack["targetList"] = [];
  for (const [cat, rows] of Object.entries(files.chineseRoute ?? {})) {
    for (const r of rows) {
      const [name, majors] = Array.isArray(r) ? r : [r.name, r.majors];
      targetList.push({ list: "chinese-route", label: name, institution: instByName.get(String(name).toLowerCase()) ?? undefined, category: mapCategory(cat), reasons: majors ?? undefined });
    }
  }
  for (const u of files.universities ?? []) {
    targetList.push({ list: "main", label: u.name, institution: u.slug, category: mapCategory(u.category_budget_B) });
  }

  const sp = files.studyPlan ?? {};
  const p = files.profile ?? {};
  const fx = Number(model.fx_cny_per_usd ?? 0);
  const fin = p.finances ?? {};

  return {
    schemaVersion: 1, ...meta,
    profile: files.profile ? {
      displayName: p.name, nationality: p.nationality, timezone: p.timezone, school: p.school,
      academics: { selfRating: p.self_rating, english: p.english, testsPlanned: p.tests_planned, currentStudies: p.current_studies },
      interests: p.majors_interest, preferences: p.preferences, careerGoal: p.career_goal, activities: p.cv_highlights,
      extra: { weaknesses: p.weaknesses, documents: p.documents, finances: p.finances },
    } : undefined,
    budgets: params.finance.scenarios.map((s) => ({
      key: s.key, label: `Escenario ${s.key}`, currency: "CNY", amountPerYear: s.amountPerYear, weight: s.points, isCentral: s.key === params.categories.centralScenario,
      incomes: s.key === "A" && fin.parents_usd_month ? [{ source: "family", currency: "USD", month: fin.parents_usd_month }] : undefined,
    })),
    fx: fx ? [{ base: "USD", quote: "CNY", rate: fx }] : [],
    institutions, programs, scholarships, exams, events, targetList,
    requirementTemplates: files.checklist ? [{ slug: "default-application", name: "Checklist de solicitud", items: files.checklist.map((label, i) => ({ key: `step-${i + 1}`, label })) }] : [],
    studyGoals: (sp.goals ?? []).map((g: Json) => ({
      key: slugify(g.subject), subject: g.subject, target: g.target, deadline: /^\d{4}-\d{2}-\d{2}$/.test(g.deadline ?? "") ? g.deadline : undefined,
      deadlineText: g.deadline ?? undefined, notes: g.then ?? undefined,
    })),
    studyPlans: sp.weekly_template_hours ? [{
      name: "Plan semanal", weeklyHours: Object.fromEntries(Object.entries(sp.weekly_template_hours).filter(([, v]) => typeof v === "number")) as Record<string, number>,
      notes: sp.notes,
    }] : [],
    scoringModel: { name: "Modelo de 100 puntos", version: 1, params: { ...params, legacy: { admissionProfile: model.admission_profile_model ?? null } } as unknown as Record<string, unknown> },
  };
}
