/**
 * WF-04 cross-loop fast gates (Wave 3 Agent 4).
 *
 * Proves the UI/API contract for:
 * - legacy /approve + /reject → 410 Gone migrate_to cast-vote (BE-BLOCKER-22)
 * - reveal-audit field allowlist (BE-ACR-06)
 * - cast-vote error codes covering self-approval + disagree escalation
 * - scheduled-deletion public token purpose (SHR-AUT-005d / BE-BLOCKER-19)
 *
 * Real-Postgres lifecycle lives in
 * `wf04-account-recovery.cross-loop.postgres.test.js`.
 */
import { describe, expect, it } from 'vitest'
import {
  CAST_VOTE_ERROR,
  goneApproveRejectBody,
} from '../account-recovery/cast-vote.js'
import { REVEAL_FIELDS, REVEAL_RATE_LIMIT_PER_HOUR } from '../account-recovery/reveal-audit.js'
import {
  REMINDER_TEMPLATE_CODES,
  publicNoAuth,
} from '../auth-scheduled-deletion.js'
import {
  SCHEDULED_DELETION_VIEW_PURPOSE,
  SCHEDULED_DELETION_VIEW_TTL_SECONDS,
} from '../lib/signed-token.js'

/** SHR-AUT-005d UI states — mirrored from ScheduledDeletionConfirmationPage. */
export const SHR_AUT_005D_STATES = Object.freeze([
  'VALID_PENDING',
  'ALREADY_CANCELLED',
  'ALREADY_DELETED',
  'INVALID_TOKEN',
  'EXPIRED_TOKEN',
])

/** Only cast-vote is the decision path for PA-ACR-002. */
export const DECISION_ENDPOINT = 'cast-vote'
export const LEGACY_DECISION_ENDPOINTS = Object.freeze(['approve', 'reject'])

describe('WF-04 UI contract — BE-BLOCKER-22 cast-vote only', () => {
  it('legacy approve/reject bodies point at cast-vote with GONE', () => {
    for (const legacy of LEGACY_DECISION_ENDPOINTS) {
      const body = goneApproveRejectBody(legacy)
      expect(body.code).toBe('GONE')
      expect(body.migrate_to).toBe(
        'POST /api/admin/account-recovery/:caseId/cast-vote',
      )
      expect(body.error).toContain(`/${legacy}`)
      expect(body.error).toMatch(/cast-vote/)
      expect(body.migrate_to).not.toMatch(/\/approve$|\/reject$/)
    }
  })

  it('exposes self-approval + disagreement escalation error codes', () => {
    expect(CAST_VOTE_ERROR.SAME_REVIEWER).toBe('SAME_REVIEWER')
    expect(CAST_VOTE_ERROR.OWN_CASE).toBe('OWN_CASE')
    expect(CAST_VOTE_ERROR.VOTE_DISAGREEMENT).toBe('VOTE_DISAGREEMENT')
    expect(CAST_VOTE_ERROR.ALREADY_ESCALATED).toBe('ALREADY_ESCALATED')
  })

  it('decision endpoint constant is cast-vote only', () => {
    expect(DECISION_ENDPOINT).toBe('cast-vote')
    expect(LEGACY_DECISION_ENDPOINTS).not.toContain(DECISION_ENDPOINT)
  })
})

describe('WF-04 UI contract — reveal-audit (BE-ACR-06)', () => {
  it('allowlists PII fields and rate-limits at 20/hr', () => {
    expect(REVEAL_RATE_LIMIT_PER_HOUR).toBe(20)
    for (const field of [
      'email',
      'phone',
      'username',
      'ip',
      'row',
      'name',
      'contact',
      'user_agent',
    ]) {
      expect(REVEAL_FIELDS).toContain(field)
    }
  })
})

describe('WF-04 UI contract — SHR-AUT-005d scheduled deletion', () => {
  it('covers all 5 public confirmation states', () => {
    expect(SHR_AUT_005D_STATES).toEqual([
      'VALID_PENDING',
      'ALREADY_CANCELLED',
      'ALREADY_DELETED',
      'INVALID_TOKEN',
      'EXPIRED_TOKEN',
    ])
  })

  it('public route is PUBLIC_NO_AUTH with scheduled_deletion_view purpose', () => {
    expect(publicNoAuth.marker).toBe('PUBLIC_NO_AUTH')
    expect(SCHEDULED_DELETION_VIEW_PURPOSE).toBe('scheduled_deletion_view')
    expect(SCHEDULED_DELETION_VIEW_TTL_SECONDS).toBe(60 * 24 * 60 * 60)
    expect(REMINDER_TEMPLATE_CODES.t0).toBe('scheduled_deletion_confirm_t0')
    expect(REMINDER_TEMPLATE_CODES.tminus7).toBe('scheduled_deletion_reminder_tminus7')
    expect(REMINDER_TEMPLATE_CODES.tminus1).toBe('scheduled_deletion_reminder_tminus1')
  })
})
