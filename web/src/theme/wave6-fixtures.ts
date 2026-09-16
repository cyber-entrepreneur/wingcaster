/**
 * Wave 6 quality fixtures — PA-PKG (packages) + PA-POR (portals).
 *
 * Per-page rationale for real-vs-synthetic mount decision. Follows the pattern
 * proven on Wave 4A PR 180: each of the 7 target surfaces gets an inline note
 * naming the async blocker and the parallel a11y suite that covers real-page
 * axe + behavior.
 *
 * All entries here are declarative — the actual mount decisions land when the
 * family PRs merge (PA-PKG-001..004 + PA-POR-001..003). Skips in
 * `wave6-screens.visual.test.tsx` cite these entries by key.
 *
 * NEVER machine-translate any Arabic used in fixture text. AR strings, when
 * added, must follow the `LOGIN_COPY` pattern via the family's own `copy.ts`.
 */
import { FIXED_NOW as SHARED_FIXED_NOW } from './wf05-wf06-fixtures'

/**
 * Frozen wall-clock reference. Reuses Wave 5's FIXED_NOW so `Date.now` freezes
 * in `beforeAll` are consistent across the theme test suite. See project
 * memory: hard-won lesson 8 (clock-drift). Do NOT compute derived times from a
 * live clock inside a fixture that will be snapshotted — freeze `Date.now`.
 */
export const FIXED_NOW: number = SHARED_FIXED_NOW

/**
 * Enumeration of Wave 6 target surfaces + their real-vs-synthetic mount rationale.
 *
 * When a family PR lands, its quality contribution unskips the corresponding entry
 * in `wave6-screens.visual.test.tsx` and points at the real page component.
 */
export interface Wave6Surface {
  key: string
  brief: string
  realPagePath: string
  realComponent: string
  a11ySuite: string
  syntheticRationale: string
  status: 'awaiting-family-pr' | 'real-mount' | 'synthetic-mount'
}

export const WAVE6_SURFACES: Readonly<Wave6Surface[]> = Object.freeze([
  {
    key: 'PA-PKG-001',
    brief: 'PA-PKG-001-package-list-brief.md',
    realPagePath: '@/pages/admin/packages/PackageListPage',
    realComponent: 'PackageListPage',
    a11ySuite: 'wave6-pa-pkg-pages.a11y.test.tsx (added when family lands)',
    syntheticRationale:
      'Real-mount plan when PA-PKG-001 lands. Async blocker: initial fetch of package list + version metadata via useSWR — resolves on later microtask, would leave `isLoading:true` in the synchronous serialize.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'PA-PKG-002',
    brief: 'PA-PKG-002-package-edit-brief.md',
    realPagePath: '@/pages/admin/packages/PackageEditPage',
    realComponent: 'PackageEditPage',
    a11ySuite: 'wave6-pa-pkg-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when PA-PKG-002 lands. Async blocker: fetches package + version + feature-flag registry + capability-pack list in parallel — hydration completes on later microtask.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'PA-PKG-003',
    brief: 'PA-PKG-003-approval-queue-brief.md',
    realPagePath: '@/pages/admin/packages/PackageApprovalQueuePage',
    realComponent: 'PackageApprovalQueuePage',
    a11ySuite: 'wave6-pa-pkg-pages.a11y.test.tsx (uses assertPaQueueFamilyInvariants harness)',
    syntheticRationale:
      'Real-mount plan when PA-PKG-003 lands. This surface consumes PR 181 primitives (`TwoPersonExecuteModal`, `useTwoPersonExecuteModal`) — assert via harness that PA-queue-family invariants (7) hold + that PR 181 modal opens on execute-click. Async blocker: fetches approval-request preview via /execute-preview when modal opens.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'PA-PKG-004',
    brief: 'PA-PKG-004-version-history-brief.md',
    realPagePath: '@/pages/admin/packages/PackageVersionHistoryPage',
    realComponent: 'PackageVersionHistoryPage',
    a11ySuite: 'wave6-pa-pkg-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when PA-PKG-004 lands. Async blocker: paginated version-diff fetches with expand-on-demand — first page loads on later microtask, expand fetches are per-row lazy.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'PA-POR-001',
    brief: 'PA-POR-001-portal-list-brief.md',
    realPagePath: '@/pages/admin/portals/PortalListPage',
    realComponent: 'PortalListPage',
    a11ySuite: 'wave6-pa-por-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when PA-POR-001 lands. This is another PA-queue-family surface — invariants harness applies. Async blocker: portal_registry list + adapter status resolve on later microtask.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'PA-POR-002',
    brief: 'PA-POR-002-add-edit-portal-brief.md',
    realPagePath: '@/pages/admin/portals/PortalEditPage',
    realComponent: 'PortalEditPage',
    a11ySuite: 'wave6-pa-por-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when PA-POR-002 lands. Async blocker: fetches adapter schema for the selected portal + validates form against dynamic schema.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'PA-POR-003',
    brief: 'PA-POR-003-portal-activation-history-brief.md',
    realPagePath: '@/pages/admin/portals/PortalActivationHistoryPage',
    realComponent: 'PortalActivationHistoryPage',
    a11ySuite: 'wave6-pa-por-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when PA-POR-003 lands. Async blocker: activation-history query + CSV export URL sign — resolves on later microtask.',
    status: 'awaiting-family-pr',
  },
])

/**
 * Fixture PII values — the assertion helpers grep the .snap for these
 * substrings after every visual snap. When a real-page render is wired,
 * pass these to the page's fixture layer so the assertions have known values
 * to look for.
 */
export const WAVE6_PII_FIXTURES = Object.freeze({
  emails: ['ops-test@example.test', 'admin-test@example.test'],
  phones: ['+971 5X XXX 0001'],
  names: ['Layla Al-Fahim', 'Ops Reviewer'],
}) satisfies Readonly<{ emails: string[]; phones: string[]; names: string[] }>
