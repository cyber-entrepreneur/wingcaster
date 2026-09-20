# Wave 1A — Journeys — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 is merged to `main` (canonical foundation + `backend/src/lib/growth-os/` access layer). Run in parallel with 1B/1C/1D.
- **Your migration block:** `600–619` (current live max is 552; re-check before writing, never reuse a number).
- **You own these tables:** `journeys`, `journey_versions`, `journey_runs`, `journey_node_runs`. Don't create tables owned by other modules; cross-refs (`creative_id` from 1C) stay nullable TEXT, no cross-module hard FK.
- **Consent applies here** (journeys send owned messaging to contacts).

---

## HOUSE RULES

### WHO YOU ARE
A senior engineer on **WingCaster** — a B2B real-estate marketing SaaS. Backend: **Node.js ESM + PostgreSQL, multi-tenant with row-level security**, tested with **vitest** (Real-PG via `npm run test:pg:docker`). Frontend: **React + Vite + TypeScript**, themed with `--lc-*` CSS custom properties (semantic tokens only — never raw hex).

### READ FIRST, IN FULL (do not skim, do not rely on memory)
1. `docs/canonical-object-model.md` (v2) — the binding object contract.
2. `docs/campaign-and-social-publishing-reconciliation.md` — the product model + why the fragmentation exists.
3. `docs/event-taxonomy-catalog.md` (v2) — the event vocabulary + emission rules.
4. The existing code your module touches (named below). Match its conventions exactly.

### BUILD ON WAVE 0 (merged to `main`) — exact contract, do not re-invent
- **Access layer in `backend/src/lib/growth-os/`**: `channels.js`, `executions.js`, `events.js`, `consent.js`, `with-tenant.js`, `index.js`. Use the exports (`createExecution`/`scheduleExecution`/`transitionExecution`/`recordExecutionAttempt`/`listExecutions`, `ingestEvent`, `checkEligibility`/`setConsent`/`getConsent`, …). Do not write raw SQL against `executions`/`events`/`consent`/`channel_*` — go through these.
- **`withTenant(agencyId, agentId, fn)` is MANDATORY for every tenant-scoped read/write.** RLS is strict (migration 551): policies `TO growth_os_app_role` requiring `app.agency_id`/`app.agent_id` set-and-matching. Outside `withTenant` the app role sees **zero rows**. Access-layer functions wrap `withTenant` internally and take `{ agencyId, agentId }` — pass them. Propagation is via `AsyncLocalStorage` in `postgres-adapter.js`.
- **Any NEW tenant-scoped table copies the strict-RLS pattern exactly** (mirror migration 551 + 543): `ENABLE`+`FORCE ROW LEVEL SECURITY`; policy `FOR ALL TO growth_os_app_role` with `USING`/`WITH CHECK` requiring the GUC set-and-matching; `GRANT … TO growth_os_app_role`; access only via `withTenant`. Not the "open when unset" shape.
- **Events:** emit via `ingestEvent` (idempotent on `idempotency_key`) with the v2 vocabulary; `ingestEvent` runs under `withTenant`, so **resolve the tenant before ingesting**. Cumulative metrics → `metric_observations`, never `events`.
- **Consent gate:** `checkEligibility({ contactId, channel, purpose, agencyId, agentId, approvedTemplate? })` before any owned-messaging send; a `DENY_*` is a first-class `suppressed` outcome — record its `reason_code`. Public social posts are NOT consent-gated (N/A for this module).
- **Migration max on `main` is 552** — start above it in your block.

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. **No stubs / `TODO` / `throw 'not implemented'` / placeholders / mock data in real paths.** Everything implemented + tested.
2. **Expand-contract only.** Additive schema; don't drop/rename/retype columns or tables existing code uses; legacy keeps working; cutover is explicit + testful.
3. **Idempotent migrations** (`IF NOT EXISTS`, guarded constraints/indexes, `CREATE OR REPLACE`); full set runs twice cleanly.
4. **Shared enum/CHECK additions ship in their OWN migration that lands FIRST.**
5. **RLS mandatory + STRICT** on new tenant tables — copy migration 551, accessed via `withTenant`.
6. **Never weaken a gate/permission/test to go green.** `403 FEATURE_NOT_ENABLED` → diagnose wrong-table gate vs missing seed (read the seed first); never soften the gate.
7. `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money `BIGINT` micros + `currency`; ids `TEXT` uuid + prefix; `TIMESTAMPTZ`; `data JSONB` escape hatch, but anything queried/reported is a real column.
8. **Frontend:** `--lc-*` tokens only; match existing component/test patterns; WCAG AA + responsive.
9. **Tests are part of "done":** unit + Real-PG (`*.postgres.test.js`); component tests for FE.
10. **Verify like CI, report truthfully.** Green ≠ correct; a shortcut skipping typecheck/PG isn't green.

### REPO CONVENTIONS
ESM imports; error shape `Object.assign(new Error(msg), { code })`; existing logger. Migrations in `backend/src/persistence/migrations/NNN_*.sql` (max 552; use your block). Register new tables in `backend/src/persistence/table-mapper.js`. API client `web/src/api/client.ts` (`fetchJson`); routes in `backend/src/server.js`.

### VERIFICATION (run before claiming done; paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker` (Real-PG, the CI gate).
`web/`: `npm ci` → `npm run build` (includes typecheck; don't claim green from `vite build` alone) → `npm run test`.
Real-PG note: this Windows box over-parallelises vitest → false `withTestDb` timeouts; narrow to your new `*.postgres.test.js` to confirm true pass/fail; a local full-suite timeout is not necessarily a CI failure.

### DELIVERABLE / PR FORMAT
Branch off `main` (never a sibling branch). Split into small landable PRs (enum-migration-first → schema → logic → UI), each green, each targeting `main`. PR body: what/why, new tables/endpoints, migration/compat strategy, pasted CI-equivalent output; link `docs/canonical-object-model.md`.
End commits with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; end PR descriptions with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop. State the conflict, propose the minimal fix preserving expand-contract + no-destructive-change, continue, and report assumptions in the PR. Don't invent behaviour or silently narrow scope.

---

## MODULE: JOURNEYS (rename + reconcile + branch-capable engine)

### MISSION
Turn today's mislabelled "campaign manager" (a CRM drip builder) into **Journeys** — a versioned, branch-capable orchestration engine whose `send` nodes emit **canonical Executions** and honour **Consent**. Simultaneously **reconcile the three overlapping builders** (#294 Pro on `main`, #302 goal picker never landed, #311 wizard blocked) into ONE Journey builder: **Wizard = create, Pro = edit**. Read `docs/campaign-and-social-publishing-reconciliation.md` Parts 0–1 and `docs/canonical-object-model.md` §D.

### BACKGROUND FACTS (verified — study before coding)
- Shared model: `web/src/components/campaigns/campaign-builder-shared.ts` (`CampaignFormState`: `trigger`, `target_channel`, `tags_filter`, `audience_rules`, `steps[]`; a step = `{delay_hours, channel(email|whatsapp|sms), subject, body}` — **text only**).
- Hook `useCampaignBuilderForm.ts`; views `CampaignBuilderProView.tsx`, `CampaignStepEditor` (Pro, on `main`).
- #294 = Pro single-page (landed). #302 = `campaign-goals.ts` goal presets (New listing/Price drop/Open house/Custom) — **never landed**. #311 = 6-step wizard (Goal→Audience→Content→Channels→Schedule→Review) — **blocked, doubly stale; carries its own copy of `campaign-goals.ts`; its `goal_id`/`audience_source` are UI-only, never persisted**.
- Backend: `createCampaign` in `web/src/api/client.ts` → `{name,description,status,trigger,target_channel,tags_filter,steps}`; existing `campaigns` table (+ steps).

### SCOPE — BACKEND
1. **Migrations (600–619, enum-first):** `journeys`, `journey_versions` (immutable `graph JSONB` DAG + `version`), `journey_runs` (per-contact: `journey_version_id`, `contact_id`, `current_node_id`, `state JSONB`, `status(active/completed/exited/suppressed)`, entered/exited stamps), `journey_node_runs` (`journey_run_id`, `node_id`, `node_type`, `input`, `result`, `execution_id?`, `occurred_at`). Strict RLS on all. Node types: `trigger·wait·send·condition·branch·lead_score·goal·exit·experiment`.
2. **Migrate `campaigns` → `journeys` (expand-contract):** create canonical rows; back the old table with a view or forward-trigger so existing reads keep working; the old linear `steps[]` maps to a `graph` where each step = a `wait`→`send` pair. **Do not drop `campaigns`.**
3. **Runtime engine** (`backend/src/domain/journeys/…` or match repo layout): enrolment (trigger + `entry_audience_id`), traversal honouring `wait`/`condition`/`branch`/`goal`/`exit`. A `send` node: calls `consent.checkEligibility({contactId, channel, purpose, agencyId, agentId})` — deny → record `suppressed` + emit `journey.node.suppressed` (with reason_code), do not send; else creates an **Execution** (`kind='message'`, via `executions.js`), links it on the `journey_node_run`, and emits `journey.entered` on run start. Schema + engine must **support branches now even if v1 UI is linear**.
4. Send nodes carry an optional `creative_id` (nullable; owned by 1C) so a step can attach branded media later.

### SCOPE — FRONTEND (reconcile the three builders)
1. **Rename** the surface to **Journeys** across routes/nav/copy (keep URL redirects — don't 404 old links).
2. **Land the goal picker once:** re-implement `campaign-goals.ts` on the `useCampaignBuilderForm` architecture (NOT #311's stale copy). Seed the presets.
3. **Reconcile:** Wizard (from #311, rebased onto the hook) = the **create** flow; Pro single-page (#294) = the **edit** flow. Both share `useCampaignBuilderForm` + `campaign-builder-shared`. Delete the dead `goal_id`/`audience_source` UI-only fields **or** persist `goal_id` if product wants reporting (pick one; if unsure, delete).
4. Port `CampaignBuilderPage.wizard.test.tsx` to the reconciled builder. Ensure web CI is green (has flaked before on unstable hook mocks returning fresh objects each render + effects depending on them — hoist mocks to a stable ref).

### OUT OF SCOPE
Audience internals (consume 1D's `audiences`; until it lands, keep today's `audience_rules`/`tags_filter` shape). Creative rendering (1C). Paid/SEO. ContactPolicy/frequency engine (Wave 2E) — but leave the `checkEligibility` call site so it's a one-line addition later.

### ACCEPTANCE CRITERIA
- [ ] A journey can be authored (wizard), edited (Pro), versioned, and run; a contact traverses the graph.
- [ ] A `send` node emits a canonical `Execution(kind=message)` and is blocked by a denied/withdrawn/expired consent (test), emitting `journey.node.suppressed`.
- [ ] `campaigns` still readable by existing code (expand-contract), no data loss.
- [ ] #294/#302/#311 reconciled into ONE builder; goal picker single-sourced; wizard test ported; **web CI green**.
- [ ] Branch/condition nodes representable in `graph` and executable, even if UI v1 is linear.
- [ ] All new tables strict-RLS; all access via `withTenant`.

### TEST MATRIX (minimum)
1. Migration idempotency + strict-RLS isolation on all four tables (an ambient call without tenant sees nothing).
2. Journey run traverses wait→condition(branch)→send; correct node_runs recorded.
3. Send emits Execution; consent-denied send → `suppressed`, no Execution, `journey.node.suppressed` emitted.
4. `campaigns`→`journeys` migration parity + old view still returns rows.
5. FE: wizard creates a journey; Pro edits it; goal preset pre-fills; `wizard.test.tsx` passes.
