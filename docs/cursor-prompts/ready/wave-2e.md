# Wave 2E — Journey Engine 2.0 + ContactPolicy — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 + Wave 1 merged to `main` (Wave 1A shipped the branch-capable journey schema + engine in `backend/src/domain/journeys/`). Migration max **649**; your block **770–789**.
- **You own:** `contact_policies` + the extended journey runtime. You **implement the `checkFrequencyCap` stub** left in Wave 0 `consent.js`.

---

## HOUSE RULES

### WHO YOU ARE
Senior engineer on **WingCaster** — B2B real-estate marketing SaaS. Backend **Node ESM + PostgreSQL multi-tenant RLS**, vitest (Real-PG via `npm run test:pg:docker`). Frontend **React+Vite+TS**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. `docs/consent-and-compliance-spec.md` §5. 5. the existing code named below.

### BUILD ON WAVE 0 + WAVE 1 (both on `main`) — exact contract, do not re-invent
- **Wave 0 access layer `backend/src/lib/growth-os/`** — use exports; no raw SQL against canonical tables. `consent.js` `checkFrequencyCap` is a **STUB (returns not-capped)** — you implement it via ContactPolicy.
- **`withTenant(agencyId, agentId, fn)` MANDATORY**; RLS strict (mig 551); outside it the app role sees zero rows; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern EXACTLY** (mig 551 + 543); un-RLS'd reads SQL-scoped by tenant (throw if missing) — never `findAll` unbounded (Wave 1D fix).
- **Wave 1A journey engine on `main`:** `backend/src/domain/journeys/` (graph node types trigger·wait·send·condition·branch·lead_score·goal·exit·experiment; `journey_runs`/`journey_node_runs`; send nodes call `checkEligibility` and emit `journey.node.suppressed`). Extend it — don't fork it.
- **Events** via `ingestEvent` (idempotent, v2 vocab, under `withTenant`). **Migration max on `main` is 649.**

### ABSOLUTE NON-NEGOTIABLES (any violation = PR rejected)
1. No stubs/`TODO`/`throw 'not implemented'`/placeholders/mock-in-real-path; all implemented + tested. (This module REMOVES a stub — `checkFrequencyCap` — replace it with a real implementation.)
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

## MODULE: JOURNEY ENGINE 2.0 + CONTACTPOLICY

### MISSION
Bring the journey engine to enterprise depth — full **conditional branching / event branches / exits / suppression** in the UI (1A shipped the schema; v1 UI was linear) — and add **ContactPolicy** (the global frequency/quiet-hours/conflict layer) wired into the eligibility gate so we stop over-messaging contacts. Read `docs/canonical-object-model.md` §D + §G, reconciliation Part 6.2 (D16/D18), `docs/consent-and-compliance-spec.md` §5.

### SCOPE — BACKEND
1. **Journey Engine 2.0 runtime** (extend `backend/src/domain/journeys/`): fully execute `condition` (attribute + **event/engagement** branches, e.g. "if no `message.replied` in 2 days"), `branch`, `lead_score`, `goal`, `exit`, and node-level `experiment` splits (2D). Record every `journey_node_run` + transition reason for explainability. Add re-entry rules + exit criteria.
2. **ContactPolicy (migration 770–789):** `contact_policies` (`id · scope(agency/agent) · rules JSONB: frequency caps per channel/purpose/window, quiet hours, do-not-contact windows, campaign-priority, negotiation suppression`). Strict RLS.
3. **Wire into eligibility:** implement `checkFrequencyCap` (Wave 0 stub) to read ContactPolicy + recent sends (from `events` delivery / `executions`) and return `DENY_FREQUENCY_CAPPED` when over cap / in quiet hours / within a do-not-contact window. Every journey `send` and 1B/2A dispatch already calls `checkEligibility` — this makes the frequency branch real. **Launch-depth = frequency caps + quiet hours + do-not-contact; conflict/priority resolution across campaigns = the deeper part.**
4. **Suppression audit:** a suppressed send emits `journey.node.suppressed` with the `reason_code`.

### SCOPE — FRONTEND
1. **Journey canvas**: visual branching editor (drag trigger/wait/send/condition/branch/lead_score/goal/exit/experiment), condition builder (attribute + event predicates), exits, per-node preview. The "if X → then Y" designer.
2. ContactPolicy admin UI (agency-level caps/quiet-hours/do-not-contact).
3. Run inspector: for a contact's JourneyRun, show node-by-node path + why each transition happened (from journey_node_runs/transitions) — enterprise observability.

### OUT OF SCOPE
Journey authoring basics (1A). Experiment stats (2D — just invoke assignment at `experiment` nodes). AI journey optimisation (post-PMF).

### ACCEPTANCE CRITERIA
- [ ] Conditional/event branches, exits, re-entry execute correctly; every node run + transition reason recorded.
- [ ] ContactPolicy enforced through `checkEligibility` (`checkFrequencyCap` no longer a stub): frequency caps, quiet hours, do-not-contact honoured; over-cap → `DENY_FREQUENCY_CAPPED` + `journey.node.suppressed`.
- [ ] Journey canvas authors branches; run inspector shows the causal path.
- [ ] Tenant-isolated via `withTenant`.

### TEST MATRIX
1. Branch on an engagement event (replied vs not) routes correctly.
2. Exit + re-entry rules behave.
3. Frequency cap: 3rd promo WhatsApp in the window → `DENY_FREQUENCY_CAPPED`; quiet-hours + do-not-contact suppression.
4. Suppressed send emits `journey.node.suppressed` with reason_code.
5. Run inspector reconstructs a contact's path from journey_node_runs/transitions.
6. Tenant isolation on contact_policies.
