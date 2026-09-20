# Wave 1B — Social Publishing — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 merged to `main` (`backend/src/lib/growth-os/` access layer). Run in parallel with 1A/1C/1D.
- **Your migration block:** `665–669` (mostly logic; migrations only if you add views/indexes). Current live max 552 — re-check.
- **You own no new canonical tables** — you consolidate onto Wave 0's `executions`. Consume 1C `creative_id` if present (nullable).
- **Consent nuance:** public social posts are NOT consent-gated; the WhatsApp listing-to-a-recipient send IS (it's messaging to a person).

---

## HOUSE RULES

### WHO YOU ARE
A senior engineer on **WingCaster** — a B2B real-estate marketing SaaS. Backend: **Node.js ESM + PostgreSQL, multi-tenant with row-level security**, tested with **vitest** (Real-PG via `npm run test:pg:docker`). Frontend: **React + Vite + TypeScript**, themed with `--lc-*` CSS custom properties (semantic tokens only — never raw hex).

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. The existing code named below.

### BUILD ON WAVE 0 (merged to `main`) — exact contract, do not re-invent
- **Access layer in `backend/src/lib/growth-os/`**: `channels.js`, `executions.js`, `events.js`, `consent.js`, `with-tenant.js`, `index.js`. Use the exports; no raw SQL against `executions`/`events`/`consent`/`channel_*`.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write. RLS strict (mig 551): `TO growth_os_app_role`, GUC set-and-matching; outside `withTenant` the app role sees **zero rows**. Access-layer functions wrap it and take `{ agencyId, agentId }`. Propagation via `AsyncLocalStorage` in `postgres-adapter.js`.
- **New tenant tables copy the strict-RLS pattern** (mirror mig 551 + 543): `FORCE` RLS, policy `TO growth_os_app_role` requiring GUC, `GRANT … TO growth_os_app_role`, access via `withTenant`. Not the open-when-unset shape.
- **Events:** `ingestEvent` (idempotent on `idempotency_key`), v2 vocabulary, under `withTenant` → **resolve the tenant before ingesting**. Cumulative metrics → `metric_observations`, never `events`.
- **Consent gate:** `checkEligibility({ contactId, channel, purpose, agencyId, agentId, approvedTemplate? })` before any owned-messaging send; `DENY_*` → `suppressed`, record `reason_code`. Public social posts NOT consent-gated.
- **Migration max on `main` is 552.**

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. No stubs/`TODO`/`throw 'not implemented'`/placeholders/mock-in-real-path; all implemented + tested.
2. Expand-contract only; no destructive schema; legacy keeps working; cutover explicit + testful.
3. Idempotent migrations; full set runs twice cleanly.
4. Shared enum/CHECK additions ship in their OWN first-landing migration.
5. RLS mandatory + STRICT on new tenant tables (copy mig 551), via `withTenant`.
6. Never weaken a gate/permission/test to go green; diagnose `403` as wrong-table-gate vs missing-seed (read seed first).
7. `agency_id`/`agent_id TEXT … ON DELETE SET NULL`; money `BIGINT` micros + `currency`; ids `TEXT` uuid+prefix; `TIMESTAMPTZ`; `data JSONB` for non-predicate attrs only.
8. FE: `--lc-*` tokens only; match patterns; WCAG AA + responsive.
9. Tests part of "done": unit + Real-PG (`*.postgres.test.js`); FE component tests.
10. Verify like CI, report truthfully; green ≠ correct.

### REPO CONVENTIONS
ESM; `Object.assign(new Error(msg), { code })`; existing logger. Migrations `NNN_*.sql` (max 552; your block). Register tables in `table-mapper.js`. API client `web/src/api/client.ts` (`fetchJson`); routes in `backend/src/server.js`.

### VERIFICATION (paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Windows over-parallelises vitest → false `withTestDb` timeouts; narrow to your new `*.postgres.test.js` to confirm.

### DELIVERABLE / PR FORMAT
Branch off `main` (never a sibling). Small landable PRs (enum-first → schema → logic → UI), each green, targeting `main`. PR body: what/why + new endpoints + compat strategy + pasted CI output; link `docs/canonical-object-model.md`. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: SOCIAL PUBLISHING CONSOLIDATION (make the button actually post)

### MISSION
Today the dashboard "Promote" button uses the **weak** publish path (only WhatsApp live-sends; Instagram via an IG-only retry worker; Facebook/X/TikTok/Telegram never actually post), while the **capable** path that really publishes to all platforms is **orphaned with no UI**. Fix this: **consolidate every social publish onto the real path, wire the UI to it, record everything as canonical Executions, and make ALL connected platforms deliver.** Read `docs/campaign-and-social-publishing-reconciliation.md` Part 2 (three-paths table + Diagram 1).

### BACKGROUND FACTS (verified — study before coding)
- **Path A (weak, currently wired):** `POST /api/properties/:id/distribute-own` (`backend/src/server.js:5763`), called by `web/src/components/dashboard/PromoteDistributeModal.tsx` via `api.distributeOwn`. Writes `distributions` rows (DAL alias for `distribution_jobs`); WhatsApp = live `sendListingToWhatsApp`; IG/Telegram/TikTok/X = `pending_retry`.
- **Path B (real, orphaned):** `POST /api/listings/:id/publish-social` (`server.js:5932`) → real Graph adapters `publishInstagramFeed/Reel/Story/Carousel`, `publishFacebookPagePost/Photo`, `publishXTweet` (+ TikTok/LinkedIn). Two credential models via `resolveConnectionCredentials` / `PLATFORM_INTEGRATION_MODEL` (enterprise env-token vs tenant OAuth). `api.publishSocial` exists (`client.ts:2532`) but **no component calls it**.
- **Retry worker** `retryDistributionDelivery` (`server.js:5007`, booted `server.js:8853`) implements **Instagram only** (`"Retry publishing is not implemented for <platform>"` at `server.js:5093`).
- **Path C (portals):** `submit-to-fi` → `submitPortalPublishingJob` → `publishing_jobs`+`distribution_jobs` `in_review` (PA-MOD-001). Leave portals as-is except represent them as `Execution(kind=portal_submit, status=in_review)` via Wave 0.

### SCOPE
1. **Route the UI to path B.** Rewire `PromoteDistributeModal` (and the listings composer publish step if it publishes) to call the real publish path for organic social. Migrate WhatsApp's live-send into the same consolidated flow.
2. **Record canonically.** Every publish creates a fan-out of **canonical Executions** (one per platform, `kind=social_post`) via `executions.js`, with `execution_attempts` per provider try. Retire path A's bespoke `distributions` retry queue (or reduce it to a thin adapter that writes canonical) — expand-contract, no data loss, old rows preserved/migrated.
3. **All platforms deliver.** Replace the IG-only retry gap: dispatch to every **connected** platform through its real adapter (IG/FB/X/TikTok/LinkedIn/Telegram + WhatsApp). Unconnected → that Execution fails with a clear reason; connected → must actually attempt the real API. No `"not implemented"` for a supported connected platform.
4. **Scheduling** points at the consolidated path (today `scheduled-publish-worker.js` routes to the portal path). Due social posts run through the same canonical publish.
5. **Eligibility (the compliance line):** public posts (IG/FB/X/TikTok/LinkedIn feed) → check **`channels` connection health** only, no per-contact consent. **WhatsApp listing-to-a-recipient** send → messaging to a person → **must** pass `consent.checkEligibility({contactId, channel:'whatsapp', purpose:'marketing', agencyId, agentId})`.
6. **Emit Events** (`events.js` `ingestEvent`, under `withTenant`) for outcomes — `post.published`/`post.failed`/`message.submitted`/`message.delivered`/`message.failed` per the taxonomy — so 2C attribution can consume them. Resolve the tenant before ingest.
7. **Connection state via Wave 0 `channels.js`** (canonical `channel_connections`, kept current by Wave 0 forward-sync triggers): use `getChannelConnection`/`resolveCapabilities`/health for routing and the "is this platform connected?" check. Actual provider **credential resolution stays via the existing `resolveConnectionCredentials`** path (creds live behind `credentials_ref`); don't duplicate secrets into canonical tables.

### OUT OF SCOPE
Paid ads (Wave 2A). Portal internals beyond representing them as canonical Executions. Creative rendering (1C) — consume a `creative_id`/media URL if provided, else today's `media_urls`/`property.photos`.

### ACCEPTANCE CRITERIA
- [ ] Pressing Promote in the UI actually publishes to **every connected platform** via real adapters (not just WhatsApp+IG).
- [ ] Each publish recorded as canonical `Execution(kind=social_post)` + attempts; `distributions` rows migrated/preserved (expand-contract).
- [ ] Scheduling runs social posts through the consolidated path.
- [ ] WhatsApp recipient send consent-gated; public posts not (test).
- [ ] No `"retry not implemented"` path remains for a supported connected platform.
- [ ] Publish outcomes emit delivery Events; all canonical access via `withTenant`.

### TEST MATRIX (minimum)
1. Publish fan-out to N connected platforms → N Executions, correct per-platform status; unconnected → failed Execution with reason.
2. Adapter calls are exercised (mock HTTP; assert the real adapter path, not a stub).
3. WhatsApp send blocked when consent denied; IG post NOT blocked by consent.
4. Scheduled social post fires through the consolidated path.
5. Legacy `distributions` data preserved/migrated; existing routes still respond.
