# Cursor prompt — PR C: PA admin surface for packages (routes + admin UI)

This is PR C of the 4-PR arc (A ✅ → B ✅ → **C** → D). Admin routes + admin UI ONLY. Zero tenant-facing UI, zero feature call-site wiring, zero payment integration. Enterprise-grade discipline continues.

## Verified state on `main` after PR #33

- `public.metered_features`, `public.product_packages`, `public.product_package_versions`, `public.package_feature_quotas`, `public.package_feature_flags` (mig 302) — the tables you'll CRUD
- `public.tenant_subscriptions`, `public.tenant_active_properties` (mig 302)
- `backend/src/lib/packages/compiler.js` — `compileGrantFromSnapshot` + `compileSubscriptionCycleGrant`
- `backend/src/lib/packages/lifecycle.js` — `startSubscription`, `pauseSubscription`, `resumeSubscription`, `cancelAtPeriodEnd`, `cancelImmediate`, `changePlan`
- `backend/src/lib/packages/property-tracker.js` — `activateProperty`, `deactivateProperty`, `countActive`
- `backend/src/lib/packages/registry.js` — feature registry read helpers
- `fin.approval_requests`, `fin.financial_audit_events` — for the two-person approval workflow you'll integrate
- `backend/src/fin/admin/routes.js` + `web/src/pages/admin/fin/*` — Stage 12 admin scaffolding to pattern-match against (ContractsPage, PricingPage, etc.)
- Existing web admin shell: `web/src/pages/admin/fin/shell.tsx` provides `FinAdminGate` + `FinTable`
- `backend/src/fin/foundation/advisory-locks.js` — package worker uses lock 1024; do not introduce new locks here unless justified

## Goal

Ship the platform-admin CRUD surface for packages: create, compose, submit for approval, approve (two-person rule), publish, deprecate, and view. Ship a first tenant-subscription-management surface for PA (list, drill-down, assign package, change plan). Every mutation writes to `fin.financial_audit_events`. Every publish requires an `approval_request` with a second admin's approve. No tenant-facing UI here.

## New backend locations

- `backend/src/lib/packages/admin-routes.js` — all `/api/admin/fin/packages/*` + `/api/admin/fin/subscriptions/*` routes
- `backend/src/lib/packages/authoring.js` — `createPackageDraft`, `addQuota`, `addFlag`, `updateDraft`, `submitForApproval`, `approvePublish`, `deprecate` — the write-side domain functions the routes delegate to
- `backend/src/lib/packages/reads.js` — the read queries (list packages with active version summary, get version detail with quotas + flags + feature registry join)
- `backend/src/lib/packages/preview.js` — `previewCycleGrant(versionId, propertiesN)` returns compiled `total_credits` + breakdown + margin analysis (revenue vs cost estimate from `metered_features.cost_per_unit_micro_usd`)

## New web locations

- `web/src/pages/admin/fin/PackagesPage.tsx` — list of packages with tier / audience / currency / active-version / subscribers-count
- `web/src/pages/admin/fin/PackageDetailPage.tsx` — package overview + version history + CTA to compose new version
- `web/src/pages/admin/fin/PackageVersionEditor.tsx` — compose a DRAFT version: pick features from registry, set credits_per_property + rollover per feature, add package_feature_flags, set properties_covered + monthly_price_minor, live cost/margin preview panel
- `web/src/pages/admin/fin/PackageApprovalPage.tsx` — approval queue for pending package publications; reviewer sees version diff (draft vs previously PUBLISHED), can approve or reject
- `web/src/pages/admin/fin/SubscriptionsPage.tsx` — list of tenant subscriptions, filter by tier / status
- `web/src/pages/admin/fin/SubscriptionDetailPage.tsx` — one subscription: current package + cycle info + property tracker count + change-plan CTA
- Wire the new pages into `web/src/pages/admin/fin/shell.tsx` (add to nav)
- Wire the new pages into `web/src/App.tsx` under `/admin/fin/packages` + `/admin/fin/subscriptions`
- Wire the new endpoints into `web/src/api/client.ts`

## Admin routes (backend)

All routes under `/api/admin/fin/*`. Every route: `authMiddleware`, `requirePlatformAdmin`, `adminMutationLimiter` on mutations, `requireElevated` on write mutations (matches Stage 12 discipline for fin admin routes).

### Packages CRUD
```
GET    /api/admin/fin/packages                    — list; supports ?tier, ?audience, ?active, ?target_audience
POST   /api/admin/fin/packages                    — create package template (no version)
GET    /api/admin/fin/packages/:id                — one package with all versions + counts
PATCH  /api/admin/fin/packages/:id                — update display_name, active, target_audience (economics live on versions)
```

### Versions
```
POST   /api/admin/fin/packages/:id/versions               — create DRAFT version (fresh, or copy-from previous version)
GET    /api/admin/fin/packages/:id/versions/:vid          — DRAFT/PENDING/PUBLISHED/DEPRECATED detail
PATCH  /api/admin/fin/packages/:id/versions/:vid          — edit DRAFT only (economic fields); trigger blocks post-publish
POST   /api/admin/fin/packages/:id/versions/:vid/quotas   — add or update a package_feature_quota row (DRAFT only)
DELETE /api/admin/fin/packages/:id/versions/:vid/quotas/:featureId — remove a quota (DRAFT only)
POST   /api/admin/fin/packages/:id/versions/:vid/flags    — add / toggle a package_feature_flag row (DRAFT only)
DELETE /api/admin/fin/packages/:id/versions/:vid/flags/:featureCode — remove a flag (DRAFT only)
POST   /api/admin/fin/packages/:id/versions/:vid/submit-for-approval — DRAFT → PENDING_APPROVAL; creates fin.approval_requests row
POST   /api/admin/fin/packages/:id/versions/:vid/approve  — approve pending (two-person rule; enforces req.user.id ≠ requester)
POST   /api/admin/fin/packages/:id/versions/:vid/reject   — reject pending; returns to DRAFT with reason recorded in audit
POST   /api/admin/fin/packages/:id/versions/:vid/publish  — PENDING_APPROVAL + approved → PUBLISHED; sets effective_from, effective_to; blocked without approval
POST   /api/admin/fin/packages/:id/versions/:vid/deprecate — PUBLISHED → DEPRECATED; sets effective_to; requires reason
GET    /api/admin/fin/packages/:id/versions/:vid/preview?properties=15 — cost/margin preview for arbitrary properties_committed
```

### Feature registry (read-mostly)
```
GET    /api/admin/fin/metered-features           — list; filter by category / active
GET    /api/admin/fin/metered-features/:id       — detail
PATCH  /api/admin/fin/metered-features/:id       — update display_name, active, data (audit-logged; economics changes require reason)
```

Do NOT expose `credits_per_unit` or `cost_per_unit_micro_usd` PATCH here — those are compensating-change fields; PR D will introduce the versioned-pricing surface if needed. Editing feature registry economics inline breaks package version immutability semantics.

### Subscriptions
```
GET    /api/admin/fin/subscriptions              — list; filter by tenant / package / status
GET    /api/admin/fin/subscriptions/:id          — detail with cycle + active-properties count
POST   /api/admin/fin/subscriptions              — create (assign a package_version_id to a tenant)
POST   /api/admin/fin/subscriptions/:id/pause    — pause (auditor role check)
POST   /api/admin/fin/subscriptions/:id/resume   — resume
POST   /api/admin/fin/subscriptions/:id/cancel-at-period-end — soft cancel
POST   /api/admin/fin/subscriptions/:id/cancel-immediate — hard cancel (elevated only, reason required, second admin approval if credits remain)
POST   /api/admin/fin/subscriptions/:id/change-plan — delegate to lifecycle.changePlan()
```

Every subscription mutation delegates to `lib/packages/lifecycle.js` — this PR does NOT reimplement those functions. Any behavior change to lifecycle stays in lifecycle.js so the R117/R118 tests still cover it.

## Two-person approval workflow (integrate with `fin.approval_requests`)

Pattern to match: PR A's `trg_credit_grants_require_approval` + how `fin/admin/routes.js` handles approve/reject on other approval kinds.

- `POST /api/admin/fin/packages/:id/versions/:vid/submit-for-approval`:
  - Loads DRAFT version
  - Insert `fin.approval_requests` (action_kind = `PUBLISH_PACKAGE_VERSION`, requester_actor_id = req.user.id, requester_actor_type = 'USER', payload_hash = SHA256(canonical(version + quotas + flags))
  - Update `product_package_versions` set state = 'PENDING_APPROVAL', approval_request_id = new id
  - Emit outbox `package.version.pending_approval` for downstream notifications
  - Insert `fin.financial_audit_events` action = 'PACKAGE_VERSION_SUBMITTED'
- `POST /api/admin/fin/packages/:id/versions/:vid/approve`:
  - Loads pending version + approval request
  - Reject with `APPROVAL_SELF_APPROVAL_FORBIDDEN` if req.user.id === approval.requester_actor_id
  - Reject with `APPROVAL_ALREADY_RESOLVED` if approval.status !== 'PENDING'
  - Update approval status = 'APPROVED', approver_actor_id, approved_at
  - Insert audit event
  - **Does NOT publish** — a subsequent explicit `/publish` call moves it to PUBLISHED (two-step: approve, then publish, so the approving admin can review a final effective_from/to before the version becomes live)
- `POST /api/admin/fin/packages/:id/versions/:vid/publish`:
  - Requires: version.state = 'PENDING_APPROVAL' AND approval_request.status = 'APPROVED'
  - Sets version.state = 'PUBLISHED', published_at, published_by_actor_id, effective_from (default NOW(), overridable in request body if future-dated)
  - If a previously PUBLISHED version exists on the same package, sets its effective_to = new version's effective_from (so at most one version is currently effective per package)
  - Insert outbox `package.version.published`
  - Insert audit event

## Web UI — PackageVersionEditor (the interesting one)

The composer where a PA builds a package version. Should be a single-page interactive form with:

1. **Header**: package name / version number / DRAFT badge / package tier + audience
2. **Economics panel**:
   - `properties_covered` (number input, ≥ 0)
   - `monthly_price_minor` (currency-aware input, ≥ 0)
   - `effective_from` (date picker, defaults to NOW; disabled if already PUBLISHED)
3. **Feature quotas table**:
   - One row per feature in `metered_features` (already-added quotas pre-populated with their `credits_per_property` value; unselected rows have "Add" button)
   - Columns: feature.display_name, feature.category, feature.meter_unit, credits_per_property (editable), rollover_policy (dropdown: expire/carry), overage_credit_price_micro_usd (editable), computed `total credits at N properties` (live)
   - Filter/search by category and code
4. **Feature flags panel**:
   - Non-metered features list (drawn from a hardcoded list matching PR B's design brief: `white-label`, `xml-feed`, `command-center`, `agency-management`, `inspector`, `crm.contacts`, `crm.tasks`, `crm.opportunities`, `listings.crud`) — each a toggle
5. **Preview panel** (right sidebar, sticky):
   - `properties_committed` slider (0 → 200)
   - Live-computed: `total_credits`, per-feature breakdown table, cost estimate (SUM of feature.cost_per_unit_micro_usd × credits_per_property × N / feature.credits_per_unit), monthly revenue (`monthly_price_minor` × N), margin (revenue - cost, in currency + percent)
   - Warns when margin < 20% or cost > revenue
6. **Action bar**:
   - "Save draft" (auto-saves on blur too)
   - "Submit for approval" (disabled if no quotas, no economics set)
   - "Cancel" / "Delete draft"

## Web UI — PackageApprovalPage (approval queue)

- Table of all versions with `state = 'PENDING_APPROVAL'`
- Each row: package.display_name, version_number, requester_actor_id, submitted_at, DIFF against currently-PUBLISHED version (properties_covered ±, monthly_price_minor ±, quotas added/removed/changed count, flags changed count)
- Clicking a row opens a detail modal with the full DIFF + Approve / Reject / View-in-editor buttons
- Reject requires reason (text field)
- Approve is a one-click confirm (with the two-person-rule enforced by backend; UI shows "you cannot approve your own submissions" if applicable)

## Reconciliation additions

Add `R119` — every currently-effective PUBLISHED version has at most one PUBLISHED sibling with `effective_to > NOW()`. In plain English: no two PUBLISHED versions of the same package are simultaneously effective. Enforce via reconciliation, not just at publish time.

Add `R120` — every PENDING_APPROVAL version has `approval_request_id NOT NULL` referencing an approval whose status is `PENDING` (not already approved/rejected). Catches drift where an approval was manually mutated but the version's state stayed PENDING.

Each with GREEN + DRIFT seeded tests, matching R115-R118 pattern.

## Advisory locks

Reuse existing `FIN_PACKAGE_BILLING_CYCLE = 1024` for the billing-cycle worker (unchanged). No new worker in this PR. If you need per-package concurrency serialization on multi-user editor writes, use row-level `SELECT ... FOR UPDATE` on `product_package_versions`, not advisory locks.

## Testing (all required)

- **Route unit tests**: every route with happy path + auth failure (401), permission failure (403), invalid input (400), immutability trigger (P0001 → mapped to 409 PACKAGE_VERSION_IMMUTABLE), self-approve rejection, already-resolved approval rejection
- **Integration test — happy path**: create package → create draft version → add 5 quotas + 3 flags → submit for approval → 2nd admin approves → 1st admin publishes → tenant subscription assigned → billing-cycle worker fires → cycle grant lands with correct amount
- **Integration test — reject path**: submit for approval → reject → version returns to DRAFT → edit + resubmit
- **Two-person rule test**: requester tries to approve own submission, receives 403 APPROVAL_SELF_APPROVAL_FORBIDDEN
- **Deprecate test**: publish v1, publish v2, verify v1.effective_to = v2.effective_from, deprecate v1, R119 remains GREEN
- **Preview test**: for a package with 3 quotas totalling 500 credits/property, preview at N=10 returns total_credits=5000 with correct breakdown; preview at N=15 returns 7500
- **R119 GREEN + DRIFT**
- **R120 GREEN + DRIFT**
- **Web RTL tests** for each new page — render + assert critical CTAs + basic interactions; matches the existing `pages.test.tsx` pattern
- **Web integration** — one end-to-end scenario using MSW mocks for the API: PA composes a package, submits for approval

## Scope guardrails (do NOT exceed)

- Do NOT build tenant-facing pages (subscription view, credit balance display, top-up flow). PR D.
- Do NOT wire feature call sites (publish-social, listings-ai, etc.) to check entitlements / debit credits. PR D.
- Do NOT rebuild the deleted tenant billing pages. PR D.
- Do NOT integrate Stripe / Paddle / manual-receipt payment flows. Separate workstream.
- Do NOT modify PR A engine internals or PR B compiler / lifecycle / worker internals — you consume them.
- Do NOT introduce a new advisory lock class.
- Do NOT add a new migration unless the R119/R120 checks require a schema change (they should not).
- Do NOT drop `fin.credit_products` — auto-topup still uses it.
- Do NOT edit the feature registry seed rows in an inline route — that's a PR D-plus concern.
- Do NOT introduce Cursor Design mockups here — this PR ships utilitarian FinAdminGate + FinTable pages consistent with existing Stage 12 admin surface. Full designs land in PR D + parallel Cursor Design work.

## Branch + PR

Branch: `feat/packages-admin-surface`
Base: `main`
PR title: `PA admin surface for packages (CRUD + two-person approval + subscription management) (PR C)`

## Definition of done

- Every route listed above returns green on happy path + covers the specified error cases
- Two-person approval enforced (backend rejects self-approval; UI warns before rejecting)
- Publish blocked without approval; deprecate blocked without reason
- Every mutation writes `fin.financial_audit_events`
- R119 + R120 registered with GREEN + DRIFT tests
- All Stage 12 admin pages continue to work (no regressions)
- Fast + Real-Postgres + Web suites all green
- No changes to PR A engine, PR B compiler / lifecycle / worker
- Every new admin page is behind `FinAdminGate` (platform-admin only)
- New routes appear in the `web/src/pages/admin/fin/shell.tsx` nav in the same order as the API routes

## Deviations from spec

If the spec choice is wrong for what actually landed in PR A+B (route conflicts, existing gates that already do something similar, RLS-related quirks), do it and document under "Deviations from spec" in the PR body — the same discipline PR A and PR B used.

## Follow-ups NOT in this PR

- PR D — feature wiring: instrument every metered feature call site with `withCredits` from PR A; rebuild tenant billing UI; per-feature quota display; overage top-up
- Payment provider integration (Paddle first, then Stripe subscription/metered) — separate workstream
- Marketing website (Paddle merchant-verification prerequisite) — separate workstream
