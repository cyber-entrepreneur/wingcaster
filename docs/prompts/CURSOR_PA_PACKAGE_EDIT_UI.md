# Cursor dispatch — PA package edit UI (PA-PKG-001..004)

**PR title:** `feat(pa): package tier admin surface — list / edit / approve / history`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~5 days of Cursor work + review.

**Rev 1 — 2026-09-06.**

**Depends on:** `CURSOR_PACKAGES_MARKETING_FIELDS.md` merged AND deployed. That PR extends `product_package_versions` with the marketing-display fields this UI edits.

**Screen Matrix workstream note:** this PR implements 4 screens from `docs/design/SCREEN_MATRIX_PA.md` (PA-PKG-001 list, PA-PKG-002 edit, PA-PKG-003 approve, PA-PKG-004 version history). Per user's explicit requirement ("tiers should be manageable in the backend by the PA"), this is pulled forward from the Phase-2 backlog into a Phase-1 priority. See `docs/design/SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` for the broader workstream context.

---

## 1. Why this PR

PA can't edit tier data without SQL access today. Backend PR extends the schema; marketing PR reads the API. This PR gives PA the UI to actually manage tiers — display fields, caps, prices, per-feature quotas, portal groups, feature toggles, support level.

**Two-person approval on price + property-cap changes** (uses the existing WF-20 approval infrastructure from PR #44) — high-impact fields can't be updated by one PA in one action.

**On-approve triggers the marketing site's on-demand revalidation** so PA changes propagate to `wingcaster.com/pricing` within seconds.

---

## 2. Scope

### 2.1 Extend the existing packages admin routes

`backend/src/lib/packages/admin-routes.js` (from PR #36) already handles some package CRUD. Extend it with the marketing-field editing surface.

New/updated endpoints (all under `/api/admin/packages/`, guarded by `authMiddleware + requirePlatformAdmin + requireElevated + If-Match`):

- `GET /` — list all packages with their ACTIVE version (already exists — extend response with new marketing fields).
- `GET /:id` — single package with all versions (extend).
- `GET /:id/versions/:version` — one version detail (new).
- `POST /:id/versions` — create a new DRAFT version. Body includes every marketing field. Returns the new draft with `id` + `status: 'DRAFT'`.
- `PATCH /:id/versions/:version` — update fields on a DRAFT version. Cannot patch ACTIVE / DEPRECATED versions.
- `POST /:id/versions/:version/submit` — DRAFT → PENDING_APPROVAL. If the diff vs the current ACTIVE includes price OR property_cap changes, this fires the WF-20 two-person approval (uses `fin/approval_requests` machinery from PR #44). Otherwise, single-approver flow (submitter can also approve after 5-minute cooling-off — configurable via CFG `PACKAGE_SINGLE_APPROVER_COOLDOWN_MINUTES`).
- `POST /:id/versions/:version/approve` — PENDING_APPROVAL → ACTIVE. Deactivates the previous ACTIVE version (marks status DEPRECATED, sets `deactivated_at`). Cannot self-approve if two-person required. On success, triggers `triggerMarketingRevalidate('pricing-tiers')`.
- `POST /:id/versions/:version/reject` — PENDING_APPROVAL → DRAFT. Requires a reason in the body.
- `POST /:id/versions/:version/schedule` — sets `effective_from` to a future date. When that date arrives, a cron worker promotes the version to ACTIVE. Out-of-scope for this PR: the cron worker itself; ship only the schedule metadata + a placeholder for the worker (log a note that the promotion needs a worker follow-up).

Every write endpoint respects `If-Match` on `version.updated_at` to prevent concurrent-edit clobbers.

### 2.2 Zod schemas per action

Under `backend/src/lib/packages/admin-schemas.js`:

- `CreateVersionSchema` — validates every marketing field on creation.
- `PatchVersionSchema` — same fields, all optional.
- `SubmitVersionSchema` — no body except a `reason` string (audit trail).
- `ApprovalActionSchema` — requires a `reason` on reject.

Validate before touching the DB.

### 2.3 Fast tests + Real-Postgres tests

**Fast:**
- Zod schemas accept valid inputs, reject invalid (e.g. negative price, non-integer property_cap).
- Two-person approval trigger correctly detects price/property-cap changes vs unrelated field changes.

**Real-Postgres:**
- Full flow: create DRAFT → submit → approve (single-person, non-price change) → new version becomes ACTIVE, old is DEPRECATED.
- Two-person flow: submit price change → single approver blocks → second approver succeeds → ACTIVE.
- If-Match precondition: concurrent edit gets 412.
- Reject path: PENDING_APPROVAL → DRAFT with reason preserved.
- Schedule: `effective_from` in future → status ACTIVE not yet promoted (worker follow-up).
- On-approve triggers `triggerMarketingRevalidate` (mock the HTTP call, assert it fires).

### 2.4 Frontend — 4 screens

**Route:** all under `/admin/packages/*` in the product web app (`web/`). Requires `platform_role === 'platform_admin'`.

**PA-PKG-001 — Package list**
- Route: `/admin/packages`
- Table of packages (one row per package):
  - Display name + tagline
  - Current ACTIVE version number + effective_from
  - Price (monthly / annual)
  - Property cap + agent cap
  - Status badge (active / inactive)
  - Action buttons: View, New draft
- Filter: active-only / all
- Sort: by sort_order (default) or price

**PA-PKG-002 — Package edit (draft version editor)**
- Route: `/admin/packages/:id/versions/new` (create) or `/admin/packages/:id/versions/:version/edit` (patch existing DRAFT)
- Form sections:
  - **Identity:** display_name, tagline, sort_order
  - **Caps:** agent_cap (with "Unlimited" toggle → null), property_cap
  - **Price:** monthly (USD, minor units — helper shows the dollar amount), annual (USD, minor — helper shows the dollar amount + effective monthly)
  - **Trial:** trial_days (0 for no trial), sales_led (checkbox)
  - **Portal group:** dropdown from `portal_groups` table
  - **Feature quotas:** dynamic form driven by the feature registry (from PRs #33-#39). Each row = one feature. Inputs accept a positive integer OR the string "unlimited" (converted to -1 on save).
  - **Feature toggles:** dynamic checkboxes driven by the feature registry.
  - **Support level:** radio group (email / email+chat / dedicated / dedicated+slack)
- **Preview:** live-rendered "how this tier appears on wingcaster.com" preview card in a side panel. Uses the same tier shape the public API returns.
- **Diff:** side-by-side comparison with the current ACTIVE version, highlighting changed fields.
- **Save draft:** persists as `status: 'DRAFT'`, stays editable.
- **Submit for approval:** persists + moves to PENDING_APPROVAL. If price OR property_cap changed, banner warns "This requires two-person approval."

**PA-PKG-003 — Approval queue + detail**
- Route: `/admin/packages/approvals`
- Table of PENDING_APPROVAL versions with submitter, submitted_at, changed-fields summary.
- Row action: Open → detail view.
- Detail view:
  - Diff panel (before / after per changed field).
  - Approve button (disabled if you're the submitter AND two-person required).
  - Reject button (opens modal, requires reason).
  - Approvers list (for two-person flow — shows who's approved so far).
- On approve success: toast, redirect to package list, marketing site revalidates within ~5 seconds.

**PA-PKG-004 — Version history**
- Route: `/admin/packages/:id/history`
- Timeline of all versions for the package:
  - Version number, status, effective_from, deactivated_at
  - Approver(s), submitter, timestamps
  - Fields changed vs prior version (short summary)
  - Click a version → read-only detail view
- Filter: DRAFT / PENDING_APPROVAL / ACTIVE / DEPRECATED
- Sort: newest first

### 2.5 Broadcast tokens + i18n

- Every screen uses `--lc-*` semantic tokens only.
- Every mobile viewport (agency admins may access via tablet) honors 44px tap floor.
- Every screen supports LTR + RTL — Arabic mirror text via the existing i18n layer.
- Numeric inputs wrap with `<Numeric>` for tabular-nums display.
- Status pills use the Broadcast status token set (draft ○ · pending_approval ◐ · active ● · deprecated ▢).

### 2.6 On-approve → marketing revalidation dispatch

Wire the backend's `triggerMarketingRevalidate` (scaffolded in the packages PR) to actually POST to the marketing site's `/api/revalidate` endpoint on the approve action. Uses `MARKETING_REVALIDATE_URL` + `MARKETING_REVALIDATE_SECRET` env vars.

Non-blocking: if the marketing site is down or the POST fails, log at WARN and return success from the approve action anyway (the DB write already succeeded; PA doesn't need to retry).

---

## 3. Non-negotiables

1. **Two-person approval on price + property-cap changes** — uses WF-20 (`fin/approval_requests`) from PR #44. Cannot bypass.
2. **If-Match precondition** on every write endpoint. Concurrent edits get 412.
3. **DRAFT is the only editable state.** ACTIVE + DEPRECATED are read-only.
4. **On approve, deactivate the previous ACTIVE version.** Only one ACTIVE per package at a time.
5. **On approve, trigger marketing revalidation.** Non-blocking but always attempted.
6. **All colors via `--lc-*` tokens.**
7. **RTL + Arabic mirror on every screen.**
8. **Fast + Real-Postgres CI green.**

---

## 4. Test discipline

- **Fast tests** for schemas, diff computation, two-person-trigger detection.
- **Real-Postgres tests** for the full lifecycle (create → submit → approve → deactivate previous → revalidate mock fires).
- **Frontend tests** (component-level via Vitest + React Testing Library):
  - PA-PKG-002 form validates required fields, converts "Unlimited" string to null on save.
  - Diff panel highlights changed fields correctly.
  - Preview panel renders the same shape as the public API.

---

## 5. Definition of done

1. Backend admin routes extended with the 6+ new/updated endpoints.
2. Zod schemas + backend tests.
3. 4 frontend screens (PA-PKG-001..004) live under `/admin/packages/*`.
4. Two-person approval wired for price + property-cap changes.
5. If-Match preconditions enforced.
6. On-approve triggers marketing revalidation dispatch.
7. Fast + Real-Postgres CI green.
8. Manual smoke plan in the PR body: PA creates a draft, edits every field, submits, approves (single-person for non-price change), verifies marketing preview URL reflects the change within 60 seconds.

---

## 6. Follow-ups (do NOT include in this PR)

- **Effective_from scheduled promotion worker** — this PR ships the metadata; the cron worker that promotes future-dated versions to ACTIVE is a separate small PR (~1 day).
- **Package feature registry admin UI** — the feature registry itself (which features exist) is edited via SQL for now. UI for that is Phase 2.
- **Multi-currency price entry** — USD only in v1. Multi-currency + FX table is a Phase-2 concern.
- **Trial-length overrides per tier per market** — not needed for v1 (30 days across the board on Semsar/Boutique/Small Team).

---

## 7. Out of scope

- Multi-currency.
- Non-package admin surfaces (PA-VEN vendor admin already exists from PR #44).
- Effective-date promotion worker.
- Package feature registry editing UI.
- Marketing site itself (the marketing PR handles reading + rendering).
