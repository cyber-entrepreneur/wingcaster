# Wave 2B — Publishing Control Plane & Content Calendar — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 + Wave 1 merged to `main`. Migration max **649**; your block **720–729** (mostly read-model/UI; migrations only for indexes/views).
- **You own no new canonical tables** — you read/reschedule Wave 0 `executions` across all kinds.

---

## HOUSE RULES

### WHO YOU ARE
Senior engineer on **WingCaster** — B2B real-estate marketing SaaS. Backend **Node ESM + PostgreSQL multi-tenant RLS**, vitest (Real-PG via `npm run test:pg:docker`). Frontend **React+Vite+TS**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. the existing code named below.

### BUILD ON WAVE 0 + WAVE 1 (both on `main`) — exact contract, do not re-invent
- **Wave 0 access layer `backend/src/lib/growth-os/`** (channels/executions/events/consent/with-tenant/index) — use exports; no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write. RLS strict (mig 551): `TO growth_os_app_role`, GUC set-and-matching; outside `withTenant` the app role sees zero rows; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern EXACTLY** (mig 551 + 543); reading an existing un-RLS'd table must be SQL-scoped by agency_id/agent_id (throw if scope missing) — never `findAll` unbounded (Wave 1D fix).
- **Wave 1 on `main`:** `backend/src/domain/{journeys,creative,audiences}`, `backend/src/lib/social-publishing`; tables journeys/creatives*/audiences*; web `components/audiences/*`, `components/creative/AiAdaptiveComposer`.
- **Events** via `ingestEvent` (idempotent, v2 vocab, under `withTenant` → resolve tenant first). Cumulative metrics → `metric_observations`.
- **Migration max on `main` is 649.**

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. No stubs/`TODO`/`throw 'not implemented'`/placeholders/mock-in-real-path; all implemented + tested.
2. Expand-contract only; no destructive schema; cutover explicit + testful.
3. Idempotent migrations; run twice cleanly.
4. Shared enum/CHECK additions in their OWN first-landing migration.
5. RLS mandatory + STRICT on new tenant tables (copy mig 551), via `withTenant`.
6. Never weaken a gate/permission/test to go green; diagnose `403` (wrong-table gate vs missing seed).
7. `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money `BIGINT` micros + `currency`; ids `TEXT` uuid+prefix; `TIMESTAMPTZ`; `data JSONB` for non-predicate attrs only.
8. FE: `--lc-*` tokens only; match patterns; WCAG AA + responsive.
9. Tests part of "done": unit + Real-PG; FE component tests.
10. Verify like CI, report truthfully; green ≠ correct.

### REPO CONVENTIONS
ESM; `Object.assign(new Error(msg), { code })`; logger. Migrations `NNN_*.sql` (max 649; your block). Register tables in `table-mapper.js`. API client `web/src/api/client.ts`; routes `backend/src/server.js`.

### VERIFICATION (paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Narrow to new `*.postgres.test.js` to dodge the Windows vitest over-parallelisation flake.

### DELIVERABLE / PR FORMAT
Branch off `main`; small landable PRs (enum-first → schema → logic → UI), each green, targeting `main`; PR body with pasted CI output; link the object model. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: PUBLISHING CONTROL PLANE & CONTENT CALENDAR

### MISSION
Give agencies the operational **control room**: a unified calendar + list over **all Executions** (journeys, social, portals, later paid), with drafts, previews, network validation, and drag-to-reschedule. For agencies running hundreds of listings this is the primary daily surface. Read `docs/campaign-and-social-publishing-reconciliation.md` Part 6.2 (D17) + `docs/canonical-object-model.md` §D.

### SCOPE — BACKEND
1. **Read model over `executions`**: a calendar/list API filtered by **date-range × property × campaign × agent × channel × office × status × kind**, all via `executions.js` under `withTenant`. Add covering indexes (block 720–729) for the hot paths (e.g. `(agency_id, scheduled_at)`, `(status, scheduled_at)`); additive only.
2. **Reschedule** = update `Execution.scheduled_at` via `scheduleExecution`. Respect status (can't reschedule a `published`/`processing` one).
3. **Draft & preview**: draft Executions (`status='draft'`) render a per-channel preview (reuse 1C renditions / 1B post preview); no side effects.
4. **Network validation** before publish: per-channel rule checks (IG needs media, caption length, missing connection, expired token, missing creative) surfaced as blockers/warnings — reuse channel `capabilities` (Wave 0) + 1B validation.

### SCOPE — FRONTEND
1. **Calendar** (day/week/month) + **list** views of Executions, with the full filter set + **drag-to-reschedule** (optimistic → `scheduleExecution`). Virtualize for ≥500 items.
2. Status chips per Execution, quick preview, and a blockers/warnings panel.
3. Safe bulk actions (reschedule/cancel drafts) with confirm on anything destructive.

### OUT OF SCOPE
Creating Executions (the composers in 1A/1B/1C/2A). Attribution numbers (2C). Paid-specific affordances beyond showing paid Executions.

### ACCEPTANCE CRITERIA
- [ ] Calendar + list render Executions across all kinds with the full filter set; performant at ≥500 items.
- [ ] Drag-to-reschedule updates `scheduled_at` via the canonical layer under `withTenant`; disallowed for non-reschedulable statuses.
- [ ] Draft preview + pre-publish network validation work per channel.
- [ ] All reads/writes tenant-isolated (via `withTenant`).

### TEST MATRIX
1. Filter query correctness (each dimension + combinations).
2. Reschedule updates the Execution; blocked on published/processing.
3. Network validation flags missing media/expired connection.
4. Tenant isolation: agency A's calendar excludes agency B's Executions.
5. FE: drag-reschedule optimistic update + rollback on failure.
