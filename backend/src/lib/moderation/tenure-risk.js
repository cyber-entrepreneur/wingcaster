/**
 * Tenure-risk scoring — v1 stub (BE-DESIGN-02).
 *
 * v1 MUST return `unknown` for every input and MUST NOT invent scores.
 * This is a pure function: no database queries (avoids N+1 on the
 * moderation / valuation queues). PA surfaces render "risk unknown" copy
 * from this payload via `tenureRiskLabel`.
 *
 * Phase 2 will consider:
 *   - agency onboarding age
 *   - prior-rejection ratio across portals
 *   - portal-fee-history
 *   - WingCaster tenure
 *
 * Scoring rules are deferred. Do not add heuristic scoring here.
 */

export const TENURE_RISK_TIERS = ['low', 'medium', 'high', 'unknown']

const TIER_LABELS = Object.freeze({
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  unknown: 'Risk unknown',
})

/**
 * Score tenure risk for a moderation / price-report submission.
 *
 * v1 always returns `{ tier: 'unknown', score: null, signals: [], version: 'v1-stub' }`
 * regardless of input. Never throws on missing data. Never queries the database.
 *
 * Accepts either a single options object `{ agent, submission, agency }` or the
 * legacy positional `(agent, submission)` form used by early PA-MOD callers.
 *
 * @param {{ agent?: object, submission?: object, agency?: object } | object | null | undefined} [_input]
 * @param {object | null | undefined} [_submission]
 * @returns {{ tier: 'low'|'medium'|'high'|'unknown', score: number|null, signals: string[], version: 'v1-stub' }}
 */
export function scoreTenureRisk(_input, _submission) {
  return { tier: 'unknown', score: null, signals: [], version: 'v1-stub' }
}

/**
 * Step-up auth is required only for high-risk tenure.
 * v1 stubs never produce `high`, so this is false unless a caller passes a
 * non-stub override (kept implemented for Phase 2).
 *
 * @param {{ tier?: string } | null | undefined} tenureRisk
 * @returns {boolean}
 */
export function isStepUpRequired(tenureRisk) {
  return tenureRisk?.tier === 'high'
}

/**
 * Two-person reject is required only when the agency has opted in AND the
 * tenure-risk tier is `high`. v1 stubs never produce `high`, so this is
 * always false unless a caller passes a non-stub override.
 *
 * @param {{ tier?: string } | null | undefined} tenureRisk
 * @param {{ two_person_reject_required?: boolean } | null | undefined} agency
 * @returns {boolean}
 */
export function isTwoPersonRejectRequired(tenureRisk, agency) {
  return agency?.two_person_reject_required === true && tenureRisk?.tier === 'high'
}

/**
 * Human-readable label for a tenure-risk tier.
 *
 * @param {'low'|'medium'|'high'|'unknown'|string|null|undefined} tier
 * @returns {string}
 */
export function tenureRiskLabel(tier) {
  return TIER_LABELS[tier] ?? TIER_LABELS.unknown
}

export default scoreTenureRisk
