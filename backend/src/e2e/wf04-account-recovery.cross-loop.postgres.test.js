/**
 * WF-04 Real-Postgres cross-loop (Wave 3 Agent 4).
 *
 * Lifecycle sketch:
 *   POST /api/auth/recovery/request (SHR-AUT-005)
 *   → GET /api/admin/account-recovery sees case (PA-ACR-001)
 *   → POST reveal-audit writes audit row (PIIMask unmask)
 *   → GET /api/admin/account-recovery/:caseId (PA-ACR-002)
 *   → POST cast-vote × two admins (approve OR reject OR disagree→escalation)
 *   → legacy /approve + /reject return 410 Gone
 *   → SHR-AUT-005d scheduled-deletion states via public token routes
 *
 * Skips when TEST_DATABASE_URL is unset (local without docker).
 */
import { createHmac, randomUUID } from 'node:crypto'
import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { finPostgresSuite } from '../fin/testing/suite.js'
import { createAgentAccount, updatePlatformRole } from '../identity.js'
import { signToken } from '../auth.js'
import { findOne, insert, query } from '../db.js'
import {
  issueScheduledDeletionViewToken,
  registerScheduledDeletionRoutes,
} from '../auth-scheduled-deletion.js'
import express from 'express'

async function agentAccount(label = 'Agent', { platformAdmin = false } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: label,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: label },
  })
  let tokenVersion = 0
  if (platformAdmin) {
    await updatePlatformRole(userId, 'platform_admin')
    tokenVersion = 1
  }
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: tokenVersion,
    verified_at: now,
  })
  return { userId, token, email }
}

async function seedScheduledDeletion({
  userId,
  scheduledFor,
  status = 'scheduled',
  cancelledAt = null,
  completedAt = null,
} = {}) {
  const id = randomUUID()
  const now = new Date().toISOString()
  await query(
    `INSERT INTO public.deletion_requests
      (id, user_id, status, scheduled_for, confirmed_at, cancelled_at, completed_at, reminders_sent, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::text[], $8, $8)`,
    [id, userId, status, scheduledFor, now, cancelledAt, completedAt, now],
  )
  return id
}

function craftExpiredToken({ deletionRequestId, userId }) {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me'
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    purpose: 'scheduled_deletion_view',
    deletion_request_id: deletionRequestId,
    user_id: userId,
    iat: now - 120,
    exp: now - 60,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

finPostgresSuite('WF-04 cross-loop account recovery (Wave 3 Agent 4)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'wf04-cross-loop-test-secret'
    process.env.NODE_ENV = 'test'
    ;({ app } = await import('../server.js'))
  }, 180_000)

  it('full loop: request → queue → reveal-audit → cast-vote approve (two PAs high_value)', async () => {
    const applicant = await agentAccount('WF04 High Applicant', { platformAdmin: true })
    const pa1 = await agentAccount('WF04 PA1', { platformAdmin: true })
    const pa2 = await agentAccount('WF04 PA2', { platformAdmin: true })

    const requestRes = await request(app)
      .post('/api/auth/recovery/request')
      .send({
        email: applicant.email,
        reason: 'Lost phone and backup codes after travel; need account recovery review.',
        preferred_channel: 'email',
        contact: applicant.email,
      })

    expect(requestRes.status, JSON.stringify(requestRes.body)).toBe(200)
    expect(requestRes.body.success).toBe(true)
    const caseId = requestRes.body._dev_case_id
    expect(caseId).toBeTruthy()

    const queue = await request(app)
      .get('/api/admin/account-recovery')
      .query({ status: 'pending_review', within: '7d' })
      .set('Authorization', `Bearer ${pa1.token}`)
      .set('X-Wingcaster-Env', 'live')

    expect(queue.status, JSON.stringify(queue.body)).toBe(200)
    expect(queue.body.cases.some((c) => c.id === caseId)).toBe(true)
    const listed = queue.body.cases.find((c) => c.id === caseId)
    expect(listed.status).toBe('pending_review')
    expect(listed.requires_two_person).toBe(true)

    const reveal = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/reveal-audit`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ field: 'email' })

    expect(reveal.status, JSON.stringify(reveal.body)).toBe(200)
    expect(reveal.body.success).toBe(true)
    const audit = await findOne('account_recovery_reveal_audit', (r) => r.case_id === caseId)
    expect(audit).toBeTruthy()
    expect(audit.field).toBe('email')
    expect(audit.reviewer_id).toBe(pa1.userId)

    const detail = await request(app)
      .get(`/api/admin/account-recovery/${caseId}`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .set('X-Wingcaster-Env', 'live')
    expect(detail.status).toBe(200)
    expect(detail.body.requires_two_person).toBe(true)
    expect(detail.body.is_own).toBe(false)

    // Legacy paths must stay gone — UI must never succeed against them.
    for (const legacy of ['approve', 'reject']) {
      const gone = await request(app)
        .post(`/api/admin/account-recovery/${caseId}/${legacy}`)
        .set('Authorization', `Bearer ${pa1.token}`)
        .send({ notes: 'should be gone' })
      expect(gone.status).toBe(410)
      expect(gone.body.code).toBe('GONE')
      expect(gone.body.migrate_to).toContain('cast-vote')
    }

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve', notes: 'evidence matches on-file identity' })
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.awaiting_second_vote).toBe(true)
    expect(first.body._dev_recovery_token).toBeFalsy()

    // Self-approval / same-reviewer rejected.
    const same = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve', notes: 'second try by same PA' })
    expect(same.status).toBe(409)
    expect(same.body.code).toBe('SAME_REVIEWER')

    const second = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .send({ vote: 'approve', notes: 'second PA confirms' })
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.status).toBe('approved')
    expect(second.body._dev_recovery_token).toBeTruthy()

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('approved')
  })

  it('reject path: request → queue → cast-vote reject outcome', async () => {
    const applicant = await agentAccount('WF04 Reject Applicant')
    const pa = await agentAccount('WF04 Reject PA', { platformAdmin: true })

    const requestRes = await request(app)
      .post('/api/auth/recovery/request')
      .send({
        email: applicant.email,
        reason: 'Cannot receive SMS OTP on the registered number anymore.',
        preferred_channel: 'email',
        contact: applicant.email,
      })
    expect(requestRes.status).toBe(200)
    const caseId = requestRes.body._dev_case_id
    expect(caseId).toBeTruthy()

    const queue = await request(app)
      .get('/api/admin/account-recovery')
      .query({ status: 'pending_review' })
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')
    expect(queue.body.cases.some((c) => c.id === caseId)).toBe(true)

    const reject = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({
        vote: 'reject',
        notes: 'Identity documents do not match the account owner on file.',
      })
    expect(reject.status, JSON.stringify(reject.body)).toBe(200)
    expect(reject.body.status).toBe('rejected')

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('rejected')
  })

  it('two-person disagree escalates; own-case vote forbidden', async () => {
    const pa1 = await agentAccount('WF04 Esc PA1', { platformAdmin: true })
    const pa2 = await agentAccount('WF04 Esc PA2', { platformAdmin: true })
    // High-value applicant (platform admin) forces two-person.
    const applicant = await agentAccount('WF04 Esc Applicant', { platformAdmin: true })

    const ownCase = await request(app)
      .post('/api/auth/recovery/request')
      .send({
        email: pa1.email,
        reason: 'Own-case attempt should be blocked at cast-vote.',
        preferred_channel: 'email',
        contact: pa1.email,
      })
    const ownCaseId = ownCase.body._dev_case_id
    expect(ownCaseId).toBeTruthy()

    const ownVote = await request(app)
      .post(`/api/admin/account-recovery/${ownCaseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve' })
    expect(ownVote.status).toBe(403)
    expect(ownVote.body.code).toBe('OWN_CASE')

    const requestRes = await request(app)
      .post('/api/auth/recovery/request')
      .send({
        email: applicant.email,
        reason: 'Need recovery after device wipe; disagreement path.',
        preferred_channel: 'email',
        contact: applicant.email,
      })
    const caseId = requestRes.body._dev_case_id

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve', notes: 'looks ok' })
    expect(first.status).toBe(200)

    const disagree = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .send({ vote: 'reject', notes: 'evidence insufficient' })
    expect(disagree.status).toBe(409)
    expect(disagree.body.code).toBe('VOTE_DISAGREEMENT')
    expect(disagree.body.escalation_case_id).toBeTruthy()

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('pending_review')
    expect(row.escalation_approval_request_id).toBe(disagree.body.escalation_case_id)

    const tokens = await query(
      `SELECT id FROM public.auth_recovery_tokens WHERE case_id = $1 AND status = 'issued'`,
      [caseId],
    )
    expect(tokens).toHaveLength(0)
  })

  it('SHR-AUT-005d: all 5 public scheduled-deletion states via token routes', async () => {
    // Use a mini app so we do not depend on server.js route registration order.
    const deletionApp = express()
    deletionApp.use(express.json())
    registerScheduledDeletionRoutes(deletionApp)

    const userPending = await agentAccount('Del Pending')
    const pendingId = await seedScheduledDeletion({
      userId: userPending.userId,
      scheduledFor: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled',
    })
    const pendingToken = issueScheduledDeletionViewToken({
      deletionRequestId: pendingId,
      userId: userPending.userId,
    })

    const pending = await request(deletionApp).get(
      `/api/auth/scheduled-deletion/${encodeURIComponent(pendingToken)}`,
    )
    expect(pending.status).toBe(200)
    expect(pending.body.status).toBe('scheduled')
    expect(pending.body.cancel_available).toBe(true)
    // VALID_PENDING

    const userCancelled = await agentAccount('Del Cancelled')
    const cancelledId = await seedScheduledDeletion({
      userId: userCancelled.userId,
      scheduledFor: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    })
    const cancelledToken = issueScheduledDeletionViewToken({
      deletionRequestId: cancelledId,
      userId: userCancelled.userId,
    })
    const cancelled = await request(deletionApp).get(
      `/api/auth/scheduled-deletion/${encodeURIComponent(cancelledToken)}`,
    )
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.status).toBe('cancelled')
    expect(cancelled.body.cancelled).toBe(true)
    // ALREADY_CANCELLED

    const userDeleted = await agentAccount('Del Deleted')
    const deletedId = await seedScheduledDeletion({
      userId: userDeleted.userId,
      scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
    const deletedToken = issueScheduledDeletionViewToken({
      deletionRequestId: deletedId,
      userId: userDeleted.userId,
    })
    const deleted = await request(deletionApp).get(
      `/api/auth/scheduled-deletion/${encodeURIComponent(deletedToken)}`,
    )
    expect(deleted.status).toBe(200)
    expect(deleted.body.status).toBe('completed')
    // ALREADY_DELETED

    const invalid = await request(deletionApp).get(
      '/api/auth/scheduled-deletion/not-a-real-token',
    )
    expect([401, 400]).toContain(invalid.status)
    // INVALID_TOKEN

    const expiredToken = craftExpiredToken({
      deletionRequestId: pendingId,
      userId: userPending.userId,
    })
    const expired = await request(deletionApp).get(
      `/api/auth/scheduled-deletion/${encodeURIComponent(expiredToken)}`,
    )
    expect(expired.status).toBe(410)
    expect(expired.body.code).toMatch(/expired/i)
    // EXPIRED_TOKEN

    // pool touch keeps suite wiring honest
    expect(pool()).toBeTruthy()
  })
})
