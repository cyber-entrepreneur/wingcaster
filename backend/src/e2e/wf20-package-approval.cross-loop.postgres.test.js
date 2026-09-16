/**
 * WF-20 Package Approval Real-Postgres cross-loop (Wave 6 e2e scaffold).
 *
 * SCAFFOLD PR — every `it` is `it.skip` pending the PA-PKG family PRs (esp.
 * PA-PKG-003 approval queue which owns the `PACKAGE_APPROVE` action_kind
 * extract PR). When those land, the quality/e2e agent unskips and fills in
 * the assertion bodies.
 *
 * Target lifecycle (from PA-PKG briefs):
 *   1. Admin drafts package version (PA-PKG-002 editor)
 *   2. Admin submits version for approval → `fin.approval_requests` row with
 *      `action_kind='PACKAGE_APPROVE'` (or `PACKAGE_PUBLISH` — currently in main
 *      per Cursor's batch-2 verify; PA-PKG-003 owns the final choice)
 *   3. First PA reviewer votes via the shared route:
 *        POST /api/admin/valuation/approval-requests/:id/vote
 *      → route dispatches by action_kind (see admin-routes.js:534) → routes to
 *        the package-approval service (whose method the family agent implements)
 *   4. Second PA reviewer votes → approval_requests.status='APPROVED' in the
 *      SAME transaction as the version publish + audit + outbox event
 *      (`packages.published_version_id` updated; audit + outbox row present)
 *   5. Package publish worker consumes the outbox and rolls out
 *
 * Failure modes to prove (per hard-won lessons 3 + 4 + 5):
 *   - SAME_REVIEWER (second vote from same actor as first) → 409
 *   - OWN_CASE (reporter tries to vote on own request) → 403
 *   - TOKEN_CONSUMED (undo attempt after publish worker consumed the outbox) → 410
 *   - Chaos: throw between vote-cast and publish inside the txn → full rollback
 *     (approval NOT flipped, no audit row, no outbox row)
 *
 * IMPORTANT — no shared-CHECK extract in this PR:
 *   If PA-PKG-003 introduces a NEW action_kind (e.g. `PACKAGE_APPROVE` distinct
 *   from `PACKAGE_PUBLISH` already in main via migration 343), that MUST ship
 *   as its own tiny leader PR extending `chk_approval_requests_action_kind`
 *   (mirror #178 / #179 pattern per feedback_extract_shared_migrations). This
 *   e2e file does NOT contain a migration.
 *
 * Skips when TEST_DATABASE_URL is unset (local without docker).
 */
import { describe, it, expect } from 'vitest'
import { finPostgresSuite } from '../fin/testing/suite.js'

// Scaffold-integrity checks — MUST run on every CI (file existence, grep proofs).
// Outside finPostgresSuite so they don't skip when TEST_DATABASE_URL is unset.
describe('WF-20 scaffold integrity — live, not skipped', () => {
  it('shared /vote route grep count === 1 (hard-won lesson 4)', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const routesPath = path.resolve(
      __dirname,
      '../modules/property-valuation/interface/admin-routes.js',
    )
    const content = readFileSync(routesPath, 'utf8')
    const matches = content.match(/app\.post\([^)]*approval-requests[^)]*vote/g) ?? []
    expect(
      matches.length,
      `admin-routes.js must have EXACTLY ONE app.post for /vote (hard-won lesson 4). Found: ${matches.length}`,
    ).toBe(1)
  })
})

finPostgresSuite(
  'WF-20 package approval cross-loop (Wave 6 e2e scaffold — awaits PA-PKG family)',
  { seed: false },
  ({ pool: _pool }) => {
    describe('WF-20 lifecycle — awaiting PA-PKG-003 landing', () => {
      it.skip('submits a package version for approval → REQUESTED', async () => {
        // Unskip when PA-PKG-002 (editor) + PA-PKG-003 (approval queue) land.
        // Seed: admin account with capability_pack granting package.admin.
        // Submit via POST /api/admin/packages/versions/:id/submit.
        // Assert: fin.approval_requests row exists with action_kind matching what
        // PA-PKG-003 chose (verify against admin-routes.js:534 dispatch table).
        expect(true).toBe(true)
      })

      it.skip('first PA vote via shared /vote route → dispatches to package-approval service', async () => {
        // Assert exactly ONE app.post for the /vote path (hard-won lesson 4).
        // Grep the surviving handler on main:
        //   grep -c "app.post.*approval-requests.*vote" backend/src/modules/property-valuation/interface/admin-routes.js
        // MUST equal 1.
        // The switch inside dispatches by action_kind. This test confirms PA-PKG's
        // action_kind lands in a case, not the default 400 UNSUPPORTED_ACTION_KIND.
        expect(true).toBe(true)
      })

      it.skip('second PA vote → APPROVED + publish + audit + outbox in single txn', async () => {
        // Cast-vote atomicity per hard-won lesson 3:
        // - Assert dal.beginCount() difference === 1 across the second-vote call
        // - approval_requests.status='APPROVED'
        // - packages.published_version_id === the version just approved
        // - audit_log row type='package_version_published' present
        // - outbox_events row topic='packages.published' with dispatched_at IS NULL
        // All four writes in ONE transaction.
        expect(true).toBe(true)
      })

      it.skip('publish worker consumes outbox → dispatched_at set', async () => {
        // Run the publish worker tick (or its equivalent for packages).
        // Assert outbox row's dispatched_at set to a timestamp near now.
        // Assert downstream side effect (e.g. capability-pack invalidation cache bust).
        expect(true).toBe(true)
      })
    })

    describe('failure modes — awaiting PA-PKG-003 landing', () => {
      it.skip('SAME_REVIEWER: same actor tries second vote → 409', async () => {
        expect(true).toBe(true)
      })

      it.skip('OWN_CASE: package submitter tries to vote → 403', async () => {
        expect(true).toBe(true)
      })

      it.skip('TOKEN_CONSUMED: undo after publish worker ran → 410', async () => {
        expect(true).toBe(true)
      })

      it.skip('chaos: throw between vote-cast and publish inside txn → full rollback', async () => {
        // Inject a controlled throw (env var or module mock) inside the txn.
        // After the failure:
        //   - approval_requests.status still 'PENDING_SECOND_APPROVAL' (or whatever the prior state was)
        //   - packages.published_version_id UNCHANGED
        //   - No new audit_log row for this attempt
        //   - No new outbox_events row
        expect(true).toBe(true)
      })

      it.skip('UNSUPPORTED_ACTION_KIND: unknown kind hits /vote route → 400', async () => {
        // Seed a fin.approval_requests row with a bogus action_kind (bypass the
        // shared CHECK by using a hand-crafted INSERT that skips validation,
        // OR use a real kind not registered in the dispatch switch).
        // Assert the shared route returns 400 with body.code === 'UNSUPPORTED_ACTION_KIND'.
        expect(true).toBe(true)
      })

      it.skip('NOT_FOUND: unknown approval_request_id → 404', async () => {
        expect(true).toBe(true)
      })
    })

  },
)
