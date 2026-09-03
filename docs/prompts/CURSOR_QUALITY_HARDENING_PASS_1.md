# Cursor prompt — quality-hardening pass 1 (post-arc retrospective fixes)

Standalone quality-hardening PR. Fixes real issues surfaced by a retrospective architect-owner audit of PR A + B + C + D (all merged on `main`).

**Not a new feature. Not a scope change.** Enterprise-grade discipline continues.

## Verified state on `main` (as of commit ad7201e)

- 4-PR arc landed: credit engine (PR A), package data model (PR B), PA admin surface (PR C), feature wiring + tenant billing UI (PR D)
- Retrospective audit at architect-owner bar found 5 real quality issues that should not sit un-fixed while the platform moves toward taking real customer money
- Retrospective is documented in the conversation; no source-of-truth doc exists yet — this PR's spec is the source of truth for what needs fixing

## Goal

Close 5 specific quality gaps. Every fix is small (10-40 lines each). Total PR size: ~150-250 lines. No schema changes. No new features. No new tests beyond what verifies the fixes.

## The 5 fixes

### Fix 1 — Add `requireElevated()` + `adminMutationLimiter` to PR A's credit-admin write routes

**File:** `backend/src/lib/credits/admin-routes.js`

**Current state:** `POST /api/admin/credits/grants`, `POST /api/admin/credits/approvals/:id/approve`, `POST /api/admin/credits/approvals/:id/reject` all use `[authMiddleware, requirePlatformAdmin]` only. Missing step-up re-auth and rate limiting.

**Why this matters:** A compromised platform-admin session can currently grant credits (money-equivalent to tenants) without step-up re-auth or rate limiting. PR C's `/api/admin/fin/packages/*` writes require both. This is a security-hardening inconsistency on the money-in surface.

**Fix:**
- Import `requireElevated` from `../../auth.js` (already imported)
- Import `adminMutationLimiter` from `../admin-limiter.js` (see how PR C's `admin-routes.js` does it)
- Change `[authMiddleware, requirePlatformAdmin]` → `[authMiddleware, requirePlatformAdmin, requireElevated(), adminMutationLimiter]` on the 3 POST routes named above
- GET routes (`/api/admin/credits/wallets`, `/api/admin/credits/grants` list, etc.) stay `[authMiddleware, requirePlatformAdmin]` — reads don't need elevation

**Test:** add one test that hits `POST /api/admin/credits/grants` without a fresh step-up token and asserts 401 (or whatever `requireElevated` returns) — matches Stage 12 admin discipline

### Fix 2 — Canonicalize `requirePlatformAdmin` (delete 4 duplicates)

**Files:**
- `backend/src/lib/credits/admin-routes.js` — has local `requirePlatformAdmin` at line ~22
- `backend/src/modules/area-intelligence/interface/admin-routes.js` — same duplication
- `backend/src/modules/property-valuation/interface/admin-routes.js` — same
- `backend/src/modules/whatsapp-listings/interface/admin-routes.js` — same
- Canonical version: `backend/src/server.js:853`

**Current state:** 5 definitions of `requirePlatformAdmin`. Each is a copy of the same 4-line function. Divergence risk if the canonical one adds MFA / audit-log / IP-check later.

**Fix:**
- Extract `requirePlatformAdmin` from `server.js` into a shared module: `backend/src/lib/auth-guards.js` (new file, ~15 lines total for the guard + JSDoc)
- Update `server.js` to import from `auth-guards.js`
- Update the 4 duplicate files to import from `auth-guards.js` and delete their local definitions

**Compat check:** ensure the shared version's signature matches what every caller expects (`(req, res, next)` — standard Express middleware). Since all 5 copies are already identical, this is a pure de-duplication.

### Fix 3 — Refactor PR A `routes.js` to use `sendCreditError` instead of leaking `err.message`

**File:** `backend/src/lib/credits/routes.js`

**Current state:** every `catch { res.status(500).json({ error: err.message }) }` exposes internal error details (potentially DB error text, stack fragments) to authenticated tenants.

**Why this matters:** Enterprise-grade error hygiene requires filtered error responses. PR D's `tenant-routes.js` already does this via `sendCreditError` — a helper that maps `CreditEngineError.code` to correct HTTP status and returns a controlled shape.

**Fix:**
- `sendCreditError` currently lives inside `tenant-routes.js`; move it to `backend/src/lib/credits/errors.js` (small refactor, ~15 lines) so it's shared
- Update PR A `routes.js` to import + use it on every catch
- Update PR D `tenant-routes.js` to import from `errors.js` (removes its inline copy)

Existing `errors.js` already has `creditErrorHttpStatus` — building on it is natural.

### Fix 4 — Change `CREDIT_GRANT_APPROVAL_REQUIRED` HTTP status from 202 to 409

**File:** `backend/src/lib/credits/errors.js`

**Current state:** `creditErrorHttpStatus` returns 202 (Accepted) for `CREDIT_GRANT_APPROVAL_REQUIRED`. 202 means "async processing accepted." The correct semantic is 409 (Conflict — precondition state not satisfied), matching how the same class of error is handled elsewhere in fin admin.

**Fix:**
- One-line change in the switch statement:
```js
case CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED:
  return 409  // was 202
```

**Test:** any existing test that asserts the status code for this error condition — update the assertion.

### Fix 5 — Normalize `backend/src/lib/notifications/instagram.js` metering pattern

**File:** `backend/src/lib/notifications/instagram.js`

**Current state:** `publishInstagramFeed` uses direct `meterFeature(FEATURE, opts, work)`. `publishInstagramCarousel`, `publishInstagramReel`, `publishInstagramStory` use a `__charged` bootstrap trick to avoid recursive re-metering.

**Why this matters:** Same file, two patterns for the same concern. Debugging + reader-cognition tax. Pick one.

**Fix:**
- Pick the DIRECT `meterFeature(FEATURE, opts, work)` pattern (simpler, no recursion trick needed)
- Refactor `publishInstagramCarousel/Reel/Story` to not call themselves recursively. Instead extract an internal `_doPublishCarousel` (etc.) function that does the actual work, and the exported `publishInstagramCarousel = (opts) => meterFeature(FEATURE, opts, () => _doPublishCarousel(opts))`
- Delete the `__charged` flag and all references
- Document the chosen pattern at the top of `backend/src/lib/credits/meter.js` so new adapters know the shape

## Enterprise-grade sections (per elevated audit bar)

### Threat model — what these fixes tighten

| Threat | Before this PR | After this PR |
|---|---|---|
| Compromised admin session grants unlimited credits without step-up | Possible (Fix 1 open) | Blocked by `requireElevated()` |
| Credit-grant burst attack (script hits /grants in a loop) | No rate limit | Blocked by `adminMutationLimiter` |
| Attacker probes admin credit routes for information via error messages | Learns internal errors (leaky `err.message`) | Gets filtered `sendCreditError` response |
| Client relies on HTTP 202 for approval-required and treats it as "in progress" | Undefined behavior (wrong semantic) | Gets HTTP 409 → clear conflict-state signal |
| Auth guard drift (someone updates one `requirePlatformAdmin` but not the others) | Real risk (5 copies) | Impossible (1 canonical import) |

### Failure modes

| Dependency | Failure mode | System behavior |
|---|---|---|
| `adminMutationLimiter` unavailable / mis-configured | Middleware throws or rate-limits everyone | Returns 429; ops runbook is same as any other Stage 12 admin route (already documented) |
| `requireElevated()` middleware fails to load | Admin routes throw at register | Startup fails loud; ops sees error immediately, cannot silently deploy without protection |
| Auth-guards.js import path breaks a legacy module | Module refuses to load routes | Startup fails loud (not silent bypass) |
| Refactored instagram.js loses the `__charged` bootstrap | Recursive re-metering possible if a bug reintroduces recursion | Test coverage catches: add a test that publishes once and asserts exactly one credit-consumption row |

### Regulatory readiness

- **SOX-style dual controls**: Fix 1 strengthens the audit-trail requirement by adding step-up re-auth on the credit-grant surface (already covered by two-person approval at the record level; now also at the session level)
- **GDPR / privacy**: Fix 3 (sendCreditError) is a data-hygiene improvement — internal DB errors shouldn't leak to clients (tenants or admins). Reduces personal-data-in-error-message exposure.

### Scale target

- No scale impact. All 5 fixes are structural/security cleanups. No new query patterns.

## Testing

- **Fix 1**: 1 test per route asserting 401 without step-up + 200 with step-up (mirror how PR C admin tests do this)
- **Fix 2**: no new test needed; existing route tests should still pass since the behavior is unchanged
- **Fix 3**: 1 test asserting sendCreditError maps a CreditEngineError → correct HTTP + no `err.message` leakage
- **Fix 4**: update whichever existing test asserts CREDIT_GRANT_APPROVAL_REQUIRED status (search: `202` in credit-admin test files)
- **Fix 5**: 1 test verifying publishInstagramCarousel meters exactly once (no double-charge, no bypass)

All existing tests MUST continue to pass. Fast + Real-Postgres + Web suites all green.

## Scope guardrails (do NOT exceed)

- Do NOT touch the credit engine internals (`engine.js`, `wallets.js`, `janitor.js`, `fin-mirror-worker.js`) — these are correct as-shipped
- Do NOT change the package data model, compiler, or lifecycle
- Do NOT add new schema
- Do NOT integrate payment providers
- Do NOT change the tenant billing UI beyond what fix 3 requires (`sendCreditError` may need to be imported at the tenant-routes call sites too)
- Do NOT introduce new advisory locks
- Do NOT modify the fin.* accounting engine
- Do NOT restructure entitlements.js or feature-check.js
- Do NOT touch other legacy modules beyond the `requirePlatformAdmin` de-duplication in fix 2 (specifically: area-intelligence, property-valuation, whatsapp-listings)

## Branch + PR

Branch: `fix/quality-hardening-pass-1`
Base: `main`
PR title: `Quality hardening pass 1: elevated auth on credit-admin writes, dedupe requirePlatformAdmin, shared sendCreditError, HTTP-status + instagram-metering fixes`

## Definition of done

- All 5 fixes applied per spec
- 5 tests (one per fix) added or updated
- `requirePlatformAdmin` exists in exactly one canonical file; all callers import
- `sendCreditError` exists in `backend/src/lib/credits/errors.js`; both PR A `routes.js` and PR D `tenant-routes.js` import + use it
- PR A `/api/admin/credits/grants` + `/approvals/:id/approve` + `/reject` all wrapped with the 4-guard writeGuards pattern
- Instagram.js exports one consistent metering pattern (extracted internal work function, no `__charged`)
- `errors.js:creditErrorHttpStatus` returns 409 for `CREDIT_GRANT_APPROVAL_REQUIRED`
- `meter.js` header comment documents the canonical wrapping pattern
- Fast + Real-Postgres + Web suites all green
- No new lint / typescript errors
- No changes to feature behavior — every existing test unchanged (except for the HTTP status assertion updated in fix 4)

## Deviations from spec

Same discipline as PR A/B/C/D — document under "Deviations from spec" in the PR body. Enterprise-grade audit standards continue.

## Not in this PR (queued as separate follow-ups)

Retrospective flagged several other quality items that don't need urgent fixing but should be tracked:

- Batch `listFeatureQuotas` from PR D (fix N+1)
- Rewrite PR B `reads.js listPackages` to use LEFT JOIN + GROUP BY (avoid correlated subquery)
- Complete GDPR erasure in PR D (`tenant_subscriptions` actor cols + `credit_reservations.data`)
- Split `preview.js` into `admin-preview.js` + `tenant-preview.js` (mixing admin vs tenant preview functions)
- Add concurrency test for `activateProperty` from PR B
- Emit `property.deactivated` outbox event from `deactivateProperty`
- RTL Arabic + dark mode + WCAG + error-state tests for tenant billing UI

These will be dispatched as separate quality-hardening passes if you want them before Paddle integration.
