/**
 * Real-Postgres coverage for BE-BLOCKER-22:
 * two-person cast-vote for account recovery + 410 on legacy approve/reject.
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
import { createAgencyWithOwner } from './tenant-authorization.js'
import { findOne, insert, query } from './db.js'

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
  if (platformAdmin) await updatePlatformRole(userId, 'platform_admin')
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: 0,
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

finPostgresSuite('account-recovery cast-vote (BE-BLOCKER-22)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'be-blocker-22-test-secret'
    process.env.NODE_ENV = 'test'
    ;({ app } = await import('./server.js'))
  })

  it('migration 329 is idempotent and adds vote columns', async () => {
    const sql = await readFile(join(migrationsDir, '329_account_recovery_cast_vote.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const cols = await pool().query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'account_recovery_cases'
          AND column_name IN (
            'first_vote_reviewer_id', 'first_vote', 'first_vote_at', 'first_vote_notes',
            'approval_request_id', 'escalation_approval_request_id',
            'account_value_tier', 'requires_two_person'
          )
        ORDER BY column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'account_value_tier',
      'approval_request_id',
      'escalation_approval_request_id',
      'first_vote',
      'first_vote_at',
      'first_vote_notes',
      'first_vote_reviewer_id',
      'requires_two_person',
    ])
  })

  it('legacy /approve returns 410 Gone with migrate_to guidance', async () => {
    const pa = await agentAccount('PA Approve Gone', { platformAdmin: true })
    const target = await agentAccount('Target Approve Gone')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/approve`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ notes: 'should be gone' })

    expect(res.status).toBe(410)
    expect(res.body.code).toBe('GONE')
    expect(res.body.migrate_to).toBe('POST /api/admin/account-recovery/:caseId/cast-vote')
    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('pending_review')
  })

  it('legacy /reject returns 410 Gone with migrate_to guidance', async () => {
    const pa = await agentAccount('PA Reject Gone', { platformAdmin: true })
    const target = await agentAccount('Target Reject Gone')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/reject`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ notes: 'should be gone' })

    expect(res.status).toBe(410)
    expect(res.body.code).toBe('GONE')
    expect(res.body.migrate_to).toContain('cast-vote')
  })

  it('non-two-person cast-vote approve issues token and marks approved', async () => {
    const pa = await agentAccount('PA Standard Approve', { platformAdmin: true })
    const target = await agentAccount('Standard Applicant')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ vote: 'approve', notes: 'looks fine' })

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.status).toBe('approved')
    expect(res.body.requires_two_person).toBe(false)
    expect(res.body._dev_recovery_token).toBeTruthy()

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('approved')
    expect(row.approved_by).toBe(pa.userId)

    const tokens = await query(
      `SELECT status, type FROM public.auth_recovery_tokens WHERE case_id = $1`,
      [caseId],
    )
    expect(tokens.some((t) => t.type === 'account_recovery' && t.status === 'issued')).toBe(true)
  })

  it('high-value: first vote records only; second distinct matching approve commits + issues token', async () => {
    const pa1 = await agentAccount('PA High1', { platformAdmin: true })
    const pa2 = await agentAccount('PA High2', { platformAdmin: true })
    // Platform-admin applicant → high_value / requires_two_person
    const target = await agentAccount('High Value PA Applicant', { platformAdmin: true })
    const caseId = await openRecoveryCase(target)

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve', notes: 'first look ok' })

    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.awaiting_second_vote).toBe(true)
    expect(first.body.requires_two_person).toBe(true)
    expect(first.body._dev_recovery_token).toBeFalsy()
    expect(first.body.approval_request_id).toBeTruthy()

    let row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('pending_review')
    expect(row.first_vote).toBe('approve')
    expect(row.first_vote_reviewer_id).toBe(pa1.userId)
    expect(row.requires_two_person).toBe(true)

    const tokensAfterFirst = await query(
      `SELECT id FROM public.auth_recovery_tokens WHERE case_id = $1 AND status = 'issued'`,
      [caseId],
    )
    expect(tokensAfterFirst).toHaveLength(0)

    const actionsAfterFirst = await pool().query(
      `SELECT decision, actor_id FROM fin.approval_actions WHERE request_id = $1`,
      [first.body.approval_request_id],
    )
    expect(actionsAfterFirst.rows).toHaveLength(1)
    expect(actionsAfterFirst.rows[0].decision).toBe('APPROVED')

    const second = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .send({ vote: 'approve', notes: 'second confirms' })

    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.status).toBe('approved')
    expect(second.body._dev_recovery_token).toBeTruthy()

    row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('approved')
    expect(row.second_vote_reviewer_id).toBe(pa2.userId)

    const approval = await pool().query(
      `SELECT status FROM fin.approval_requests WHERE id = $1`,
      [first.body.approval_request_id],
    )
    expect(approval.rows[0].status).toBe('EXECUTED')
  })

  it('same reviewer second vote is rejected with SAME_REVIEWER', async () => {
    const pa1 = await agentAccount('PA Same Reviewer', { platformAdmin: true })
    const target = await agentAccount('Same Reviewer Target', { platformAdmin: true })
    const caseId = await openRecoveryCase(target)

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve' })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve' })

    expect(second.status).toBe(409)
    expect(second.body.code).toBe('SAME_REVIEWER')

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('pending_review')
  })

  it('own-case vote returns 403', async () => {
    const pa = await agentAccount('PA Own Case', { platformAdmin: true })
    const caseId = await openRecoveryCase(pa)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ vote: 'approve' })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('OWN_CASE')
  })

  it('disagreeing votes return 409 + escalation_case_id and do not execute', async () => {
    const pa1 = await agentAccount('PA Disagree1', { platformAdmin: true })
    const pa2 = await agentAccount('PA Disagree2', { platformAdmin: true })
    const target = await agentAccount('Disagree Target', { platformAdmin: true })
    const caseId = await openRecoveryCase(target)

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .send({ vote: 'approve', notes: 'approve' })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .send({ vote: 'reject', notes: 'reject' })

    expect(second.status).toBe(409)
    expect(second.body.code).toBe('VOTE_DISAGREEMENT')
    expect(second.body.escalation_case_id).toBeTruthy()

    const row = await findOne('account_recovery_cases', (c) => c.id === caseId)
    expect(row.status).toBe('pending_review')
    expect(row.escalation_approval_request_id).toBe(second.body.escalation_case_id)

    const tokens = await query(
      `SELECT id FROM public.auth_recovery_tokens WHERE case_id = $1 AND status = 'issued'`,
      [caseId],
    )
    expect(tokens).toHaveLength(0)

    const escalation = await pool().query(
      `SELECT status, action_kind, payload FROM fin.approval_requests WHERE id = $1`,
      [second.body.escalation_case_id],
    )
    expect(escalation.rows[0].status).toBe('REQUESTED')
    expect(escalation.rows[0].action_kind).toBe('PLATFORM_ADMIN_RECOVERY')
    expect(escalation.rows[0].payload?.kind).toBe('account_recovery_vote_disagreement')
  })

  it('agency owner without readable plan defaults to requires_two_person', async () => {
    const pa = await agentAccount('PA Uncertain Owner', { platformAdmin: true })
    const owner = await agentAccount('Uncertain Agency Owner')
    // Membership without a subscription join path → fail closed to high_value.
    // createAgencyWithOwner provisions free-tier; strip the subscription to simulate uncertainty.
    const agencyId = randomUUID()
    await createAgencyWithOwner({
      agency: { id: agencyId, name: 'Uncertain Co', slug: `unc-${agencyId.slice(0, 8)}` },
      ownerUserId: owner.userId,
    })
    await pool().query(
      `DELETE FROM public.tenant_subscriptions
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.credit_wallets
           WHERE scope = 'agency' AND scope_id = $1
        )`,
      [agencyId],
    )

    const caseId = await openRecoveryCase(owner)
    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ vote: 'approve' })

    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.requires_two_person).toBe(true)
    expect(first.body.awaiting_second_vote).toBe(true)
  })

  it('non-admin cast-vote is forbidden', async () => {
    const agent = await agentAccount('Not Admin')
    const target = await agentAccount('Someone')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ vote: 'approve' })

    expect(res.status).toBe(403)
  })
})
