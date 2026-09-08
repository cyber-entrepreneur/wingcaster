/**
 * Tenure-risk scoring for PA-MOD-001 / PA-MOD-002 risk tier display.
 *
 * v1 is an intentional stub: always returns `tier: 'unknown'` so moderators
 * see graceful "risk unknown" copy (PA-MOD-002) until Phase 2 lands.
 *
 * TODO(Phase 2): replace this stub with real heuristics. Phase 2 should
 * consider at least:
 *   - agent tenure (account age / first submission)
 *   - prior rejection rate and severity
 *   - agency reputation / trust signals
 *   - listing anomaly signals (price, photos, copy patterns)
 * Must remain non-throwing on missing / partial agent or submission fields.
 *
 * @param {object} [_agent]
 * @param {object} [_submission]
 * @returns {{ tier: 'low'|'medium'|'high'|'unknown', reasons?: string[], signals?: object }}
 */
export function scoreTenureRisk(_agent, _submission) {
  // v1 stub — ignore inputs; never throw on null/partial/missing fields.
  return { tier: 'unknown' }
}

export default scoreTenureRisk
