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

## ADR-013 Email is optional: password sign-in + shareable invite links (owner decision, supersedes part of ADR-004)
The owner chose not to set up an email provider. Sign-in is email + password (Better Auth, min 8 chars, rate-limited). Invitations produce a link the student copies or sends via WhatsApp; the invitee creates an account on that link and must use the invited email. If `RESEND_API_KEY` is ever set, magic links and invitation emails turn on automatically with no code change. Password reset needs email, so until then a forgotten password is reset by the owner from the database (documented in README); revisit with Google sign-in in Phase 1.

## ADR-014 Calendar and tables are built in-house (not FullCalendar / TanStack)
**Context.** Spec suggests FullCalendar and TanStack Table; the JS budget is < 170 KB first load. **Decision.** Month / week / agenda / year views and the catalog lists are small purpose-built components (native HTML5 drag & drop, keyboard alternative via the event sheet). **Consequences.** /app/calendar ships at ~128 KB first load. Resize-to-extend and time-grid dragging are not built; revisit with Schedule-X if study blocks (Phase 3) need them.

## ADR-015 Imported tasks stay events; completion lives on `event.completed_at`
The seed models personal tasks as dated events. Rather than duplicating them into `task`, events of kind `task`/`milestone` can be completed (optimistic UI + undo, audited). The `task` table remains for Phase 2–3 checklists with dependencies.

## ADR-016 Natural-language capture is deterministic and local
`lib/domain/nl-date.ts` parses Spanish and English dates, times, relative phrases and zone hints ("hora de Pekín") with no network or AI. The preview always shows what was understood and every field is editable before saving.

## ADR-017 Today ranking
Urgency = priority weight (8/4/2/1) ÷ (1 + days/3); overdue open items count double. One main item, two secondary. Calm alerts: estimated dates due within 21 days (verify at source), tasks left over from the last 14 days, and 3+ high/critical items inside any 3-day window.

## ADR-018 ICS feed by secret token
`/api/ics/{token}.ics` per workspace, rotatable by the owner. All-day items use `VALUE=DATE` in their own zone; estimated dates are `STATUS:TENTATIVE` with a prefix. Google Calendar polls subscribed feeds on its own schedule (typically hours).

## ADR-019 Shortlist lives on `target_list_item` (stages + reflection)
Stages: exploring → shortlist ("Me interesa") → pursuing ("Voy por ella") or discarded. Gut feeling (1–5 clouds), pros, cons and notes live on the same row and are audited. Seed re-imports merge by institution/label and never overwrite the student's stage or reflection.

## ADR-020 Photos stored in Postgres after client-side compression
No extra storage service: images are resized in the browser (≤1600 px, WebP, ≤ 440 KB) and stored as `bytea` in `media`, served by `/api/media/{id}` only to members who can view the catalog (`Cache-Control: private, immutable`). One cover per item. Move to object storage if a workspace passes ~200 MB.

## ADR-021 Generated covers
Without a photo, each option gets a deterministic folded-paper composition (seeded by slug, tinted by category) so the board is visual from day one and never shows a grey placeholder.

## ADR-022 Timeline view
Calendar "Línea": one row per institution/scholarship with dated items, 8 months across; window→deadline bars, diamonds for deadlines/registrations, circles for tasks/exams, dashed when estimated. Defaults to the shortlist ("Solo mi lista").

## ADR-023 Study library from CSV sheets
The "Ruta 0–100", "Profundizar" and "Canales y cursos" sheets import through the normal importer (CSV recognised by header row). They carry titles but no URLs, so each resource gets a search link (YouTube for videos/channels, web search for books and sites) flagged `urlIsSearch`; the student can paste the exact link once found. Re-imports refresh content but never the student's ✓, notes or saved link. The next unfinished route step appears on Today.

## ADR-024 Phases 2–6 in one pass (owner request: useful first, lighter testing)
- Applications are created automatically when an option becomes "Voy por ella", with the workspace's requirement template as checklist (dependencies lock steps). Portal username only, never passwords.
- Documents track status/expiry; guardians see status but not notes. Recommenders get a token link (`/r/{token}`) to report progress, no account.
- Family view (`/app/family`) is the guardian landing: traffic light, deadlines, applications, weekly study hours vs plan, expense approvals, message thread.
- Weekly planner (`lib/domain/scheduler.ts`) is deterministic: 50+10 min blocks between 7:00–22:00, never overlapping timed events, max 4/day; re-planning replaces only future auto blocks.
- Scoring model editor saves a new version (old ones kept, `is_active` flag); live preview runs the same pure scoring in the browser.
- AI copilot and essay coach call the Anthropic Messages API only when `ANTHROPIC_API_KEY` is set (`KUMO_AI_MODEL` optional). Read-only: answers from a JSON snapshot of the workspace; the coach never rewrites.
- Deferred: spaced-repetition flashcards, the visual "Camino", offline PWA cache, push notifications, Google sign-in.
