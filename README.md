# Kumo ☁️

Your step-by-step ally, all the way to university. A calm copilot for students applying to universities and scholarships, and for the family that supports them.

## Status
**Phase 0, foundations: done.** Covers auth (email + password), workspaces and roles with central `can()`, full schema and migrations, an idempotent seed-pack importer with preview, guardian invitations, a design system at `/design`, CI, and es/en i18n.
Next up: **Phase 1** (Today, Calendar, Catalogs, quick capture, ICS).

## Run locally
```bash
cp .env.example .env.local        # set DATABASE_URL to a local Postgres
npm install
npm run db:migrate
npm run dev                       # http://localhost:3000
```
Sign-in is email + password. Invitations are links you copy or send by WhatsApp. Email (Resend) is optional; set `RESEND_API_KEY` to also enable magic links and invitation emails.

## Test
```bash
npm run typecheck && npm run lint
npm test                          # unit + integration (needs Postgres: DATABASE_URL or kumo_test)
npm run build && npm run e2e      # Playwright, Phase 0 acceptance flow
```
Tests that use real student data read `private/data` (git-ignored) and are skipped without it. CI uses the fictional `seed/demo-pack.json`.

## Layout
| Path | What |
|---|---|
| `app/` | Routes, server actions (`app/actions.ts`) |
| `components/` | UI primitives (`ui.tsx`), Kumo crane (`kumo.tsx`) |
| `lib/domain/` | Pure, tested business logic: `permissions`, `scoring`, `time` |
| `lib/seed/` | SeedPack v1 schema, importer, adapters |
| `db/` | Drizzle schema + migrations |
| `messages/` | i18n (es default, en) |
| `docs/` | `DECISIONS.md` (ADRs), `JOURNEY_MAP.md`, `flows/` |

## Data and privacy
Personal data (`private/`, research PDFs) is never committed. Real data enters production only through **Importar datos** in the app.
