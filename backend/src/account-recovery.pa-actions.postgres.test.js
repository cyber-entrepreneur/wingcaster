/**
 * Real-Postgres coverage for BE-BLOCKER-21 Agent 5:
 * request-info, cancel-info-request, undo-approve, withdraw-vote.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount, updatePlatformRole } from './identity.js'
import { signToken } from './auth.js'
import { findOne, insert, query, update } from './db.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'persistence/migrations')

async function agentAccount(label = 'Agent', { platformAdmin = false } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${userId}@x.test`
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

async function openRecoveryCase({ userId, email, status = 'pending_review' } = {}) {
  const id = randomUUID()
  await insert('account_recovery_cases', {
    id,
    user_id: userId,
    email,
    status,
    reason: 'lost access to email inbox permanently',
    preferred_channel: 'email',
    contact: email,
    created_at: new Date().toISOString(),
  })
  return id
}

finPostgresSuite('account-recovery PA actions (BE-BLOCKER-21 Agent 5)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'be-blocker-21-actions-test-secret'
    process.env.NODE_ENV = 'test'
    ;({ app } = await import('./server.js'))
  })

  it('migration 333 is idempotent and adds info-request columns', async () => {
    const sql = await readFile(join(migrationsDir, '333_account_recovery_pa_actions.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const cols = await pool().query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'account_recovery_cases'
          AND column_name IN (
            'requested_evidence', 'info_requested_at', 'info_requested_by',
            'info_request_reason_code', 'info_request_notes',
            'info_request_canceled_at', 'info_request_canceled_by'
          )
        ORDER BY column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'info_request_canceled_at',
      'info_request_canceled_by',
      'info_request_notes',
      'info_request_reason_code',
      'info_requested_at',
      'info_requested_by',
      'requested_evidence',
    ])
  })

  it('request-info happy path → awaiting_info + persists evidence', async () => {
    const pa = await agentAccount('PA Request Info', { platformAdmin: true })
    const target = await agentAccount('Request Info Applicant')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/request-info`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({
        reason_code: 'missing_government_id',
        notes: 'Please attach both sides of your Emirates ID',
        requested_evidence: ['id_front', 'id_back', 'selfie_holding_id'],
      })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.status).toBe('awaiting_info')
    expect(res.body.requested_evidence).toEqual(['id_front', 'id_back', 'selfie_holding_id'])

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('awaiting_info')
    expect(row.info_requested_by).toBe(pa.userId)
    expect(row.info_request_reason_code).toBe('missing_government_id')
    expect(row.requested_evidence).toEqual(['id_front', 'id_back', 'selfie_holding_id'])
    expect(row.info_request_notes).toContain('Emirates ID')
  })

  it('request-info rejects invalid evidence enum', async () => {
    const pa = await agentAccount('PA Bad Evidence', { platformAdmin: true })
    const target = await agentAccount('Bad Evidence Applicant')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/request-info`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({
        reason_code: 'other',
        requested_evidence: ['passport_scan'],
      })

    expect(res.status).toBe(400)
  })

  it('request-info own-case is 403', async () => {
    const pa = await agentAccount('PA Own Info', { platformAdmin: true })
    const caseId = await openRecoveryCase(pa)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/request-info`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({
        reason_code: 'selfie_required',
        requested_evidence: ['selfie_holding_id'],
      })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('OWN_CASE')
  })

  it('cancel-info-request returns case to pending_review', async () => {
    const pa = await agentAccount('PA Cancel Info', { platformAdmin: true })
    const target = await agentAccount('Cancel Info Applicant')
    const caseId = await openRecoveryCase(target)

    const requested = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/request-info`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({
        reason_code: 'tenancy_record_required',
        requested_evidence: ['tenancy_record'],
      })
    expect(requested.status).toBe(200)

    const canceled = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cancel-info-request`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({})

    expect(canceled.status, JSON.stringify(canceled.body)).toBe(200)
    expect(canceled.body.status).toBe('pending_review')

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('pending_review')
    expect(row.info_request_canceled_by).toBe(pa.userId)
    expect(row.info_request_canceled_at).toBeTruthy()
  })

  it('undo-approve happy path revokes issued token and returns pending_review', async () => {
    const pa = await agentAccount('PA Undo Approve', { platformAdmin: true })
    const target = await agentAccount('Undo Applicant')
    const caseId = await openRecoveryCase(target)

    const approved = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ vote: 'approve', notes: 'ok' })
    expect(approved.status).toBe(200)
    expect(approved.body._dev_recovery_token).toBeTruthy()

    const tokensBefore = await query(
      `SELECT status FROM public.auth_recovery_tokens WHERE case_id = $1 AND status = 'issued'`,
      [caseId],
    )
    expect(tokensBefore.length).toBeGreaterThan(0)

    const undone = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/undo-approve`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({})

    expect(undone.status, JSON.stringify(undone.body)).toBe(200)
    expect(undone.body.status).toBe('pending_review')

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('pending_review')
    expect(row.approved_by == null).toBe(true)

    const issued = await query(
      `SELECT id FROM public.auth_recovery_tokens WHERE case_id = $1 AND status = 'issued'`,
      [caseId],
    )
    expect(issued).toHaveLength(0)

    const revoked = await query(
      `SELECT status, data->>'revoked_reason' AS revoked_reason
         FROM public.auth_recovery_tokens
        WHERE case_id = $1 AND status = 'revoked'`,
      [caseId],
    )
    expect(revoked.length).toBeGreaterThan(0)
    expect(revoked[0].revoked_reason).toBe('undo_approve')
  })

  it('undo-approve returns 409 when recovery token already used', async () => {
    const pa = await agentAccount('PA Undo Blocked', { platformAdmin: true })
    const target = await agentAccount('Used Token Applicant')
    const caseId = await openRecoveryCase(target)

    const approved = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ vote: 'approve' })
    expect(approved.status).toBe(200)

    const issued = await query(
      `SELECT id FROM public.auth_recovery_tokens WHERE case_id = $1 AND status = 'issued' LIMIT 1`,
      [caseId],
    )
    expect(issued.length).toBe(1)
    await update('auth_recovery_tokens', (r) => r.id === issued[0].id, (r) => ({
      ...r,
      status: 'used',
      used_at: new Date().toISOString(),
    }))

    const undone = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/undo-approve`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({})

    expect(undone.status).toBe(409)
    expect(undone.body.code).toBe('TOKEN_CONSUMED')

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('approved')
  })

  it('withdraw-vote: first reviewer clears first_vote + cancels approval_request', async () => {
    const pa1 = await agentAccount('PA Withdraw1', { platformAdmin: true })
    const pa2 = await agentAccount('PA Withdraw2', { platformAdmin: true })
    const target = await agentAccount('High Value Withdraw Target', { platformAdmin: true })
    const caseId = await openRecoveryCase(target)

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve', notes: 'first look' })
    expect(first.status).toBe(200)
    expect(first.body.awaiting_second_vote).toBe(true)
    const approvalId = first.body.approval_request_id
    expect(approvalId).toBeTruthy()

    const withdrawn = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/withdraw-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({})

    expect(withdrawn.status, JSON.stringify(withdrawn.body)).toBe(200)
    expect(withdrawn.body.status).toBe('pending_review')

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.first_vote).toBeFalsy()
    expect(row.first_vote_reviewer_id).toBeFalsy()
    expect(row.approval_request_id).toBeFalsy()

    const approval = await pool().query(
      `SELECT status FROM fin.approval_requests WHERE id = $1`,
      [approvalId],
    )
    expect(approval.rows[0].status).toBe('CANCELED')

    // After withdraw, a different PA can cast a fresh first vote.
    const again = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .send({ vote: 'reject' })
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(again.body.awaiting_second_vote).toBe(true)
  })

  it('withdraw-vote: non-first voter is forbidden', async () => {
    const pa1 = await agentAccount('PA First Only', { platformAdmin: true })
    const pa2 = await agentAccount('PA Not First', { platformAdmin: true })
    const target = await agentAccount('Not First Target', { platformAdmin: true })
    const caseId = await openRecoveryCase(target)

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve' })
    expect(first.status).toBe(200)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/withdraw-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .send({})

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('NOT_FIRST_VOTER')
  })

  it('withdraw-vote: 409 when second vote already cast (escalation path)', async () => {
    const pa1 = await agentAccount('PA Esc1', { platformAdmin: true })
    const pa2 = await agentAccount('PA Esc2', { platformAdmin: true })
    const target = await agentAccount('Esc Target', { platformAdmin: true })
    const caseId = await openRecoveryCase(target)

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve' })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .send({ vote: 'reject' })
    expect(second.status).toBe(409)
    expect(second.body.code).toBe('VOTE_DISAGREEMENT')

    const withdraw = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/withdraw-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({})

    expect(withdraw.status).toBe(409)
    expect(['SECOND_VOTE_CAST', 'ALREADY_ESCALATED']).toContain(withdraw.body.code)
  })

  it('withdraw-vote: 409 when case already finalized (approved)', async () => {
    const pa = await agentAccount('PA Finalized Withdraw', { platformAdmin: true })
    const target = await agentAccount('Finalized Applicant')
    const caseId = await openRecoveryCase(target)

    const approved = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ vote: 'approve' })
    expect(approved.status).toBe(200)

    const withdraw = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/withdraw-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({})

    expect(withdraw.status).toBe(409)
    expect(withdraw.body.code).toBe('CASE_FINALIZED')
  })

  it('non-admin cannot call PA action endpoints', async () => {
    const agent = await agentAccount('Not PA')
    const target = await agentAccount('Someone Else')
    const caseId = await openRecoveryCase(target)

    for (const path of [
      'request-info',
      'cancel-info-request',
      'undo-approve',
      'withdraw-vote',
    ]) {
      const res = await request(app)
        .post(`/api/admin/account-recovery/${caseId}/${path}`)
        .set('Authorization', `Bearer ${agent.token}`)
        .send(path === 'request-info'
          ? { reason_code: 'other', requested_evidence: ['other'] }
          : {})
      expect(res.status, path).toBe(403)
    }
  })
})
