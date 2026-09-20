# Wave 2D — Experimentation (A/B/n + holdouts) — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 + Wave 1 merged to `main`; 2C helpful (results read Conversions). Migration max **649**; your block **750–769**.
- **You own:** `experiments`, `experiment_assignments`. Wire into 1C `creative_variants` (already carry nullable `experiment_id`) and 1A journey `experiment` node type.

---

## HOUSE RULES

### WHO YOU ARE
Senior engineer on **WingCaster** — B2B real-estate marketing SaaS. Backend **Node ESM + PostgreSQL multi-tenant RLS**, vitest (Real-PG via `npm run test:pg:docker`). Frontend **React+Vite+TS**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. the existing code named below.

### BUILD ON WAVE 0 + WAVE 1 (both on `main`) — exact contract, do not re-invent
- **Wave 0 access layer `backend/src/lib/growth-os/`** — use exports; no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY**; RLS strict (mig 551); outside it the app role sees zero rows; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern EXACTLY** (mig 551 + 543); un-RLS'd reads SQL-scoped by tenant (throw if missing) — never `findAll` unbounded.
- **Wave 1 on `main`:** `backend/src/domain/{journeys,creative,audiences}` (creative_variants carry `experiment_id?`; journey graph has an `experiment` node type), `backend/src/lib/social-publishing`.
- **Events** via `ingestEvent` (idempotent, v2 vocab, under `withTenant`). **Migration max on `main` is 649.**

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
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Narrow to new `*.postgres.test.js` for true pass/fail.

### DELIVERABLE / PR FORMAT
Branch off `main`; small landable PRs; each green; targeting `main`; PR body with pasted CI output; link the object model. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: EXPERIMENTATION (A/B/n + holdouts)

### MISSION
Let agents test what actually drives the funnel — creative, copy, CTA, channel, timing, journey path — with reproducible assignment and holdouts, measured against **funnel outcomes, not clicks**. Read `docs/canonical-object-model.md` §H (Experiment, ExperimentAssignment).

### SCOPE — BACKEND
1. **Migrations (750–769):** `experiments` (`id · campaign_id? · dimension(creative/copy/cta/channel/timing/journey_path) · variants JSONB · allocation(even/bandit) · holdout_pct · goal_event · status(draft/running/concluded) · result JSONB`) + `experiment_assignments` (`id · experiment_id · contact_id · variant · assigned_at · assignment_reason · model_version`). Strict RLS.
2. **Assignment engine:** deterministic (stable hash of contact×experiment) for `even`; pluggable interface for `bandit` (implement `even` fully; `bandit` behind a clear `NOT_CONFIGURED`, no fake). Honour `holdout_pct` (control receives nothing / the default). Record every assignment with reason + `model_version`.
3. **Wiring:** Executions (1B/2A), Creatives (1C `creative_variants.experiment_id`), and Journey `experiment` nodes (1A) resolve the assigned variant. Events carry `execution_id`, so results tie back through 2C Conversions.
4. **Results:** per-variant funnel outcomes (from Conversions, per `goal_event`) + significance (basic frequentist at launch; sequential/bandit later). Never claim significance you didn't compute.

### SCOPE — FRONTEND
1. Experiment builder: dimension → variants (reuse 1C creatives / 1A journey paths) → allocation + holdout + goal_event.
2. Results dashboard: per-variant funnel + lift vs control + confidence; "conclude" promotes a winner.

### OUT OF SCOPE
Multi-armed bandit optimisation (interface only). AI auto-experimentation (post-PMF). Attribution internals (consume 2C).

### ACCEPTANCE CRITERIA
- [ ] Even allocation deterministic + reproducible; holdout respected; every assignment recorded with reason + model_version.
- [ ] Bandit path returns a clear `NOT_CONFIGURED` (no stub result).
- [ ] Executions/creatives/journey nodes resolve the assigned variant; results tie to Conversions via execution_id.
- [ ] Significance genuinely computed; no fabricated confidence.
- [ ] Tenant-isolated via `withTenant`.

### TEST MATRIX
1. Deterministic assignment (same contact×experiment → same variant); holdout share correct.
2. Assignment recorded with reason/model_version; reproducible on re-run.
3. Variant resolution in an Execution/journey node.
4. Result computation from Conversion fixtures; significance math sane.
5. Tenant isolation on experiments/experiment_assignments.
