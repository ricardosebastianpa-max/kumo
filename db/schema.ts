/**
 * Kumo database schema (Drizzle, Postgres).
 * Rules: every workspace-owned table has workspace_id, created_by, timestamps and soft delete.
 * Catalog rows with workspace_id = null are public (platform packs) and copyable.
 * Dates are stored in UTC (timestamptz) together with the original IANA time zone.
 */

import {
  boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};
const owned = {
  createdBy: text("created_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...ts,
};

/* ── Better Auth core tables ─────────────────────────────────────────── */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  locale: text("locale").notNull().default("es"),
  timezone: text("timezone"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  ...ts,
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  ...ts,
});
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...ts,
});
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...ts,
});

/* ── Identity & access ───────────────────────────────────────────────── */
export const roleEnum = pgEnum("role", ["owner", "guardian", "mentor", "recommender"]);
export const confidenceEnum = pgEnum("confidence", ["confirmed", "estimated", "unverified"]);
export const priorityEnum = pgEnum("priority", ["critical", "high", "medium", "low"]);

export const workspace = pgTable("workspace", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("UTC"),
  locale: text("locale").notNull().default("es"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  icsToken: text("ics_token").notNull().$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),
  ...owned,
});

/** permissions: { [module]: ("view"|"comment"|"edit"|"approve")[] } — overrides the role defaults. */
export const membership = pgTable("membership", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  permissions: jsonb("permissions").$type<Record<string, string[]>>(),
  ...ts,
}, (t) => [uniqueIndex("membership_ws_user").on(t.workspaceId, t.userId)]);

export const invitation = pgTable("invitation", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  permissions: jsonb("permissions").$type<Record<string, string[]>>(),
  token: text("token").notNull().unique().$defaultFn(() => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")),
  invitedBy: text("invited_by").notNull(),
  message: text("message"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...ts,
});

/** Per-item privacy: hides an item from given roles even if the module is visible. */
export const privacyFlag = pgTable("privacy_flag", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  hiddenFrom: jsonb("hidden_from").$type<string[]>().notNull().default(["guardian", "mentor"]),
  ...ts,
}, (t) => [uniqueIndex("privacy_res").on(t.resourceType, t.resourceId)]);

export const activityLog = pgTable("activity_log", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  actorId: text("actor_id"),
  action: text("action").notNull(), // create | update | delete | restore | import | access
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  diff: jsonb("diff").$type<Record<string, { from: unknown; to: unknown }>>(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("activity_ws_time").on(t.workspaceId, t.createdAt)]);

/* ── Provenance ──────────────────────────────────────────────────────── */
export const source = pgTable("source", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  url: text("url"),
  title: text("title").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: text("verified_by"),
  ...owned,
});
/** Links a source to any field of any row: (resource_type, resource_id, field). field "*" = whole row. */
export const fieldSource = pgTable("field_source", {
  id: id(),
  sourceId: text("source_id").notNull().references(() => source.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  field: text("field").notNull().default("*"),
  confidence: confidenceEnum("confidence").notNull().default("unverified"),
}, (t) => [index("field_source_res").on(t.resourceType, t.resourceId)]);

export const tag = pgTable("tag", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  label: text("label").notNull(),
  color: text("color"),
  ...owned,
}, (t) => [uniqueIndex("tag_ws_slug").on(t.workspaceId, t.slug)]);

/* ── Seed packs ──────────────────────────────────────────────────────── */
export const seedPack = pgTable("seed_pack", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  version: text("version").notNull(),
  title: text("title").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  summary: jsonb("summary").$type<Record<string, number>>(),
  importedBy: text("imported_by"),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Profile ─────────────────────────────────────────────────────────── */
export const studentProfile = pgTable("student_profile", {
  id: id(),
  workspaceId: text("workspace_id").notNull().unique().references(() => workspace.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  nationality: text("nationality"),
  country: text("country"),
  timezone: text("timezone"),
  school: jsonb("school").$type<Record<string, unknown>>(),
  academics: jsonb("academics").$type<Record<string, unknown>>(),
  interests: jsonb("interests").$type<unknown[]>(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>(),
  careerGoal: text("career_goal"),
  activities: jsonb("activities").$type<unknown[]>(),
  extra: jsonb("extra").$type<Record<string, unknown>>(),
  ...owned,
});

/* ── Catalogs ────────────────────────────────────────────────────────── */
export const institution = pgTable("institution", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  names: jsonb("names").$type<Record<string, string>>(), // { es, zh, ... }
  kind: text("kind"), // public | private | sino_foreign ...
  country: text("country"),
  city: text("city"),
  region: text("region"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  tiers: jsonb("tiers").$type<string[]>().notNull().default([]),
  rankings: jsonb("rankings").$type<{ source: string; year?: number; rank?: number; label?: string }[]>().notNull().default([]),
  climate: jsonb("climate").$type<Record<string, unknown>>(),
  costOfLiving: jsonb("cost_of_living").$type<{ currency: string; month: number }>(),
  admission: jsonb("admission").$type<Record<string, unknown>>(),
  finance: jsonb("finance").$type<Record<string, unknown>>(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  confidence: confidenceEnum("confidence").notNull().default("unverified"),
  ...owned,
}, (t) => [uniqueIndex("institution_ws_slug").on(t.workspaceId, t.slug)]);

export const program = pgTable("program", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").notNull().references(() => institution.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  field: text("field"), // cs | business | other
  language: text("language"),
  level: text("level").notNull().default("bachelor"),
  durationYears: integer("duration_years"),
  tuition: jsonb("tuition").$type<{ currency: string; year: number }>(),
  requirements: jsonb("requirements").$type<Record<string, unknown>>(),
  confidence: confidenceEnum("confidence").notNull().default("unverified"),
  ...owned,
}, (t) => [uniqueIndex("program_ws_slug").on(t.workspaceId, t.slug)]);

export const scholarship = pgTable("scholarship", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").references(() => institution.id, { onDelete: "set null" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  scope: text("scope"), // institutional | government | private | local_government
  country: text("country"),
  region: text("region"),
  coverage: jsonb("coverage").$type<Record<string, unknown>>(),
  eligibility: jsonb("eligibility").$type<Record<string, unknown>>(),
  howToApply: text("how_to_apply"),
  deadlineText: text("deadline_text"),
  notes: text("notes"),
  confidence: confidenceEnum("confidence").notNull().default("unverified"),
  ...owned,
}, (t) => [uniqueIndex("scholarship_ws_slug").on(t.workspaceId, t.slug)]);

export const exam = pgTable("exam", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  sections: jsonb("sections").$type<{ key: string; label: string; scale?: string }[]>(),
  ...owned,
}, (t) => [uniqueIndex("exam_ws_slug").on(t.workspaceId, t.slug)]);

export const examSession = pgTable("exam_session", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  examId: text("exam_id").notNull().references(() => exam.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  startsOn: text("starts_on"), // ISO date
  endsOn: text("ends_on"),
  registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
  registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
  timezone: text("timezone"),
  location: text("location"),
  cost: jsonb("cost").$type<{ currency: string; amount: number }>(),
  status: text("status"),
  confidence: confidenceEnum("confidence").notNull().default("unverified"),
  ...owned,
}, (t) => [uniqueIndex("exam_session_ws_slug").on(t.workspaceId, t.slug)]);

export const requirementTemplate = pgTable("requirement_template", {
  id: id(),
  workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  appliesTo: text("applies_to").notNull().default("application"),
  items: jsonb("items").$type<{ key: string; label: string; dependsOn?: string[] }[]>().notNull(),
  ...owned,
}, (t) => [uniqueIndex("req_tpl_ws_slug").on(t.workspaceId, t.slug)]);

/* ── Process ─────────────────────────────────────────────────────────── */
export const targetListItem = pgTable("target_list_item", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").references(() => institution.id, { onDelete: "cascade" }),
  programId: text("program_id").references(() => program.id, { onDelete: "cascade" }),
  scholarshipId: text("scholarship_id").references(() => scholarship.id, { onDelete: "cascade" }),
  label: text("label"), // free text for items not in the catalog yet
  list: text("list").notNull().default("main"), // e.g. "main", "chinese-route"
  status: text("status").notNull().default("researching"),
  category: text("category"), // Safety | Target | Reach | Dream | custom
  priority: integer("priority"),
  reasons: text("reasons"),
  ...owned,
});

export const event = pgTable("event", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // deadline | exam | registration | window | class | work | study_block | interview | personal | milestone | task
  title: text("title").notNull(),
  notes: text("notes"),
  allDay: boolean("all_day").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timezone: text("timezone").notNull(), // original zone of the event (e.g. Asia/Shanghai)
  rrule: text("rrule"),
  confidence: confidenceEnum("confidence").notNull().default("unverified"),
  priority: priorityEnum("priority").notNull().default("medium"),
  institutionId: text("institution_id").references(() => institution.id, { onDelete: "set null" }),
  scholarshipId: text("scholarship_id").references(() => scholarship.id, { onDelete: "set null" }),
  examSessionId: text("exam_session_id").references(() => examSession.id, { onDelete: "set null" }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  reminders: jsonb("reminders").$type<number[]>(), // days before; null = policy by priority
  externalKey: text("external_key"), // idempotency for imports
  ...owned,
}, (t) => [index("event_ws_start").on(t.workspaceId, t.startsAt), uniqueIndex("event_ws_extkey").on(t.workspaceId, t.externalKey)]);

export const task = pgTable("task", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  title: text("title").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("todo"), // todo | doing | done
  dueAt: timestamp("due_at", { withTimezone: true }),
  timezone: text("timezone"),
  estimateMin: integer("estimate_min"),
  energy: text("energy"), // low | medium | high
  context: text("context"), // phone | pc | any
  priority: priorityEnum("priority").notNull().default("medium"),
  blockedBy: jsonb("blocked_by").$type<string[]>().notNull().default([]),
  rrule: text("rrule"),
  eventId: text("event_id").references(() => event.id, { onDelete: "set null" }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  externalKey: text("external_key"),
  ...owned,
}, (t) => [uniqueIndex("task_ws_extkey").on(t.workspaceId, t.externalKey)]);

/* ── Study ───────────────────────────────────────────────────────────── */
export const studyGoal = pgTable("study_goal", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  target: text("target"),
  deadlineText: text("deadline_text"),
  deadline: text("deadline"), // ISO date when parseable
  notes: text("notes"),
  externalKey: text("external_key"),
  ...owned,
}, (t) => [uniqueIndex("goal_ws_extkey").on(t.workspaceId, t.externalKey)]);

export const studyPlan = pgTable("study_plan", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  weeklyHours: jsonb("weekly_hours").$type<Record<string, number>>().notNull(),
  constraints: jsonb("constraints").$type<Record<string, unknown>>(),
  notes: jsonb("notes").$type<unknown>(),
  ...owned,
});

/* ── Money ───────────────────────────────────────────────────────────── */
export const budgetScenario = pgTable("budget_scenario", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  key: text("key").notNull(), // A | B | C ...
  label: text("label").notNull(),
  currency: text("currency").notNull(),
  amountPerYear: doublePrecision("amount_per_year").notNull(),
  weight: doublePrecision("weight"),
  isCentral: boolean("is_central").notNull().default(false),
  incomes: jsonb("incomes").$type<{ source: string; currency: string; month: number }[]>(),
  ...owned,
}, (t) => [uniqueIndex("budget_ws_key").on(t.workspaceId, t.key)]);

export const fxRate = pgTable("fx_rate", {
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  base: text("base").notNull(),
  quote: text("quote").notNull(),
  rate: doublePrecision("rate").notNull(), // 1 base = rate quote
  ...ts,
}, (t) => [primaryKey({ columns: [t.workspaceId, t.base, t.quote] })]);

/* ── Decision model ──────────────────────────────────────────────────── */
export const scoringModel = pgTable("scoring_model", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  params: jsonb("params").$type<Record<string, unknown>>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...owned,
}, (t) => [uniqueIndex("model_ws_version").on(t.workspaceId, t.version)]);

export const scoreSnapshot = pgTable("score_snapshot", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => scoringModel.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").notNull().references(() => institution.id, { onDelete: "cascade" }),
  total: doublePrecision("total").notNull(),
  breakdown: jsonb("breakdown").$type<Record<string, unknown>>().notNull(),
  category: text("category"),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("snapshot_model_inst").on(t.modelId, t.institutionId)]);

