/**
 * AGT-ACT-001 activation wizard step catalogue.
 * Shared by GET /api/agent/activation_state and complete/defer writers.
 */

export const ACTIVATION_STEP_STATES = Object.freeze([
  'complete',
  'in_progress',
  'not_started',
  'deferred',
  'locked',
])

export const COMPLETED_VIA_VALUES = Object.freeze([
  'onboarding',
  'whatsapp_intake',
  'dashboard_action',
  'direct',
])

export const SIGNUP_PATHS = Object.freeze(['solo', 'join', 'agency'])

/** Ordered activation steps — order is contract-stable for AGT-ACT UI. */
export const ACTIVATION_STEPS = Object.freeze([
  Object.freeze({ id: 'whatsapp', order: 1, sub_route: '/activate/whatsapp' }),
  Object.freeze({ id: 'first_listing', order: 2, sub_route: '/activate/first-listing' }),
  Object.freeze({ id: 'portal_credentials', order: 3, sub_route: '/activate/portal-credentials' }),
  Object.freeze({ id: 'working_hours', order: 4, sub_route: '/activate/working-hours' }),
  Object.freeze({ id: 'invite_team', order: 5, sub_route: '/activate/invite-team' }),
])

export const ACTIVATION_STEP_IDS = Object.freeze(ACTIVATION_STEPS.map((s) => s.id))

export const ACTIVATION_STEP_BY_ID = Object.freeze(
  Object.fromEntries(ACTIVATION_STEPS.map((s) => [s.id, s])),
)

export function emptyStepProgress() {
  return { state: 'not_started', completed_at: null, completed_via: null }
}
