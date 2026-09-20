# Wave 1D — Audience — SELF-CONTAINED CURSOR PROMPT
> Paste this ENTIRE file into one Cursor agent. Everything needed is here.

## THIS MODULE IN THE WAVE (coordination)
- **Prerequisite:** Wave 0 merged to `main` (`backend/src/lib/growth-os/`). Run in parallel with 1A/1B/1C.
- **Your migration block:** `645–664` (current live max 552 — re-check).
- **You own:** `audiences`, `audience_memberships`. Journeys (1A) and Campaign consume your `resolveAudience`.

---

## HOUSE RULES

### WHO YOU ARE
A senior engineer on **WingCaster** — a B2B real-estate marketing SaaS. Backend: **Node.js ESM + PostgreSQL, multi-tenant with RLS**, tested with **vitest** (Real-PG via `npm run test:pg:docker`). Frontend: **React + Vite + TypeScript**, `--lc-*` semantic tokens only.

### READ FIRST, IN FULL
1. `docs/canonical-object-model.md` (v2). 2. `docs/campaign-and-social-publishing-reconciliation.md`. 3. `docs/event-taxonomy-catalog.md` (v2). 4. The existing code named below.

### BUILD ON WAVE 0 (merged to `main`) — exact contract, do not re-invent
- **Access layer `backend/src/lib/growth-os/`**: use its exports (esp. `consent.js` for opt-out state); no raw SQL against canonical tables.
- **`withTenant(agencyId, agentId, fn)` MANDATORY** for tenant-scoped read/write; RLS strict (mig 551, `TO growth_os_app_role`, GUC set-and-matching); outside it the app role sees **zero rows**; propagation via `AsyncLocalStorage`.
- **New tenant tables copy the strict-RLS pattern** (mirror mig 551 + 543); access via `withTenant`.
- **Consent-aware membership:** read opt-out state via `consent` (a contact denied/withdrawn for the intended channel/purpose → `opted_out`). Use `consent_current`/`checkEligibility` semantics; don't reinvent consent logic.
- **Migration max on `main` is 552.**

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
ESM; `Object.assign(new Error(msg), { code })`; logger. Migrations `NNN_*.sql` (max 552; your block). Register tables in `table-mapper.js`. API client `web/src/api/client.ts`; routes `backend/src/server.js`.

### VERIFICATION (paste real output)
`backend/`: `npm ci` → `npm run test` → `npm run test:pg:docker`. `web/`: `npm ci` → `npm run build` → `npm run test`. Narrow to new `*.postgres.test.js` to dodge the Windows vitest over-parallelisation flake.

### DELIVERABLE / PR FORMAT
Branch off `main`; small landable PRs (enum-first → schema → logic → UI), each green, targeting `main`; PR body with pasted CI output; link the object model. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; PR trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### IF A REPO FACT CONTRADICTS THIS PROMPT
Stop, state the conflict, propose the minimal expand-contract fix, continue, report assumptions.

---

## MODULE: AUDIENCE (first-class segments + consent-aware membership)

### MISSION
Extract audiences from inline rules into a **first-class Audience object** with **consent-aware membership**, so a segment reports not just "184 look relevant" but "184 matched / 151 contactable / 22 frequency-capped / 7 opted-out / 4 conflicting." Journeys (1A) and Campaigns consume it. Read `docs/canonical-object-model.md` §C.

### BACKGROUND FACTS (verified)
- Audiences are **inline** today: `campaign-builder-shared.ts` `AudienceRule` (`field: status|source|tags|territory`, `operator: is|is_not|contains`, `value`) + `tags_filter[]`. No standalone audience object.
- Contacts/CRM already exist (referenced, not redefined). Consent lives in Wave 0 (`consent.js` / `consent` table + `consent_current`).

### SCOPE — BACKEND
1. **Migrations (645–664, enum-first):** `audiences` (type(static/dynamic), `rules JSONB`, member_source(crm/followers/lookalike/uploaded), estimated_size, `data JSONB` for provenance) + `audience_memberships` (audience_id, contact_id, `state`(matched/contactable/frequency_capped/opted_out/conflicting), qualified_at, expires_at, inclusion(include/exclude)). Strict RLS on both.
2. **Resolution engine** (`backend/src/domain/audiences/…`):
   - **static** = explicit contact list; **dynamic** = evaluate `rules` against CRM contacts (reuse the existing field/operator vocabulary: status/source/tags/territory + extend for budget/behaviour where data exists).
   - Compute membership **state** using Wave 0 consent: a contact denied/withdrawn/expired for the intended channel/purpose → `opted_out`; else `matched`/`contactable`. (Frequency-capped/conflicting: leave the enum + a hook — full frequency/conflict logic is Wave 2E — set them only when the signal is trivially available, else `contactable`.)
   - Provide `resolveAudience(audienceId, {channel, purpose, agencyId, agentId})` → `{matched, contactable, opted_out, …, memberIds}`, run under `withTenant`.
3. Extract today's inline `audience_rules`/`tags_filter` into `audiences` (expand-contract): a migration/adapter lifting existing campaign rules into audience rows, leaving the old shape readable.

### SCOPE — FRONTEND
1. Audience builder UI (rule editor over the existing vocabulary) usable standalone and embeddable in the Journey (1A) audience step and Campaign.
2. Show the resolved breakdown (matched/contactable/opted-out/… counts) so the agent sees reach + suppression before use.
3. `--lc-*` tokens; accessible; responsive.

### OUT OF SCOPE
AI Audience Discovery (Wave 2/post-PMF) — leave `data` provenance + a clean `resolveAudience` seam for a future AI producer. Identity resolution (later). ContactPolicy/frequency engine (Wave 2E) — only the enum + hook here.

### ACCEPTANCE CRITERIA
- [ ] Static and dynamic audiences persist and resolve; strict-RLS isolated.
- [ ] Membership state is **consent-aware** — an opted-out contact is `opted_out`, excluded from `contactable` (test against Wave 0 consent).
- [ ] Existing inline campaign rules lift into `audiences` without breaking current reads (expand-contract).
- [ ] `resolveAudience` returns the matched/contactable/opted-out breakdown consumed by 1A and Campaign; all access via `withTenant`.
- [ ] Audience builder UI works standalone and embedded.

### TEST MATRIX (minimum)
1. Migration idempotency + strict-RLS on both tables (ambient call sees nothing).
2. Dynamic rule resolution returns the correct contacts.
3. Consent-aware membership: opted-out contact excluded from `contactable`.
4. Inline-rules → audiences extraction parity; old shape still readable.
5. FE: build an audience, see the breakdown, reference it from a journey.
