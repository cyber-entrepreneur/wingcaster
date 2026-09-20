# Wave 2A — Paid Ads (Meta + Google incl. Gmail/Demand Gen) — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 + Wave 1 merged to `main`. Migration max on `main` is **649**; your block **700–719**.
- **You own:** paid `ChannelDefinition(kind='paid')` rows + `Execution(kind='paid_ad')` usage + adapters. No new canonical tables required beyond paid config.
- **Ships behind feature flags OFF** until Meta/Google approvals land (external clock).

---

## HOUSE RULES

### WHO YOU ARE
Senior engineer on **WingCaster** — B2B real-estate marketing SaaS. Backend **Node ESM + PostgreSQL multi-tenant RLS**, vitest (Real-PG via `npm run test:pg:docker`). Frontend **React+Vite+TS**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. the existing code named below.

### BUILD ON WAVE 0 + WAVE 1 (both on `main`) — exact contract, do not re-invent
- **Wave 0 access layer `backend/src/lib/growth-os/`** (channels/executions/events/consent/with-tenant/index) — use exports; no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write. RLS strict (mig 551): `TO growth_os_app_role`, GUC set-and-matching; outside `withTenant` the app role sees zero rows; propagation via `AsyncLocalStorage` in `postgres-adapter.js`.
- **New tenant tables copy the strict-RLS pattern EXACTLY** (mirror mig 551 + 543): FORCE RLS, policy `FOR ALL TO growth_os_app_role` requiring GUC set-and-matching, GRANT to that role, access via `withTenant`. **Reading an existing un-RLS'd table must be SQL-scoped by agency_id/agent_id (throw if scope missing) — never `findAll` unbounded** (Wave 1D fix).
- **Wave 1 on `main` you build on:** `backend/src/domain/{journeys,creative,audiences}`, `backend/src/lib/social-publishing`; tables journeys/creatives/creative_variants/creative_renditions/approval_requests/audiences/audience_memberships; web `components/audiences/*`, `components/creative/AiAdaptiveComposer`.
- **Events** via `ingestEvent` (idempotent on `idempotency_key`, v2 vocab, under `withTenant` → resolve tenant first). Cumulative metrics → `metric_observations`, never `events`.
- **Migration max on `main` is 649** — take your block; re-check the live max first.

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. No stubs/`TODO`/`throw 'not implemented'`/placeholders/mock-in-real-path; all implemented + tested.
2. Expand-contract only; no destructive schema; cutover explicit + testful.
3. Idempotent migrations; run twice cleanly.
4. Shared enum/CHECK additions in their OWN first-landing migration.
5. RLS mandatory + STRICT on new tenant tables (copy mig 551), via `withTenant`.
6. Never weaken a gate/permission/test to go green; diagnose `403` (wrong-table gate vs missing seed; read seed first).
7. `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money `BIGINT` micros + `currency`; ids `TEXT` uuid+prefix; `TIMESTAMPTZ`; `data JSONB` for non-predicate attrs only.
8. FE: `--lc-*` tokens only; match patterns; WCAG AA + responsive.
9. Tests part of "done": unit + Real-PG (`*.postgres.test.js`); FE component tests.
10. Verify like CI, report truthfully; green ≠ correct.

### REPO CONVENTIONS
ESM; `Object.assign(new Error(msg), { code })`; existing logger. Migrations `NNN_*.sql` (max 649; your block). Register new tables in `backend/src/persistence/table-mapper.js`. API client `web/src/api/client.ts` (`fetchJson`); routes `backend/src/server.js`.

### VERIFICATION (paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker` (Real-PG, CI gate). `web/`: `npm ci` → `npm run build` → `npm run test`. Windows over-parallelises vitest → false `withTestDb` timeouts; narrow to your new `*.postgres.test.js` to confirm true pass/fail.

### DELIVERABLE / PR FORMAT
Branch off `main` (never a sibling). Small landable PRs (enum-first → schema → logic → UI), each green, targeting `main`. PR body: what/why + new tables/endpoints + compat strategy + pasted CI output; link `docs/canonical-object-model.md`. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: PAID ADS (Meta + Google incl. Gmail/Demand Gen) — connect-ready shells

### MISSION
Add the **Paid** channel kind end-to-end **as connect-ready shells**: full object model, targeting/budget/objective UI, and real integration code behind D15 — so the moment Meta/Google **business verification + app review** complete (external clock), paid ads light up. Nothing faked; features behind flags OFF until approval. Read `docs/campaign-and-social-publishing-reconciliation.md` Part 4 (4a/4b). **Verified: no paid-ads code exists today — greenfield.**

### SCOPE — BACKEND
1. **Channels:** `ChannelDefinition(kind='paid')` for `meta_ads`, `google_ads` (Gmail = a Google **Demand Gen** format, NOT a separate channel). `ChannelConnection` with `integration_model` + `credentials_ref` (OAuth to the tenant's ad account; never raw tokens).
2. **Executions:** `Execution(kind='paid_ad')` carrying objective · budget_micros/currency · targeting(JSONB: geography/demographics/audience_ref — reuse 1D `audiences`) · schedule · provider_ref. Via `executions.js`.
3. **Adapters** behind a provider interface (mirror 1C's Creative-Asset-Service pattern): `metaAdsAdapter`, `googleAdsAdapter` (real Meta Marketing API / Google Ads API). **Feature-flagged OFF** until creds + approval; a call without approval returns `PROVIDER_NOT_APPROVED` — never a stub success.
4. Emit `ad.delivered` + engagement Events (taxonomy §4B/4C) so 2C consumes them. Cumulative ad metrics → `metric_observations`.
5. **Objective vocabulary** (enum, first-landing migration): `awareness · traffic · engagement · leads · conversions` mapped per provider.

### SCOPE — FRONTEND
1. Paid-campaign builder: objective → budget → audience (reuse 1D) → creative (reuse 1C `creatives`) → review. Distinct authoring surface under the Campaign umbrella.
2. Connection UI (Settings → Channels) for Meta/Google ad accounts (OAuth), with health/approval state surfaced honestly ("connect + pending approval", not a fake publish).

### OUT OF SCOPE
Going live before external approval. Non-paid channels. Attribution math (2C consumes your Events).

### ACCEPTANCE CRITERIA
- [ ] Meta + Google paid channels modelled; `Execution(kind=paid_ad)` with objective/budget/targeting persists (strict-RLS/`withTenant`).
- [ ] Adapters make real API calls when connected+approved; return `PROVIDER_NOT_APPROVED` (no stub) otherwise — test.
- [ ] Gmail reach = Google **Demand Gen** format, not an owned-email blast (compliance).
- [ ] Paid Executions emit `ad.delivered`/engagement Events per taxonomy.
- [ ] Everything behind flags OFF; no fake publishes.

### TEST MATRIX
1. Migration idempotency + strict RLS.
2. Paid Execution create → correct objective/budget/targeting; adapter called only when approved (mock HTTP; assert real path).
3. Unapproved → `PROVIDER_NOT_APPROVED`, no `ad.delivered` Event.
4. Events match taxonomy names/idempotency.
5. FE: builder produces a valid paid Execution; unapproved state rendered honestly.
