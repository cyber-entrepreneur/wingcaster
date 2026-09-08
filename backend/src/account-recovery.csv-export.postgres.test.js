/**
 * Real-Postgres coverage for BE-BLOCKER-21 / [BE-ACR-08]:
 * masked CSV export + unmasked export elevation gate + bulk-reveal audit.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount, updatePlatformRole } from './identity.js'
import { signElevatedToken, signToken } from './auth.js'
import { insert } from './db.js'
import { ACR_CSV_COLUMNS, ACR_CSV_PII_FIELDS, maskEmail } from './account-recovery/csv-export.js'

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
  return { userId, token, email, tokenVersion }
}

async function openRecoveryCase({ userId, email, status = 'pending_review', extras = {} } = {}) {
  const id = randomUUID()
  await insert('account_recovery_cases', {
    id,
    user_id: userId,
    email,
    status,
    reason: 'lost access to email inbox permanently',
    preferred_channel: 'email',
    contact: email,
    requested_ip: '185.104.12.34',
    created_at: new Date().toISOString(),
    ...extras,
  })
  return id
}

finPostgresSuite('account-recovery CSV export (BE-ACR-08)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'be-acr-08-test-secret'
    process.env.NODE_ENV = 'test'
    const sql = await readFile(join(migrationsDir, '334_account_recovery_export_audit.sql'), 'utf8')
    await pool().query(sql)
    ;({ app } = await import('./server.js'))
  })

  it('migration 334 is idempotent and creates export audit table', async () => {
    const sql = await readFile(join(migrationsDir, '334_account_recovery_export_audit.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const table = await pool().query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'account_recovery_export_audits'`,
    )
    expect(table.rows).toHaveLength(1)
  })

  it('masked CSV returns masked PII columns without elevation', async () => {
    const pa = await agentAccount('PA Masked Export', { platformAdmin: true })
    const target = await agentAccount('Applicant Masked Export')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .get('/api/admin/account-recovery.csv')
      .query({ status: 'pending_review', mask: 'true', within: 'all' })
      .set('Authorization', `Bearer ${pa.token}`)

    expect(res.status, res.text?.slice?.(0, 400)).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/account-recovery-masked/)
    expect(res.headers['x-account-recovery-export-masked']).toBe('true')

    const lines = res.text.trim().split('\n')
    expect(lines[0]).toBe(ACR_CSV_COLUMNS.join(','))
    const dataLine = lines.find((line) => line.startsWith(caseId))
    expect(dataLine).toBeTruthy()
    expect(dataLine).not.toContain(target.email)
    expect(dataLine).toContain(maskEmail(target.email))
    expect(dataLine).not.toContain('185.104.12.34')
    expect(dataLine).toContain('185.104.XXX.XXX')

    const audits = await pool().query(
      `SELECT id FROM public.account_recovery_export_audits WHERE exported_by = $1`,
      [pa.userId],
    )
    expect(audits.rows).toHaveLength(0)
  })

  it('unmasked CSV without elevation returns 401 step_up_required', async () => {
    const pa = await agentAccount('PA Unmasked Blocked', { platformAdmin: true })
    await openRecoveryCase(await agentAccount('Target Unmasked Blocked'))

    const res = await request(app)
      .get('/api/admin/account-recovery.csv')
      .query({ mask: 'false', within: 'all' })
      .set('Authorization', `Bearer ${pa.token}`)

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('step_up_required')
  })

  it('unmasked CSV with elevation returns PII and writes bulk-reveal audit', async () => {
    const pa = await agentAccount('PA Unmasked Allowed', { platformAdmin: true })
    const target = await agentAccount('Target Unmasked Allowed')
    const caseId = await openRecoveryCase(target)
    const elevated = signElevatedToken({
      userId: pa.userId,
      tokenVersion: pa.tokenVersion,
    })

    const res = await request(app)
      .get('/api/admin/account-recovery.csv')
      .query({ mask: 'false', within: 'all', status: 'pending_review' })
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Elevated-Token', elevated)

    expect(res.status, res.text?.slice?.(0, 400)).toBe(200)
    expect(res.headers['x-account-recovery-export-masked']).toBe('false')
    expect(res.headers['content-disposition']).toMatch(/account-recovery-pii/)
    expect(res.text).toContain(target.email)
    expect(res.text).toContain('185.104.12.34')
    expect(res.text).toContain(caseId)

    const exportAudit = await pool().query(
      `SELECT case_ids, fields_exported, masked, row_count
         FROM public.account_recovery_export_audits
        WHERE exported_by = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [pa.userId],
    )
    expect(exportAudit.rows).toHaveLength(1)
    expect(exportAudit.rows[0].masked).toBe(false)
    expect(exportAudit.rows[0].case_ids).toContain(caseId)
    expect(exportAudit.rows[0].fields_exported).toEqual(expect.arrayContaining([...ACR_CSV_PII_FIELDS]))
    expect(exportAudit.rows[0].row_count).toBeGreaterThanOrEqual(1)

    const auditLog = await pool().query(
      `SELECT action, metadata FROM public.audit_log
        WHERE agent_id = $1 AND action = 'pa_pii_bulk_revealed'
        ORDER BY created_at DESC LIMIT 1`,
      [pa.userId],
    )
    expect(auditLog.rows).toHaveLength(1)
    expect(auditLog.rows[0].metadata?.case_ids).toContain(caseId)
    expect(auditLog.rows[0].metadata?.fields_exported).toEqual(
      expect.arrayContaining([...ACR_CSV_PII_FIELDS]),
    )
  })

  it('non-admin cannot export CSV', async () => {
    const agent = await agentAccount('Not Admin Export')
    const res = await request(app)
      .get('/api/admin/account-recovery.csv')
      .query({ within: 'all' })
      .set('Authorization', `Bearer ${agent.token}`)
    expect(res.status).toBe(403)
  })

  it('default mask is true when mask query omitted', async () => {
    const pa = await agentAccount('PA Default Mask', { platformAdmin: true })
    const target = await agentAccount('Default Mask Target')
    await openRecoveryCase(target)

    const res = await request(app)
      .get('/api/admin/account-recovery.csv')
      .query({ within: 'all', status: 'pending_review' })
      .set('Authorization', `Bearer ${pa.token}`)

    expect(res.status).toBe(200)
    expect(res.headers['x-account-recovery-export-masked']).toBe('true')
    expect(res.text).not.toContain(target.email)
  })
})
