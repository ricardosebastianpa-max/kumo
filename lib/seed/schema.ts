/**
 * Canonical seed pack format (schemaVersion 1). Packs are country-agnostic JSON validated with Zod.
 * Importing is idempotent: every entity upserts by its slug (or externalKey) inside the workspace.
 */
import { z } from "zod";

export const Confidence = z.enum(["confirmed", "estimated", "unverified"]);
export const Priority = z.enum(["critical", "high", "medium", "low"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slug = z.string().min(1).max(120);
const SourceRef = z.object({ url: z.string().nullable().optional(), title: z.string() }).nullable().optional();

export const PackInstitution = z.object({
  slug, name: z.string(), names: z.record(z.string()).optional(),
  kind: z.string().optional(), country: z.string().optional(), city: z.string().optional(), region: z.string().optional(),
  lat: z.number().nullable().optional(), lon: z.number().nullable().optional(),
  tiers: z.array(z.string()).default([]),
  rankings: z.array(z.object({ source: z.string(), year: z.number().optional(), rank: z.number().optional(), label: z.string().optional() })).default([]),
  climate: z.record(z.unknown()).optional(),
  costOfLiving: z.object({ currency: z.string(), month: z.number() }).optional(),
  admission: z.record(z.unknown()).optional(),
  finance: z.record(z.unknown()).optional(),
  details: z.record(z.unknown()).optional(),
  confidence: Confidence.default("unverified"),
  source: SourceRef,
});
export const PackProgram = z.object({
  slug, institution: slug, name: z.string(), field: z.string().optional(), language: z.string().optional(),
  level: z.string().default("bachelor"), durationYears: z.number().optional(),
  tuition: z.object({ currency: z.string(), year: z.number() }).optional(),
  requirements: z.record(z.unknown()).optional(), confidence: Confidence.default("unverified"),
});
export const PackScholarship = z.object({
  slug, name: z.string(), institution: slug.optional(), issuer: z.string().optional(), scope: z.string().optional(),
  country: z.string().optional(), region: z.string().optional(),
  coverage: z.record(z.unknown()).optional(), eligibility: z.record(z.unknown()).optional(),
  howToApply: z.string().optional(), deadlineText: z.string().optional(), notes: z.string().optional(),
  confidence: Confidence.default("unverified"), source: SourceRef,
});
export const PackExam = z.object({
  slug, name: z.string(), sections: z.array(z.object({ key: z.string(), label: z.string(), scale: z.string().optional() })).optional(),
  sessions: z.array(z.object({
    slug, startsOn: isoDate.optional(), endsOn: isoDate.optional(),
    registrationOpens: z.object({ date: isoDate, time: z.string().nullable() }).optional(),
    registrationCloses: z.object({ date: isoDate, time: z.string().nullable() }).optional(),
    timezone: z.string().optional(), location: z.string().optional(), status: z.string().optional(),
    confidence: Confidence.default("unverified"),
  })).default([]),
});
export const PackEvent = z.object({
  key: z.string(), kind: z.string(), title: z.string(), notes: z.string().optional(),
  date: isoDate, endDate: isoDate.nullable().optional(), time: z.string().nullable().optional(), timezone: z.string(),
  confidence: Confidence.default("unverified"), priority: Priority.default("medium"),
  related: z.string().nullable().optional(), // institution slug | scholarship slug | exam slug | free tag
  source: SourceRef,
});
export const PackPack = z.object({
  schemaVersion: z.literal(1),
  slug, version: z.string(), title: z.string(),
  profile: z.object({
    displayName: z.string(), nationality: z.string().optional(), country: z.string().optional(), timezone: z.string().optional(),
    school: z.record(z.unknown()).optional(), academics: z.record(z.unknown()).optional(),
    interests: z.array(z.unknown()).optional(), preferences: z.record(z.unknown()).optional(),
    careerGoal: z.string().optional(), activities: z.array(z.unknown()).optional(), extra: z.record(z.unknown()).optional(),
  }).optional(),
  budgets: z.array(z.object({
    key: z.string(), label: z.string(), currency: z.string(), amountPerYear: z.number(), weight: z.number().optional(),
    isCentral: z.boolean().optional(), incomes: z.array(z.object({ source: z.string(), currency: z.string(), month: z.number() })).optional(),
  })).default([]),
  fx: z.array(z.object({ base: z.string(), quote: z.string(), rate: z.number() })).default([]),
  institutions: z.array(PackInstitution).default([]),
  programs: z.array(PackProgram).default([]),
  scholarships: z.array(PackScholarship).default([]),
  exams: z.array(PackExam).default([]),
  events: z.array(PackEvent).default([]),
  targetList: z.array(z.object({ list: z.string(), label: z.string(), institution: slug.optional(), category: z.string().optional(), reasons: z.string().optional() })).default([]),
  requirementTemplates: z.array(z.object({ slug, name: z.string(), items: z.array(z.object({ key: z.string(), label: z.string(), dependsOn: z.array(z.string()).optional() })) })).default([]),
  studyGoals: z.array(z.object({ key: z.string(), subject: z.string(), target: z.string().optional(), deadline: isoDate.optional(), deadlineText: z.string().optional(), notes: z.string().optional() })).default([]),
  studyPlans: z.array(z.object({ name: z.string(), weeklyHours: z.record(z.number()), notes: z.unknown().optional() })).default([]),
  scoringModel: z.object({ name: z.string(), version: z.number(), params: z.record(z.unknown()) }).optional(),
});
export type SeedPack = z.infer<typeof PackPack>;
