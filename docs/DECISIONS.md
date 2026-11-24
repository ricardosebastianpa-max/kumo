# Decisions (ADR, short form)

Each entry: context → decision → consequences. Newest last.

## ADR-001 Stack baseline
**Context.** Spec §2. **Decision.** Next.js 15 (App Router, Server Actions), TypeScript strict, Postgres + Drizzle, Tailwind v4, next-intl, Better Auth, Resend, Vitest, Playwright. **Consequences.** One repo, one deploy target (Vercel).

## ADR-002 Database: Neon via Vercel Marketplace (owner decision)
Postgres on Neon, provisioned from Vercel so `DATABASE_URL` is injected per environment. Driver: `postgres` (postgres.js) with `prepare: false` so the pooled Neon URL works in serverless. Local dev and tests use a local Postgres 16 (`kumo` / `kumo_test`).

## ADR-003 Hosting: Vercel on *.vercel.app (owner decision)
Custom domain later; no code depends on the host. Base URL comes from `BETTER_AUTH_URL` or `VERCEL_PROJECT_PRODUCTION_URL`.

## ADR-004 Auth: Better Auth, magic link first (owner decision)
Magic link (15 min, single use) via Resend. Google OAuth and passkeys are added in Phase 1 once the Google client exists; passkeys need an extra table, so they ship together. Without `RESEND_API_KEY`, dev/test write emails to an in-memory outbox shown at `/dev/outbox` (404 in production unless `KUMO_ALLOW_OUTBOX=1`, used only by e2e).

## ADR-005 Authorization: one pure `can(actor, action, resource)`
`lib/domain/permissions.ts`. Role defaults per module + per-membership overrides + per-item `privacy_flag`. Journal and wellbeing are always owner-only; `manage` is always owner-only. Server actions call `assertCan` before any read/write. Unit-tested matrix.

## ADR-006 Catalog scope: workspace-owned rows, public rows = `workspace_id NULL`
Seed packs import into the student's workspace (editable, private). Public platform catalogs use `workspace_id = null` and only platform admins edit them; workspaces copy what they need. Uniqueness is `(workspace_id, slug)`.

## ADR-007 Seed packs: canonical Zod format + adapters
`lib/seed/schema.ts` defines SeedPack v1 (country-agnostic). Legacy research folders are translated by adapters (`lib/seed/adapters/centro-v0.ts`); the app never reads legacy files. Import is idempotent (upsert by slug/externalKey), transactional, and has a dry-run preview (transaction rolled back). Unknown event relations become tags.

## ADR-008 Scoring inputs: tables + explicit manual overrides
The research assigned some prestige points by judgment (sino-foreign campuses, "≈top 40 via NYU"). Instead of guessing from text, the adapter stores `tierPointsOverride` / `rankPointsOverride` on the institution when the table lookup disagrees; the UI will show them as "manual assessment" and let the student edit them. Affordability uses a tolerance (5% in the v1 model) and unknown tuition is backed out from the research's gross-cost estimate and flagged `tuitionEstimated`. Regression: all 65 institutions match the research totals within ±1; top 4 = HIT, Beihang, Northeastern, BIT.

## ADR-009 Time: UTC + original IANA zone on every dated row
Events store `starts_at timestamptz` plus `timezone`. All-day items are midnight in their own zone. "15:00 Pekín" → Asia/Shanghai. Display in the user's zone, original zone on hover/secondary line. Helpers in `lib/domain/time.ts` use only `Intl`.

## ADR-010 i18n without URL prefixes
Locale from cookie → Accept-Language → `es`. Messages in `messages/{es,en}.json`; no literal UI strings in components (design page excepted, it is an internal tool).

## ADR-011 Self-hosted fonts
Geist (npm `geist`) and Fraunces (Fontsource woff2 via `next/font/local`), `display: swap`. No runtime calls to Google Fonts.

## ADR-012 Private data never in git
`private/` is git-ignored. Real data reaches production only through the in-app importer. Tests that need it skip when it is absent; a fictional demo pack (`seed/demo-pack.json`) covers CI.
