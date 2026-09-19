# Cursor Agent Prompt — Wave 0: Canonical Foundation (D15 spine)

> **How to use:** paste everything below the line into the Cursor agent as its task. It is intentionally prescriptive. Do not summarise it. The agent must read the two referenced design docs in full before writing code.

---

## ROLE & MISSION

You are a senior backend engineer on WingCaster (a B2B real-estate marketing SaaS: Node.js ESM backend, PostgreSQL, multi-tenant with row-level security). You are executing **Wave 0** of the Growth-OS build: the **canonical data foundation** that every other agent's work (Journeys, social publishing, paid, attribution, AI) depends on.

**Wave 0 delivers the shared "spine" tables + compatibility layer + access modules + tests, with ZERO change to existing runtime behaviour.** Other agents build on top of what you land. If you cut a corner here, every downstream wave inherits it. Treat this as load-bearing infrastructure.

**Scope of Wave 0 (only these canonical objects):** `ChannelDefinition`, `ChannelConnection`, `Execution`, `ExecutionAttempt`, `Event`, `Consent`. Nothing else.

## SOURCE OF TRUTH — READ FIRST, IN FULL (do not skim)
1. `docs/canonical-object-model.md` (v2) — the object contract. Field lists, identities, lifecycle, and the "Maps to existing schema" table are binding.
2. `docs/campaign-and-social-publishing-reconciliation.md` — why this exists (three fragmented publish paths, three tables for one concept).
3. Then study the **existing** code you are consolidating, and match its conventions exactly:
   - Migrations: `backend/src/persistence/migrations/` (numbered `NNN_*.sql`, idempotent).
   - `backend/src/persistence/table-mapper.js` (how tables are registered — you MUST add entries).
   - `backend/src/persistence/postgres-adapter.js` and `backend/src/db.js` (query/ambient-transaction patterns).
   - The RLS reference migration `backend/src/persistence/migrations/306_credits_tenant_rls_and_quota_index.sql` (copy this RLS pattern).
   - Legacy tables you consolidate: `007_distribution.sql` (`distributions`? verify — note the app also uses a `distributions` table via `insert('distributions', …)`), `distribution_jobs`, `publishing_jobs`, `scheduled_publications`, `distribution_attempts`, `platform_accounts`, `marketplace_connections`.
   - Test harness: `backend/src/testing/postgres.js` (`withTestDb`), and an existing `*.postgres.test.js` (e.g. `channel-source.postgres.test.js`) as a template.

## ABSOLUTE NON-NEGOTIABLES (violating any = the PR is rejected)
1. **No stubs, no `TODO`, no "left as an exercise", no commented-out placeholders, no `throw new Error('not implemented')`.** Every function you introduce is fully implemented and exercised by a test.
2. **Expand-contract only. NO destructive changes.** Do not drop, rename, or alter columns/tables that existing code uses. Legacy tables keep working unchanged. You ADD canonical tables + a forward-sync bridge. The cutover of old write-sites is a LATER wave — out of scope here.
3. **Every migration is idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT`, guarded `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE` for functions/triggers). Running the full migration set twice must succeed with no error and no duplicate data.
4. **Shared enum/CHECK values ship in their OWN migration that lands FIRST**, separate from the table migrations, per repo policy — bundling them breaks Real-PG CI on parallel PRs. (See the reconciliation doc's migration-discipline note.)
5. **RLS is mandatory** on every new table: enable RLS and add tenant-isolation policies keyed on `agency_id`/`agent_id`, matching migration 306's pattern. A new table without RLS = rejected.
6. **Idempotency on Event ingestion:** `events.provider_event_id` has a `UNIQUE` constraint and the ingest path is `ON CONFLICT DO NOTHING`. Prove with a test that ingesting the same provider event twice yields one row.
7. **Backfill must be idempotent and lossless** — re-runnable, keyed on deterministic IDs derived from the source row's id, verified by a row-count/parity test.
8. **Money** = `BIGINT` minor units + `currency TEXT`. **IDs** = `TEXT` app-generated `uuidv4()` with a type prefix (`chn_`, `exec_`, `evt_`, `cns_`). **Timestamps** = `TIMESTAMPTZ`. Keep a `data JSONB NOT NULL DEFAULT '{}'` escape hatch on every table (repo convention) — but anything queried/joined/reported is a real column, never buried in `data`.
9. **Tests are part of "done", not optional.** Real-PG integration tests (`*.postgres.test.js`) for schema/backfill/RLS/triggers, plus unit tests for the access layer. A feature without a test does not exist.
10. **Verify like CI does before claiming done** (see VERIFICATION). Do not claim green from a partial/shortcut command. If something fails, fix it or report it honestly — never weaken a check, a gate, or a test to get to green.

## REPO CONVENTIONS TO MATCH
- ESM (`import`/`export`), Node. Follow the style of neighbouring files (naming, error shape `Object.assign(new Error(msg), { code })`, logger usage).
- Migration numbering: the current highest is **521** (`521_manual_score_override_indexes.sql`) — start your block at **522** and continue. Re-check `backend/src/persistence/migrations/` for the true max in case others have landed since; never reuse a number. Enum migrations take the earliest numbers of your block so they land first.
- Register every new table in `table-mapper.js` with its full column list (that file is how the app's `insert`/`findOne`/`findAll` reach Postgres).
- Multi-tenant everywhere: `agency_id TEXT REFERENCES agencies(id) ON DELETE SET NULL`, `agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL`.

## EXACT DELIVERABLES

### 1. Enum/constraint migration(s) — land FIRST
A tiny migration defining the shared status/kind vocabularies as CHECK constraints (or Postgres enums, matching whatever the repo already uses — verify):
- `execution.kind` ∈ `message · social_post · paid_ad · portal_submit · seo_page`
- `execution.status` ∈ `draft · scheduled · in_review · queued · processing · published · failed · cancelled`
- `channel_definition.kind` ∈ `owned_messaging · organic_social · paid · portal`
- `channel_connection.health` ∈ `connected · disconnected · expired · error`
- `event.event_category` ∈ `business · delivery · engagement · system`
- `consent.status` ∈ `granted · denied · withdrawn`; `consent.purpose` ∈ `marketing · transactional · nurture`

### 2. Table migrations (idempotent, RLS-enabled) — per D15 v2 field lists
- `channel_definitions` (platform, kind, global_capabilities JSONB).
- `channel_connections` (→ channel_definition, tenancy, integration_model, credentials_ref [pointer only — NEVER store raw tokens in the row], provider_account_id, rate_limits JSONB, health, tenant_capabilities JSONB).
- `executions` (id, `campaign_id TEXT NULL`, `journey_node_run_id TEXT NULL`, agency/agent, kind, `channel_connection_id`, `creative_id TEXT NULL`, `audience_id TEXT NULL`, subject_type/subject_id, scheduled_at NULL, recurrence, status, provider_ref, published_at, completed_at, data JSONB). FKs that point at not-yet-created tables (campaign/creative/audience/journey_node_run) are **nullable and unenforced for now** (plain TEXT columns + index), documented as "FK added when that table lands in its wave" — do NOT create those tables here.
- `execution_attempts` (→ execution, status, response JSONB, error_message, error_class, attempted_at) — mirror the existing `distribution_attempts` shape.
- `events` — **build to `docs/event-taxonomy-catalog.md` v2** (apply the v2 changelog; the earlier shape is superseded). Columns: `id (=event identity), event_name, event_category(business/delivery/engagement/system), schema_version, source, actor_type, actor_id, object_type, object_id, subject_identity_id NULL, identity_refs JSONB, context JSONB, occurred_at, ingested_at, contact_id NULL, execution_id NULL, campaign_id NULL, channel_connection_id NULL, value_micros NULL, currency NULL, idempotency_key (UNIQUE), provider_event_id NULL, provider_message_id NULL, correlation_id, causation_event_id NULL`. **Idempotency is `UNIQUE(idempotency_key)`** — NOT `provider_event_id` (which is nullable/informational). `events.ingestEvent()` = `ON CONFLICT (idempotency_key) DO NOTHING`. Seed the `event_category` enum + the launch (`[L]`/starred) `event_name` vocabulary; reject unlisted names. **Partition by month on `occurred_at`**; if partitioning conflicts with the migration tooling, fall back to one table + indexes and document why. `context` must be PII-safe (no raw message bodies/phone numbers — §1 context contract).
- `metric_observations` (**new — snapshots are NOT events**, per taxonomy §3B): `id, subject_type, subject_id, execution_id NULL, metric_name, metric_value, aggregation_type(cumulative/gauge), period_start, period_end, observed_at, source, provider_ref, dimensions JSONB`. RLS. Cumulative platform counters (impressions/reach/likes) go here, never in `events`. (Schema now; ingestion is Wave 2.)
- `consent` (id, contact_id, channel, purpose, status, legal_basis, source, captured_at, expires_at, jurisdiction, proof_ref). Unique current-state per `(contact_id, channel, purpose)` — model history as append + a "current" view or an upsert, your call, documented.

Index every foreign key and every column used by the sync triggers or eligibility reads.

### 3. Backfill migration(s) (idempotent, lossless)
- `platform_accounts` + `marketplace_connections` → `channel_definitions` (dedupe by platform) + `channel_connections`.
- `distributions` + `distribution_jobs` + `publishing_jobs` + `scheduled_publications` → `executions` (map each source's status into the canonical `execution.status`; set `kind` appropriately: social_post / portal_submit; carry `provider_ref`, scheduling, tenancy). Preserve the source id inside `data.legacy_source` + derive canonical id deterministically so re-runs are stable.
- `distribution_attempts` → `execution_attempts`.
- Backfill produces NO Events (historical events are out of scope); only current-state rows.

### 4. Forward-sync compatibility (so existing code keeps working untouched)
Add `AFTER INSERT OR UPDATE` triggers on the legacy tables (`distributions`, `distribution_jobs`, `publishing_jobs`, `scheduled_publications`, `distribution_attempts`, `platform_accounts`, `marketplace_connections`) that upsert the corresponding canonical row. Net effect: old code writes legacy → canonical stays current; new code (later waves) writes canonical directly. **Do not** add reverse triggers (canonical→legacy) and **do not** edit existing application write-sites in this wave.

### 5. Access layer (the interface later waves import)
Create thin, fully-implemented domain modules (match existing lib structure, e.g. `backend/src/domain/` or `backend/src/lib/…`):
- `channels.js` — create/get/list channel connections; resolve capabilities.
- `executions.js` — create/schedule/transition/list executions + record attempts (canonical writes).
- `events.js` — `ingestEvent()` (idempotent) + query helpers.
- `consent.js` — `checkEligibility({contactId, channel, purpose, now?})` returning `{allowed, reason_code, required_action?, window_expires_at?}`. **Implement it to the exact contract in `docs/consent-and-compliance-spec.md` §5** (full precedence order + the stable reason-code set + the WhatsApp 24h-window/template logic). This is the launch-critical gate every future send path calls — build the full decision table, not a placeholder. Seed `consent.purpose` (`transactional·nurture·marketing`), `status` (`granted·denied·withdrawn`), and `legal_basis` enums per that spec, and add the `consent_current` current-state view (latest row per contact×channel×purpose).
Export them from an index the other waves can import. Register all new tables in `table-mapper.js`.

## OUT OF SCOPE (do NOT touch)
- Any UI / `web/`. No frontend in Wave 0.
- Campaign, Journey, Audience, Creative, Conversion, AttributionCredit, Experiment, Decision tables — later waves.
- Editing existing publish/distribute route handlers or workers to use canonical tables — later cutover.
- Dropping/altering legacy tables. External provider integrations.

## DEFINITION OF DONE (all must be true)
- [ ] All migrations idempotent; running the whole set twice on a fresh DB succeeds cleanly.
- [ ] Enum/constraint migration(s) land before the tables that use them.
- [ ] Every new table has RLS enabled + tenant policies mirroring migration 306.
- [ ] `events.provider_event_id` UNIQUE; duplicate ingest → 1 row (proven by test).
- [ ] Backfill is re-runnable and row-count-parity tested against the legacy tables.
- [ ] Forward-sync triggers proven: inserting/updating a legacy row yields the correct canonical row (test).
- [ ] Access-layer modules fully implemented; `checkEligibility` honours granted/denied/withdrawn/expired.
- [ ] All new tables in `table-mapper.js`.
- [ ] No stubs/TODOs; no destructive schema changes; no raw tokens stored in `channel_connections`.
- [ ] Unit + Real-PG tests written and passing locally.
- [ ] `npm ci` + typecheck/lint + build + the new tests all green (see VERIFICATION), reported truthfully with output.

## TEST MATRIX (minimum)
1. **Migration idempotency** — apply all migrations twice; assert success.
2. **RLS isolation** — tenant A cannot read tenant B's channel_connections/executions/events/consent.
3. **Event idempotency** — same `provider_event_id` twice → one row.
4. **Backfill parity** — counts + spot-checked field mappings from each legacy table into canonical; re-run backfill → no duplicates.
5. **Forward-sync** — insert + update each legacy table → canonical reflects it.
6. **Eligibility** — granted → allow; denied/withdrawn/expired → deny with reason.
Use `withTestDb` and follow the Real-PG local-repro caveats (do not over-parallelise vitest; local full-suite timeouts are not CI failures).

## VERIFICATION (run before you claim done; paste real output)
The backend is **JavaScript ESM tested with vitest** (no TS build step). Confirmed scripts in `backend/package.json`: `test: vitest run`, `test:pg:docker: bash scripts/test-with-postgres.sh` (spins up Postgres in Docker — **this is the Real-PG path that matches CI**), `test:pg:keep` (keeps the container). From `backend/`:
```bash
npm ci
npm run test            # unit + integration (non-PG)
npm run test:pg:docker  # Real-PG (Postgres via docker-compose) — the CI-equivalent gate
```
If `backend/package.json` also has `lint`/`build`/`typecheck` scripts, run them too and report output. Do not report success unless the above pass. Real-PG note (this Windows box over-parallelises vitest → false `withTestDb` timeouts): a local full-suite timeout is not necessarily a CI failure — narrow to your new `*.postgres.test.js` files to confirm real pass/fail, and say so honestly if you hit the flake.

## DELIVERABLE / PR
- Branch off `main` (never a sibling branch — non-main bases get auto-closed on squash-merge). Name: `feat/wave0-canonical-foundation`.
- **Split into landable PRs in this order:** (1) enum/constraint migration, (2) canonical tables + RLS, (3) backfill + forward-sync triggers, (4) access layer + table-mapper + tests. Each PR green on its own; each targets `main`.
- PR description: what/why, the exact new tables, the backfill/sync strategy, and the test evidence (paste CI-equivalent output). Link `docs/canonical-object-model.md`.
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- End every PR description with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## IF YOU GET STUCK
Do not invent behaviour or silently narrow scope. If a repo fact contradicts this prompt (e.g. a legacy table's real columns differ from D15's mapping, or the migration tool can't do range partitioning), STOP, state the specific conflict, propose the minimal correct resolution, and continue with the expand-contract, no-destructive-change principle intact. Report assumptions explicitly in the PR.
