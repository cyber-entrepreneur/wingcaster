/**
 * Wave 7 quality fixtures — WF-31 ownership transfer + AGN-ROL + AGN-DSH + AGN-MEM.
 *
 * Per-page rationale for real-vs-synthetic mount. Follows the pattern proven
 * on Wave 4A PR 180 and Wave 6 (`wave6-fixtures.ts`).
 *
 * Skips in `wave7-screens.visual.test.tsx` cite these entries by key.
 */
import { FIXED_NOW as SHARED_FIXED_NOW } from './wf05-wf06-fixtures'

/** Frozen wall-clock — see hard-won lesson 8 (clock drift). */
export const FIXED_NOW: number = SHARED_FIXED_NOW

export interface Wave7Surface {
  key: string
  brief: string
  realPagePath: string
  realComponent: string
  a11ySuite: string
  syntheticRationale: string
  status: 'awaiting-family-pr' | 'real-mount' | 'synthetic-mount'
  /** True if this surface consumes an existing shared primitive Cursor named. */
  consumesShared?: string[]
}

export const WAVE7_SURFACES: Readonly<Wave7Surface[]> = Object.freeze([
  // WF-31 ownership transfer — 3 screens
  {
    key: 'AGN-SET-005',
    brief: 'AGN-SET-005-ownership-transfer-initiator-brief.md',
    realPagePath: '@/pages/agency/settings/OwnershipTransferInitiatorPage',
    realComponent: 'OwnershipTransferInitiatorPage',
    a11ySuite: 'wave7-wf31-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when AGN-SET-005 lands. Async blocker: 3-factor challenge component (OTP send + recipient lookup + capability preview) resolves on later microtask. Also consumes existing <OwnershipTransferChallenge> shared component.',
    status: 'awaiting-family-pr',
    consumesShared: ['<OwnershipTransferChallenge>'],
  },
  {
    key: 'AGN-SET-005b',
    brief: 'AGN-SET-005b-accept-ownership-transfer-brief.md',
    realPagePath: '@/pages/agency/settings/AcceptOwnershipTransferPage',
    realComponent: 'AcceptOwnershipTransferPage',
    a11ySuite: 'wave7-wf31-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when AGN-SET-005b lands. Async blocker: challenge lookup by token + OTP verify + capability preview.',
    status: 'awaiting-family-pr',
    consumesShared: ['<OwnershipTransferChallenge>'],
  },
  {
    key: 'AGT-REC-006',
    brief: 'AGT-REC-006-ownership-transfer-outcome-brief.md',
    realPagePath: '@/pages/agent/reports/OwnershipTransferOutcomePage',
    realComponent: 'OwnershipTransferOutcomePage',
    a11ySuite: 'wave7-wf31-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when AGT-REC-006 lands. Consumes REC-family primitives (<StatusHero>, <OutcomeTimeline>, <ResolverMessage>, <PrimaryCtaPerState>) landed via PR 128. Async blocker: outcome-payload fetch resolves on later microtask.',
    status: 'awaiting-family-pr',
    consumesShared: ['<StatusHero>', '<OutcomeTimeline>', '<ResolverMessage>', '<PrimaryCtaPerState>'],
  },
  // AGN-ROL — 2 screens
  {
    key: 'AGN-ROL-001',
    brief: 'AGN-ROL-001-roles-overview-brief.md',
    realPagePath: '@/pages/agency/roles/RolesOverviewPage',
    realComponent: 'RolesOverviewPage',
    a11ySuite: 'wave7-agn-rol-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when AGN-ROL-001 lands. Async blocker: capability_packs list + role assignment count join resolves on later microtask.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'AGN-ROL-002',
    brief: 'AGN-ROL-002-role-permissions-detail-brief.md',
    realPagePath: '@/pages/agency/roles/RolePermissionsDetailPage',
    realComponent: 'RolePermissionsDetailPage',
    a11ySuite: 'wave7-agn-rol-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when AGN-ROL-002 lands. Async blocker: per-role capability-pack detail + assigned-users list fetched in parallel.',
    status: 'awaiting-family-pr',
  },
  // AGN-DSH — 1 screen
  {
    key: 'AGN-DSH-002',
    brief: 'AGN-DSH-002-agency-onboarding-checklist-brief.md',
    realPagePath: '@/pages/agency/AgencyOnboardingChecklistPage',
    realComponent: 'AgencyOnboardingChecklistPage',
    a11ySuite: 'wave7-agn-dsh-pages.a11y.test.tsx',
    syntheticRationale:
      'Real-mount plan when AGN-DSH-002 lands. Async blocker: `agency_onboarding_state` fetch + first-listing status + team-invites summary all resolve on later microtask. Uses same shape as AGT-ONB-005 (already on main via PR 123).',
    status: 'awaiting-family-pr',
  },
  // AGN-MEM — 3 screens. Cursor's PR 181-followup batch-2 report noted AGN-MEM
  // briefs may overlap with existing `pages/agency/Application*Page.tsx`.
  // Verify before family agent starts.
  {
    key: 'AGN-MEM-002',
    brief: 'AGN-MEM-002-applications-queue-brief.md',
    realPagePath: '@/pages/agency/ApplicationsQueuePage',
    realComponent: 'ApplicationsQueuePage',
    a11ySuite: 'wave7-agn-mem-pages.a11y.test.tsx',
    syntheticRationale:
      'ApplicationsQueuePage EXISTS on main (per Cursor batch-2 finding). This surface may already be substantially built — family agent should verify what remains vs the brief before rebuilding. Async blocker if delta work: same PA-queue-family shape (fetch + filter chips), harness applies.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'AGN-MEM-002b',
    brief: 'AGN-MEM-002b-application-detail-brief.md',
    realPagePath: '@/pages/agency/ApplicationDetailPage',
    realComponent: 'ApplicationDetailPage',
    a11ySuite: 'wave7-agn-mem-pages.a11y.test.tsx',
    syntheticRationale:
      'ApplicationDetailPage EXISTS on main. Same verify-before-rebuild note. Async blocker if delta: application details + agent profile fetches.',
    status: 'awaiting-family-pr',
  },
  {
    key: 'AGN-MEM-005',
    brief: 'AGN-MEM-005-public-join-apply-brief.md',
    realPagePath: '@/pages/PublicAgencyApplyPage',
    realComponent: 'PublicAgencyApplyPage',
    a11ySuite: 'wave7-agn-mem-pages.a11y.test.tsx',
    syntheticRationale:
      'PublicAgencyApplyPage EXISTS on main. Same verify-before-rebuild note. Async blocker if delta: agency-slug lookup + application form Zod validation.',
    status: 'awaiting-family-pr',
  },
])

export const WAVE7_PII_FIXTURES = Object.freeze({
  emails: [
    'owner-test@example.test',
    'recipient-test@example.test',
    'applicant-test@example.test',
  ],
  phones: ['+971 5X XXX 0002'],
  names: ['Owner Under Test', 'Recipient Under Test', 'Applicant Under Test'],
}) satisfies Readonly<{ emails: string[]; phones: string[]; names: string[] }>
