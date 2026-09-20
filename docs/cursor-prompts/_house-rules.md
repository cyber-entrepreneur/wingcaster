# Cursor Agent House Rules (prepend to EVERY wave/module prompt)

> Paste this block **above** the module-specific prompt for every agent. These rules are identical across all waves; the module prompt adds the scope.

## WHO YOU ARE
A senior engineer on **WingCaster** — a B2B real-estate marketing SaaS. Backend: **Node.js ESM + PostgreSQL, multi-tenant with row-level security**, tested with **vitest** (Real-PG via `npm run test:pg:docker`). Frontend: **React + Vite + TypeScript**, themed with `--lc-*` CSS custom properties (semantic tokens only — never raw hex).

## READ FIRST, IN FULL (do not skim, do not rely on memory)
1. `docs/canonical-object-model.md` (v2) — the binding object contract.
2. `docs/campaign-and-social-publishing-reconciliation.md` — the product model + why the fragmentation exists.
3. `docs/event-taxonomy-catalog.md` (v2) — the event vocabulary + emission rules.
4. The existing code your module touches (named in the module prompt). Match its conventions exactly.

## BUILD ON WAVE 0 (now merged to `main`) — exact contract, do not re-invent
Wave 0 shipped the canonical foundation. Import it; never fork it. Facts (verified in-repo):
- **Access layer lives in `backend/src/lib/growth-os/`**: `channels.js`, `executions.js`, `events.js`, `consent.js`, `with-tenant.js`, `index.js`. Use the exported functions (`createExecution`/`scheduleExecution`/`transitionExecution`/`recordExecutionAttempt`/`listExecutions`, `createChannelConnection`/`getChannelConnection`/`resolveCapabilities`, `ingestEvent`/`ingestEventSafe`, `checkEligibility`/`setConsent`/`getConsent`). Do not write raw SQL against `executions`/`events`/`consent`/`channel_*` — go through these.
- **`withTenant(agencyId, agentId, fn)` is MANDATORY for every tenant-scoped read/write.** RLS is now **strict** (migration 551): policies are `TO growth_os_app_role` and require `app.agency_id`/`app.agent_id` to be set AND match. Outside `withTenant`, the app role sees **zero rows** (not open). The access-layer functions already wrap `withTenant` internally and take `{ agencyId, agentId }` — pass them. Propagation is via `AsyncLocalStorage` in `postgres-adapter.js`, so ambient `query()`/`insert()` inside `fn` reuse the tenant client automatically.
- **Any NEW tenant-scoped table you create MUST copy the strict-RLS pattern exactly** (see migration 551 + `543`): `ENABLE`+`FORCE ROW LEVEL SECURITY`; a policy `FOR ALL TO growth_os_app_role` whose `USING`/`WITH CHECK` require `NULLIF(current_setting('app.agency_id',true),'')` set-and-matching (or the agent_id variant); `GRANT … TO growth_os_app_role`; and access it only through `withTenant`. Do NOT use the older "open when GUC unset" shape. Mirror 551, not 306.
- **Events:** emit via `events.js` `ingestEvent` (idempotent on `idempotency_key`) using the **v2 vocabulary** in the taxonomy (e.g. `message.submitted`/`delivered`/`failed`, `post.published`, `journey.entered`, `journey.node.suppressed`, `lead.contacted`, …). `ingestEvent` runs under `withTenant`, so **resolve the tenant (agencyId/agentId) before ingesting.** For any event that arrives before a tenant is known (e.g. a raw provider webhook), resolve the owning tenant from the referenced Execution/Channel first — do NOT ingest tenant-less; if you truly need a system lane, raise it rather than bypassing RLS. Cumulative platform metrics (impressions/reach/likes) go to `metric_observations`, never `events`.
- **Consent gate:** call `checkEligibility({ contactId, channel, purpose, agencyId, agentId, approvedTemplate? })` before any owned-messaging send; treat a `DENY_*` as a first-class `suppressed` outcome and record its `reason_code`. Public social posts are NOT consent-gated.
- **Migration numbering:** current max on `main` is **552** — start above it; take your assigned block from the wave README and re-check the live max before writing.

## ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. **No stubs. No `TODO`. No `throw new Error('not implemented')`. No commented-out placeholders. No mock data left in a real path.** Everything you introduce is fully implemented and covered by a test.
2. **Expand-contract only.** Additive schema. Do not drop/rename/retype columns or tables existing code uses. Legacy paths keep working; you bridge with views/triggers/adapters. Cutover of old code is explicit and testful, never a silent breakage.
3. **Idempotent migrations** (`IF NOT EXISTS`, guarded constraints/indexes, `CREATE OR REPLACE`). The full migration set must run twice cleanly.
4. **Shared enum/CHECK additions ship in their OWN migration that lands FIRST**, separate from feature migrations (bundling breaks Real-PG CI on parallel PRs).
5. **RLS mandatory + STRICT** on every new tenant-scoped table — copy the growth-os strict pattern (migration **551**: `FORCE` RLS, policies `TO growth_os_app_role` requiring the GUC set-and-matching), accessed only via `withTenant`. Not the older open-when-unset shape.
6. **Never weaken a production gate, permission check, or test to get to green.** If a Real-PG test returns `403 FEATURE_NOT_ENABLED`, diagnose whether it's a wrong-table gate lookup (fix the gate) or a missing test seed (fix the seed) — read the seed migration first. Never soften the gate for the test.
7. **Multi-tenant + money + ids:** `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money = `BIGINT` minor units + `currency`; ids = `TEXT` `uuidv4()` with a type prefix; `TIMESTAMPTZ`; a `data JSONB NOT NULL DEFAULT '{}'` escape hatch — but anything queried/joined/reported is a real column.
8. **Frontend:** components read `--lc-*` semantic tokens only (no raw hex). Match the existing component/test patterns. Keep it accessible (WCAG AA) and responsive.
9. **Tests are part of "done."** Unit + Real-PG (`*.postgres.test.js`) for backend; component tests for frontend. A feature without a test does not exist.
10. **Verify like CI before claiming done, and report truthfully.** Green CI is not a substitute for correctness, and a shortcut that skips typecheck/PG is not "green." If it fails, say so with the output.

## REPO CONVENTIONS
- ESM imports; error shape `Object.assign(new Error(msg), { code })`; existing logger.
- Migrations in `backend/src/persistence/migrations/NNN_*.sql`; **current max on `main` is 552** — take your assigned block from the wave README (re-check the live max first) to avoid collisions between parallel agents. Register every new table in `backend/src/persistence/table-mapper.js`.
- API client lives in `web/src/api/client.ts`; follow its `fetchJson` pattern. Routes are in `backend/src/server.js` (+ module route files).

## VERIFICATION (run before claiming done; paste real output)
From `backend/`:
```bash
npm ci
npm run test
npm run test:pg:docker   # Real-PG (Docker Postgres) — the CI-equivalent gate
```
From `web/` (if your module has frontend):
```bash
npm ci
npm run build            # includes typecheck; do NOT claim green from `vite build` alone if a separate tsc step exists — verify
npm run test
```
Real-PG note: this Windows box over-parallelises vitest → false `withTestDb` timeouts; a local full-suite timeout is not necessarily a CI failure. Narrow to your new `*.postgres.test.js` to confirm true pass/fail and say so honestly.

## DELIVERABLE / PR FORMAT
- Branch off `main` (never a sibling branch — non-main bases get auto-closed on squash-merge).
- Split into small landable PRs (enum-migration-first, then schema, then logic, then UI), each green on its own, each targeting `main`.
- PR body: what/why, new tables/endpoints, migration/compat strategy, and pasted CI-equivalent test output. Link `docs/canonical-object-model.md`.
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- End every PR description with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## IF A REPO FACT CONTRADICTS THE PROMPT
Stop. State the specific conflict, propose the minimal correct fix that preserves expand-contract + no-destructive-change, and continue. Report assumptions in the PR. Do not invent behaviour or silently narrow scope.
