# PR6 — Tenant-scoping: RLS on marketplace_connections + oauth_states, step-up on OAuth routes

**GATE: do not start until PR0 AND PR1 are merged to `main`.** REQUIRED in this tranche — not a
fast-follow. Cut fresh from `main` (suggested: `cursor/oauth-pr6-rls`). **Coordinate with PR4/PR5** — they
also insert `marketplace_connections` rows and must set `agency_id`. Design reference:
`oauth-connect-unification.md` §2.6–2.7.

**Quality bar:** DB-enforced tenant isolation; no reliance on JS predicates alone.

---

## Context
- `marketplace_connections` and the `oauth_states` table (PR0) have **no RLS** today; isolation is JS
  `agent_id` predicates only.
- Reference RLS pattern: `channel_connections` in
  `backend/src/persistence/migrations/543_growth_os_channel_tables.sql:64–102` — GUC-gated on
  `app.agency_id` / `app.agent_id`, using the existing `withTenant` mechanism.
- **Known trap (design §2.6 INVARIANT):** the current insert paths (`server.js:5365` manual create,
  `server.js:5587` OAuth-callback create) write `agent_id` but historically NOT `agency_id`. PR1 fixed the
  OAuth callback path; verify, and fix any remaining path here. NULL-agency rows become unreachable under
  an agency-scoped policy.

## Goal
Enforce tenant isolation at the database, and add step-up MFA to the OAuth start route.

## Deliverables
- Migration enabling Postgres RLS on `marketplace_connections` and `oauth_states`, GUC-gated on
  `app.agency_id` / `app.agent_id`, MODELLED ON migration 543. **The policy MUST keep the
  `app.agency_id` OR `app.agent_id` disjunction (as 543 does)** so any residual NULL-agency rows stay
  owner-reachable — do NOT make it agency-only. Ship as its own tiny migration that lands before the code
  depending on it (shared-migration rule).
- Ensure every request path reading/writing these tables `SET LOCAL`s the tenant GUCs (reuse `withTenant`).
- **Confirm EVERY `marketplace_connections` insert path sets `agency_id`.** If PR1 covered only the OAuth
  callback create, fix the manual `PUT` create path (`server.js:5365`) here to resolve+set `agency_id`
  from the agent's agency. Predicates additionally refuse a null tenant.
- Add `requireElevated()` step-up to the OAuth `/start` route(s); the `elevated` flag is already captured
  into `oauth_states` (PR1) so the redirect callback inherits it — verify the callback honours it.
- Audit for any remaining `findAll` + JS-filter on `marketplace_connections`; convert to tenant-scoped SQL.

## Tests (Real-PG — the whole point of this PR)
- Cross-tenant SELECT/UPDATE is BLOCKED when GUCs are set to another tenant, and ALLOWED for the owner.
- A null-GUC request is DENIED (not open).
- A row created via the manual `PUT` path has non-null `agency_id` AND is reachable by its owner under the
  enabled policy.
- A residual NULL-agency row is still reachable by the owning agent via the `agent_id` disjunction.
- Use DISTINCT unique keys per test. Diagnose any 403 as gate-vs-seed BEFORE touching gates — never weaken
  a production gate to pass a test.

## GLOBAL STANDARDS
- Verify CI the way CI does before ready, from `backend/`: `npm ci` → `npx tsc --noEmit` → `npm run build`
  → full persistence + Real-PG suites. Ship `package-lock.json` with any `package.json` change.
- Migrations first & isolated; never bundle a shared-constraint migration inside feature code.
- **Scan for conflict markers repo-wide + `node --check` any hand-edited JS before staging** (git can
  auto-merge yet leave markers).
- Full read of every changed file. Conventional commits. **PR targets `main`.**

## Acceptance checklist
- [ ] RLS enabled on `marketplace_connections` + `oauth_states`, GUC-gated, `agency_id OR agent_id`
      disjunction (not agency-only).
- [ ] All read/write paths `SET LOCAL` the tenant GUCs via `withTenant`.
- [ ] Every `marketplace_connections` insert path sets `agency_id`; manual `PUT` path fixed if PR1 didn't.
- [ ] `requireElevated()` on OAuth `/start`; callback honours the captured `elevated` flag.
- [ ] No `findAll`+JS-filter left on `marketplace_connections` for tenant data.
- [ ] Real-PG proves: cross-tenant blocked, owner allowed, null-GUC denied, manual-path row reachable,
      NULL-agency row reachable via agent_id.
- [ ] Marker scan clean; `node --check` clean; tsc/build/full persistence + Real-PG green.
- [ ] Every changed file read end-to-end.
