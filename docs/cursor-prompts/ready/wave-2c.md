# Wave 2C — Attribution & Commission Engine (the moat) — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 + Wave 1 merged to `main` (Wave 1 emits business/engagement Events per the taxonomy). Migration max **649**; your block **730–749**.
- **You own:** `conversions`, `attribution_credits`. Reads `events` (Wave 0) + finance ledger for commission.

---

## HOUSE RULES

### WHO YOU ARE
Senior engineer on **WingCaster** — B2B real-estate marketing SaaS. Backend **Node ESM + PostgreSQL multi-tenant RLS**, vitest (Real-PG via `npm run test:pg:docker`). Frontend **React+Vite+TS**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. the existing code named below.

### BUILD ON WAVE 0 + WAVE 1 (both on `main`) — exact contract, do not re-invent
- **Wave 0 access layer `backend/src/lib/growth-os/`** (channels/executions/events/consent/with-tenant/index) — use exports; no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write. RLS strict (mig 551); outside `withTenant` the app role sees zero rows; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern EXACTLY** (mig 551 + 543); reading an existing un-RLS'd table must be SQL-scoped by tenant (throw if missing) — never `findAll` unbounded (Wave 1D fix).
- **Wave 1 on `main`:** `backend/src/domain/{journeys,creative,audiences}`, `backend/src/lib/social-publishing`.
- **Events** via `ingestEvent` (idempotent, v2 vocab, under `withTenant`). Cumulative metrics live in `metric_observations` (read for reach/spend context — not Events).
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
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Narrow to new `*.postgres.test.js` for true pass/fail.

### DELIVERABLE / PR FORMAT
Branch off `main`; small landable PRs; each green; targeting `main`; PR body with pasted CI output; link the object model. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: ATTRIBUTION & COMMISSION ENGINE

### MISSION
Turn the Event spine into the differentiator: attribute the real-estate funnel — impression → click → lead → qualified → viewing → offer → transaction → **commission** — so the platform reports *which marketing produced property revenue*, not "Instagram engagement." Read `docs/canonical-object-model.md` §H, `docs/event-taxonomy-catalog.md` (§4A, §5, §5B), reconciliation Diagram 3.

### SCOPE — BACKEND
1. **Migrations (730–749):** `conversions` (attribution-neutral transition: `id · contact_id · from_stage · to_stage · occurred_at · value_micros · currency`, **no authoritative primary execution**) + `attribution_credits` (`id · conversion_id · execution_id(touchpoint) · model(last/first/linear/position/data_driven) · credit_weight`). Strict RLS.
2. **Conversion materialiser:** consume `events` (business/engagement) → `Conversion` per funnel transition (§5). Idempotent (a business Event → at most one Conversion).
3. **Attribution engine:** per Conversion, gather correlated touchpoint Events (`execution_id`, via `correlation_id`/`causation_event_id`), compute `attribution_credits` per model. **Re-runnable** — recomputing a model rewrites only its credit rows, never mutates Conversions. Launch: last/first/linear/position; `data_driven` = a clear `NOT_CONFIGURED` (no fake output).
4. **Commission linkage:** `transaction.closed`/`commission.earned` values are **read/attested from the finance ledger** (do not recompute in marketing). Define the read boundary explicitly.
5. **Campaign rollups:** per-Campaign (and per-Execution for standalone) — leads · qualified · viewings · offers · reservations · transactions · GTV · commission · marketing cost · **ROI/ROAS** — from Conversions + AttributionCredits + spend (paid Executions / `metric_observations`). Respect P1: standalone Executions (`campaign_id = NULL`) still attribute via `execution_id` — never fabricate a campaign.

### SCOPE — FRONTEND
1. Campaign performance view: funnel + commission/ROAS with an attribution-model switcher (recompute view without changing data).
2. Per-property / per-execution attribution drill-down (the causal chain).

### OUT OF SCOPE
Experiment analysis (2D). Data-driven modelling (fast-follow). Paid spend ingestion beyond reading what 2A/`metric_observations` record.

### ACCEPTANCE CRITERIA
- [ ] Business Events materialise Conversions idempotently across the full funnel.
- [ ] AttributionCredits computed per model; switching models recomputes credits without touching Conversions.
- [ ] `execution_id` is the attribution key; `campaign_id = NULL` executions still attribute (P1). No fabricated campaigns.
- [ ] Commission/GTV sourced from the finance ledger, not recomputed.
- [ ] Rollups (funnel → commission → ROAS) correct; tenant-isolated via `withTenant`.

### TEST MATRIX
1. Funnel Events → correct Conversions; re-ingest → no duplicate Conversions.
2. last/first/linear/position credits sum correctly per Conversion; model switch re-runs cleanly.
3. Standalone (no-campaign) Execution attributes via execution_id.
4. Commission rollup matches ledger fixture; ROAS math correct.
5. Tenant isolation on conversions/attribution_credits.
