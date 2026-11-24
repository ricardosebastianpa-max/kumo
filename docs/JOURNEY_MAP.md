# Journey map

Rule: no moment without a screen, a data model, an action, a reminder and a guardian view. A gap is a bug. Status: ✅ built · 🟡 partial · ⬜ planned (phase).

| # | Moment | Screen | Data | Action | Reminder | Guardian view | Status |
|---|---|---|---|---|---|---|---|
| 1 | Discover options | Explore (catalog) | institution, program, scholarship | save to list | – | read-only list | ⬜ P1 |
| 2 | Understand requirements | Institution sheet | program.requirements, source | mark met / missing | verify estimated | read | ⬜ P1 |
| 3 | Balanced list | List builder | target_list_item, score_snapshot | set category | imbalance alert | read + comment | 🟡 data imported · UI P4 |
| 4 | Real budget | Finance | budget_scenario, fx_rate | edit scenarios | – | read + approve | 🟡 data imported · UI P4 |
| 5 | Register for exams | Today / Calendar | exam_session (reg. window) | "I registered" | 7/3/1 days before close | sees deadline | 🟡 data + Home "next up" · P1 |
| 6 | Study | Study | study_goal, study_plan | focus timer | daily block | weekly hours | ⬜ P3 |
| 7 | Sit the exam | Today (calm routine) | event kind=exam | checklist | day before + same day | sees date | ⬜ P1/P6 |
| 8 | Receive score, recalculate | Study → Decision | practice_test, triggers | enter score | – | sees result | ⬜ P4 |
| 9 | Ask for letters | People | recommender, recommendation_request | magic link to teacher | polite nudges | status | ⬜ P2 |
| 10 | Write essays | Writing | essay, essay_version | coach review | draft due | hidden by default | ⬜ P5 |
| 11 | Gather & legalise docs | Documents | document (chain) | upload, mark state | expiry (passport 6 mo) | status only | ⬜ P2 |
| 12 | Pay fees (approval) | Applications | expense | request approval | – | approve from phone | ⬜ P2 |
| 13 | Submit | Applications | application | log submission + proof | deadline policy | sees "sent" | ⬜ P2 |
| 14 | Confirm receipt | Applications | application.status | mark received | 7 days after submit | sees status | ⬜ P2 |
| 15 | Interview | Applications | interview | practice | day before | sees date | ⬜ P2/P5 |
| 16 | Wait for results | Today (calm) | application | – | expected date | sees status | ⬜ P2 |
| 17 | Compare offers | Decision | decision, score_snapshot | weigh | – | comment + vote | ⬜ P6 |
| 18 | Decide | Decision | decision | record rationale | accept-by date | sees decision | ⬜ P6 |
| 19 | Accept & deposit | Applications | expense | approval | deposit due | approve | ⬜ P6 |
| 20 | Visa | Pre-departure | task template | checklist | per step | sees progress | ⬜ P6 |
| 21 | Health & insurance | Pre-departure | task template | checklist | – | sees progress | ⬜ P6 |
| 22 | Flight & housing | Pre-departure | task template | checklist | – | sees progress | ⬜ P6 |
| 23 | Arrival | Pre-departure | event | countdown | – | sees countdown | ⬜ P6 |
| 24 | First 30 days | Pre-departure | task template | checklist | – | – | ⬜ P6 |

Phase 0 covers the foundation every row depends on: identity, roles and `can()`, workspace, audit log, provenance (source / confidence), the seed importer, and the guardian invitation.
