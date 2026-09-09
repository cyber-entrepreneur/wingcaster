/**
 * Real-Postgres coverage for BE-BLOCKER-21 core endpoints:
 * list shape/pagination/filters, single GET, reveal-audit + 429 rate limit.
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
import { findOne, insert, query } from './db.js'
import { REVEAL_RATE_LIMIT_PER_HOUR } from './account-recovery/reveal-audit.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'persistence/migrations')

async function agentAccount(label = 'Agent', {
  platformAdmin = false,
  phone = null,
  emailDomain = 'x.test',
} = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${userId}@${emailDomain}`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: label,
      phone,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: label, phone },
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
  return { userId, token, email, phone }
}

async function openRecoveryCase({
  userId,
  email,
  status = 'pending_review',
  preferredChannel = 'email',
  contact = null,
  reason = 'lost access to email inbox permanently',
  createdAt = null,
  accountValueTier = null,
  requiresTwoPerson = null,
  requestedIp = '185.104.212.44',
} = {}) {
  const id = randomUUID()
  const row = {
    id,
    user_id: userId,
    email,
    status,
    reason,
    preferred_channel: preferredChannel,
    contact: contact || email,
    requested_ip: requestedIp,
    requested_user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    created_at: createdAt || new Date().toISOString(),
  }
  if (accountValueTier) row.account_value_tier = accountValueTier
  if (requiresTwoPerson != null) row.requires_two_person = requiresTwoPerson
  await insert('account_recovery_cases', row)
  return id
}

finPostgresSuite('account-recovery list/detail/reveal (BE-BLOCKER-21)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'be-blocker-21-test-secret'
    process.env.NODE_ENV = 'test'
    ;({ app } = await import('./server.js'))
  })

  it('migration 330 is idempotent and creates reveal-audit table', async () => {
    const sql = await readFile(join(migrationsDir, '330_account_recovery_reveal_audit.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const cols = await pool().query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'account_recovery_reveal_audit'
          AND column_name IN ('case_id', 'reviewer_id', 'field', 'created_at')
        ORDER BY column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'case_id',
      'created_at',
      'field',
      'reviewer_id',
    ])
  })

  it('GET list returns cases/pagination/counts with filters and pageSize', async () => {
    const pa = await agentAccount('PA List Core', { platformAdmin: true })
    const a = await agentAccount('Applicant Alpha', { phone: '+971551111001' })
    const b = await agentAccount('Applicant Beta', { phone: '+961711111002' })
    const c = await agentAccount('Applicant Gamma', { phone: '+971551111003' })

    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    await openRecoveryCase({
      userId: a.userId,
      email: a.email,
      preferredChannel: 'whatsapp',
      contact: a.phone,
      accountValueTier: 'standard',
      requiresTwoPerson: false,
    })
    await openRecoveryCase({
      userId: b.userId,
      email: b.email,
      preferredChannel: 'email',
      contact: b.email,
      accountValueTier: 'high_value',
      requiresTwoPerson: true,
    })
    await openRecoveryCase({
      userId: c.userId,
      email: c.email,
      status: 'approved',
      preferredChannel: 'email',
      createdAt: old,
      accountValueTier: 'standard',
    })

    const res = await request(app)
      .get('/api/admin/account-recovery')
      .query({ status: 'pending_review', within: '7d', page: 1, pageSize: 1, sort: 'submitted_at:desc' })
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body).toHaveProperty('cases')
    expect(res.body).toHaveProperty('pagination')
    expect(res.body).toHaveProperty('counts')
    expect(Array.isArray(res.body.cases)).toBe(true)
    expect(res.body.cases).toHaveLength(1)
    expect(res.body.pagination).toMatchObject({
      page: 1,
      page_size: 1,
      has_next: true,
    })
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2)
    expect(res.body.counts.pending_review).toBeGreaterThanOrEqual(2)
    expect(res.body.counts.high_value_awaiting_two_person).toBeGreaterThanOrEqual(1)

    const row = res.body.cases[0]
    expect(row).toHaveProperty('sla_hours_remaining')
    expect(row).toHaveProperty('sla_hours_total', 24)
    expect(row).toHaveProperty('account_value_tier')
    expect(row).toHaveProperty('requires_two_person')
    expect(row).toHaveProperty('is_own')
    expect(row).toHaveProperty('env', 'live')
    expect(row.evidence).toEqual({ file_count: 0, files: [] })
    expect(row.agent.email_masked).toBeTruthy()
    expect(row.agent.email_full).toBeTruthy()
    expect(row.agent.email_masked).not.toEqual(row.agent.email_full)

    const filtered = await request(app)
      .get('/api/admin/account-recovery')
      .query({ status: 'pending_review', channel: 'whatsapp', within: '7d', pageSize: 25 })
      .set('Authorization', `Bearer ${pa.token}`)

    expect(filtered.status).toBe(200)
    expect(filtered.body.cases.every((c) => c.preferred_channel === 'whatsapp')).toBe(true)

    const tierFiltered = await request(app)
      .get('/api/admin/account-recovery')
      .query({ status: 'pending_review', tier: 'high_value', within: 'all', pageSize: 50 })
      .set('Authorization', `Bearer ${pa.token}`)

    expect(tierFiltered.status).toBe(200)
    expect(tierFiltered.body.cases.length).toBeGreaterThanOrEqual(1)
    expect(tierFiltered.body.cases.every((c) => c.account_value_tier === 'high_value')).toBe(true)

    const search = await request(app)
      .get('/api/admin/account-recovery')
      .query({ status: 'pending_review', within: 'all', q: 'Alpha', pageSize: 50 })
      .set('Authorization', `Bearer ${pa.token}`)

    expect(search.status).toBe(200)
    expect(search.body.cases.some((c) => c.agent?.display_name_full?.includes('Alpha'))).toBe(true)
  })

  it('GET :caseId returns detail contract and 404 for missing', async () => {
    const pa = await agentAccount('PA Detail Core', { platformAdmin: true })
    const target = await agentAccount('Detail Applicant', { phone: '+961714567841' })
    const caseId = await openRecoveryCase({
      userId: target.userId,
      email: target.email,
      preferredChannel: 'whatsapp',
      contact: '+961714567841',
      reason: 'I received a phishing email compromising my account access path',
      accountValueTier: 'elevated',
      requiresTwoPerson: false,
    })

    const res = await request(app)
      .get(`/api/admin/account-recovery/${caseId}`)
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'live')

    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.id).toBe(caseId)
    expect(res.body.status).toBe('pending_review')
    expect(res.body.provided).toMatchObject({
      preferred_channel: 'whatsapp',
    })
    expect(res.body.provided.contact_masked).toBeTruthy()
    expect(res.body.provided.contact_full).toBe('+961714567841')
    expect(res.body.on_file.email_full).toBe(target.email)
    expect(res.body.on_file.email_masked).not.toEqual(target.email)
    expect(res.body.evidence).toEqual({ file_count: 0, files: [] })
    expect(Array.isArray(res.body.timeline)).toBe(true)
    expect(res.body.account_value_tier).toBe('elevated')
    expect(res.body.requires_two_person).toBe(false)
    expect(res.body.first_vote).toBeNull()
    expect(res.body.current_reviewer).toMatchObject({
      id: pa.userId,
      is_first_reviewer_candidate: true,
    })
    expect(res.body.is_own).toBe(false)
    expect(res.body.env).toBe('live')

    const missing = await request(app)
      .get(`/api/admin/account-recovery/${randomUUID()}`)
      .set('Authorization', `Bearer ${pa.token}`)
    expect(missing.status).toBe(404)
    expect(missing.body.code).toBe('NOT_FOUND')
  })

  it('POST reveal-audit succeeds then 429 after 20/hour', async () => {
    const pa = await agentAccount('PA Reveal Core', { platformAdmin: true })
    const target = await agentAccount('Reveal Applicant')
    const caseId = await openRecoveryCase({ userId: target.userId, email: target.email })

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/reveal-audit`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ field: 'email' })

    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.success).toBe(true)
    expect(first.body.field).toBe('email')
    expect(first.body.remaining).toBe(REVEAL_RATE_LIMIT_PER_HOUR - 1)

    const stored = await findOne('account_recovery_reveal_audit', (r) => r.case_id === caseId)
    expect(stored).toBeTruthy()
    expect(stored.field).toBe('email')
    expect(stored.reviewer_id).toBe(pa.userId)

    // Seed 19 more within the hour so the next call is the 21st.
    for (let i = 0; i < REVEAL_RATE_LIMIT_PER_HOUR - 1; i += 1) {
      await insert('account_recovery_reveal_audit', {
        id: randomUUID(),
        case_id: caseId,
        reviewer_id: pa.userId,
        field: i % 2 === 0 ? 'phone' : 'ip',
        created_at: new Date().toISOString(),
      })
    }

    const limited = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/reveal-audit`)
      .set('Authorization', `Bearer ${pa.token}`)
      .send({ field: 'row' })

    expect(limited.status).toBe(429)
    expect(limited.body.code).toBe('RATE_LIMITED')

    const countRows = await query(
      `SELECT COUNT(*)::int AS n FROM public.account_recovery_reveal_audit WHERE reviewer_id = $1`,
      [pa.userId],
    )
    const n = Array.isArray(countRows) ? countRows[0]?.n : countRows?.rows?.[0]?.n
    expect(Number(n)).toBe(REVEAL_RATE_LIMIT_PER_HOUR)
  })

  it('rejects non-admin for list and reveal', async () => {
    const user = await agentAccount('Non Admin ACR')
    const target = await agentAccount('Target Non Admin ACR')
    const caseId = await openRecoveryCase({ userId: target.userId, email: target.email })

    const list = await request(app)
      .get('/api/admin/account-recovery')
      .set('Authorization', `Bearer ${user.token}`)
    expect(list.status).toBe(403)

    const reveal = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/reveal-audit`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ field: 'email' })
    expect(reveal.status).toBe(403)
  })
})
