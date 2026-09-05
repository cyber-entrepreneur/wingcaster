# Cursor dispatch — Vendor admin routes (unstub Stage-11 vendor surface)

**PR title:** `feat(fin): expose vendor admin routes — vendors / rates / statements / margin (unstub Stage-11 surface)`

**Base branch:** `main`

**Estimated effort:** 3-4 days of Cursor work + review.

**Runs in parallel with:** any backend or frontend PRs — this touches `backend/src/fin/admin/routes.js` (a file only fin admin routes live in). PR #41 (Broadcast migration) is now MERGED to main and did not touch this file — no conflict risk.

**Rev 2 — 2026-09-04:** revised after architect-owner review. Added 8 items: approval payload shape, advisory lock 1021 verification, margin selling-price source, transaction wrapper for POST rate, CFG threshold key definition, pagination on list routes, empty-state test.

---

## 1. Why this PR

Per the backend placeholder audit (`docs/design/BACKEND_PLACEHOLDER_AUDIT_2026-09-04.md` §P0-6), the vendor admin routes are static stubs. `backend/src/fin/admin/routes.js:107-122` mounts `registerVendorStub`, which returns hardcoded `{ vendors: [], stage11: false, message: 'Stage 11 not merged' }`.

Data model + business logic ARE already merged:
- Migrations 210 (`fin.vendors`), 211 (`fin.vendor_usage`), 212 (`fin.vendor_statements`)
- `backend/src/fin/vendors/registry.js` — `activateRateVersion`, `deprecateRateVersion`, `upsertVendorProduct`

The admin surface was deliberately stubbed while the underlying domain was implemented. This PR unstubs so PA-VEN-001..005 can be built on top.

**Non-goals:**
- No new business logic in `fin/vendors/` — the domain is complete.
- No frontend work.
- No changes to migrations 210-212.

---

## 2. Scope

### 2.1 Read routes

Replace `registerVendorStub(app, readGuards)` with `registerVendorAdminRoutes`. All read routes gated behind existing `readGuards` (auth + `requirePlatformAdmin` + `resolveAdminContext` + `adminCsp`).

- **`GET /api/admin/fin/vendors`** — list vendors with MTD cost + MTD units + active rate-version count. Query `fin.vendors` joined with `fin.vendor_usage` aggregate for MTD window. **Pagination (see §2.6).**
- **`GET /api/admin/fin/vendors/:id`** — one vendor with rate-schedule + MTD statement summary.
- **`GET /api/admin/fin/vendors/:id/rates`** — every rate version (active + deprecated), ordered `effective_from desc`. Paginated.
- **`GET /api/admin/fin/vendors/:id/statements`** — monthly statements list. Paginated.
- **`GET /api/admin/fin/vendors/:id/statements/:month`** — one statement with per-rate-key line items + drift indicators.
- **`GET /api/admin/fin/vendors/:id/margin`** — margin computation. **See §2.5 for selling-price source.**

### 2.2 Write routes

Gated behind existing `writeGuards` (auth + admin + elevation).

- **`POST /api/admin/fin/vendors/:id/rates`** — add a rate version. **See §2.3 for transaction + §2.4 for two-person approval flow.**
- **`POST /api/admin/fin/vendors/:id/rates/:versionId/deprecate`** — deprecate active version. Elevated. Calls `registry.js :: deprecateRateVersion`.
- **`POST /api/admin/fin/vendors/:id/statements/:month/reconcile`** — mark statement reconciled with signed evidence. Elevated + advisory lock 1021. **See §2.7 for lock helper verification.**

### 2.3 Transaction wrapper on POST rate (added per review)

`POST /api/admin/fin/vendors/:id/rates` calls `upsertVendorProduct` + `activateRateVersion` — two separate `registry.js` functions. Per architect-owner review: if `upsertVendorProduct` succeeds and `activateRateVersion` fails (e.g., overlapping-rate conflict), the DB is left with an orphan unactivated rate.

**Fix:** wrap both calls in `transaction(async (client) => { ... })` from `backend/src/db.js` at the route-handler level (not inside `registry.js`, which is out-of-scope per non-goals). Both must succeed atomically or both roll back.

### 2.4 Two-person approval — approval payload shape (added per review)

Rate additions/deprecations above threshold route through the two-person approval cluster (WF-07-family pattern). Vendor rate changes have NO dedicated approval-detail screen — they land in the generic **PA-APR-002**. The generic view renders raw JSON by default, which PAs can't evaluate for a rate change.

**Fix:** the approval-request payload MUST include a structured `impact_summary` field so PA-APR-002 can render it as a readable diff table:
```
{
  workflow: 'WF-20',            // price/rate change per PA matrix
  actor_summary: { submitter, submitted_at, reason },
  impact_summary: {
    vendor_name: 'OpenAI',
    rate_key: 'gpt-4o-mini.input_tokens',
    change: { from: {price: '0.150', unit: 'USD/1M'}, to: {price: '0.180', unit: 'USD/1M'} },
    delta_pct: 20.0,
    effective_from: '2026-10-01T00:00:00Z',
    affected_tenants_estimate: 148,     // count of tenants with active usage of this feature
    monthly_cost_delta_micro_usd: 12500000
  },
  payload: { ... raw operation intent ... }
}
```
PA-APR-002 (frontend, out of this PR's scope) will need one small hardening: when the approval-request has an `impact_summary` object, render as a diff table; otherwise fall back to raw JSON. That frontend hardening is queued separately.

### 2.5 Margin selling-price source (added per review)

`GET /api/admin/fin/vendors/:id/margin` computes margin per metered feature. Selling price source needs clarity:

**v1 scope: platform-wide margin using `fin.prices` active version.**
- Selling price per feature = `fin.prices.WHERE feature=X AND state='ACTIVE'` × units
- Vendor cost per feature = `fin.vendor_usage.SUM(cost_micro_usd) WHERE feature=X AND period=<month>`
- Margin = `(selling - cost) / selling` as a percentage per feature

**Out of scope for this PR:** per-tenant margin drill-down using `fin.contracts` overrides. Separate follow-up ticket once PA-CON surface is built.

### 2.6 Pagination (added per review)

Every list route uses cursor-based pagination:
- Query params: `?limit=N&cursor=<opaque>`
- Default limit: 50. Max limit: 200.
- Response includes `next_cursor` (null if no more) + `total_estimate` (from `pg_class.reltuples` for large tables, exact count for small).
- Follow the shape used by `GET /api/admin/fin/tenants` if that's already paginated (verify pattern first).

### 2.7 Advisory lock 1021 verification (added per review)

Per architect-owner review: I asserted "reuse the existing helper" without confirming it. **Verify at PR start:**
- Grep `backend/src/fin/` + `backend/src/lib/` for `1021` OR `FIN_VENDOR_STATEMENT_RECON`.
- **If a helper exists:** name it in the PR description, use it.
- **If no helper exists:** implement `withAdvisoryLock(1021, fn)` in `backend/src/fin/lots/` (or wherever the 1020/1022/1023 helpers live) as part of THIS PR. Adds ~half a day; declared upfront.

### 2.8 CFG threshold key (added per review)

Two-person approval triggers when rate change exceeds a threshold. Add new CFG key: **`VENDOR_RATE_APPROVAL_THRESHOLD_PCT`** (default `20.0` — any rate change > 20% of prior triggers approval). Seed in a small migration extension:
```sql
-- 305c_vendor_rate_threshold.sql
INSERT INTO platform_configuration (key, value, description)
VALUES (
  'VENDOR_RATE_APPROVAL_THRESHOLD_PCT',
  '{"value": 20.0}'::jsonb,
  'Vendor rate change % above which two-person approval is required'
)
ON CONFLICT (key) DO NOTHING;
```
Reads at route-handler-level via existing CFG helper (verify pattern — probably `getPlatformConfig('KEY')` or similar).

### 2.9 Empty-state test (added per review)

For a newly-registered vendor with zero `fin.vendor_usage` rows, the MTD aggregate on `GET /api/admin/fin/vendors` must return `0` (not `NULL`). Explicit test case in `routes-vendors.postgres.test.js`:
- Seed a vendor with no usage rows
- Call `GET /api/admin/fin/vendors`
- Assert row returned with `mtd_cost_micro_usd: 0`, `mtd_units: 0`, `active_rate_versions: 0`
Prevents the common frontend-table-break bug when aggregates return NULL.

### 2.10 Environment awareness

Every route respects `sessionEnvironment(req)` — vendor data is env-scoped via `fin.env` GUC per existing pattern.

---

## 3. Non-negotiables

1. **Follow the existing `wrap(handler)` + `sendFinError(res, error)` pattern.** Do not invent a new error path.
2. **Every write route requires SHR-MFA-007 elevation** via `requireElevated()` from `backend/src/auth.js`. Follow PR #39 pattern.
3. **Two-person approval** for rate additions/deprecations above `VENDOR_RATE_APPROVAL_THRESHOLD_PCT`. Payload MUST include the structured `impact_summary` per §2.4.
4. **Advisory lock 1021** MUST be held during reconcile. Verify + reuse existing helper OR add one per §2.7.
5. **Transaction wrapper** on `POST /api/admin/fin/vendors/:id/rates` per §2.3.
6. **Do not modify** `registry.js` — call its existing exports.
7. **Do not modify** migrations 210-212 — schema is stable. New migration `305c` for the CFG key seed is OK.

---

## 4. Test discipline

- **Fast + Real-Postgres suites green** (existing + new).
- **New tests** in `backend/src/fin/admin/routes-vendors.postgres.test.js`:
  - Auth: 401 no-auth / 401 no-admin / 401 no-elevation on writes
  - GET list: seeded vendors returned, MTD aggregation correct
  - **GET list empty-state (§2.9)**: new vendor + zero usage → mtd_cost=0
  - GET list pagination: cursor round-trip works, limit=200 caps
  - POST rate: transaction wrapper (§2.3) — inject a failing `activateRateVersion`, verify `upsertVendorProduct` rolled back
  - POST rate above threshold: creates `fin.approval_requests` with structured `impact_summary` payload
  - POST rate below threshold: applies directly
  - Reconcile: acquires lock 1021, writes audit, releases lock
  - Env scoping: LIVE writes don't appear in TEST reads
- **Delete** the `it('placeholder so the file still lists in the pg summary')` from the existing test file.

---

## 5. Definition of done

1. `registerVendorStub` removed from `fin/admin/routes.js`.
2. 6 read routes + 3 write routes wired per §2.
3. Every write route elevated.
4. Two-person approval flow works end-to-end for rate changes above threshold, with structured `impact_summary` in the payload (§2.4).
5. Transaction wrapper on POST rate (§2.3).
6. Margin computation uses `fin.prices` active version + `fin.vendor_usage` aggregate (§2.5).
7. Pagination on list routes (§2.6).
8. Advisory lock 1021 held during reconcile — using existing helper OR the new one from §2.7.
9. CFG key `VENDOR_RATE_APPROVAL_THRESHOLD_PCT` seeded via migration `305c` (§2.8).
10. Empty-state test passes (§2.9).
11. Fast + Real-Postgres CI green.
12. Curl transcript in PR description showing each route + auth branch.

---

## 6. Follow-ups (do NOT include in this PR)

1. **PA-APR-002 hardening** — render `impact_summary` as diff table when present. Frontend ticket.
2. **Per-tenant margin drill-down** using `fin.contracts` overrides — after PA-CON surface exists.
3. **PA-VEN-001..005 frontend** — the screens that consume these routes. Post-Broadcast dispatch.
