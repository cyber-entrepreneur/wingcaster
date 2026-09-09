/**
 * Real-Postgres coverage for BE-BLOCKER-21:
 * [BE-ACR-03] evidence upload + [BE-ACR-11] authenticated proxy.
 */
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { beforeAll, afterAll, expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount, updatePlatformRole } from './identity.js'
import { signToken } from './auth.js'
import { findOne, findAll, insert } from './db.js'
import {
  createLocalEvidenceStorage,
  setEvidenceStorageForTests,
} from './account-recovery/evidence-storage.js'
import { listEvidenceForCase } from './account-recovery/evidence.js'

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

finPostgresSuite('account-recovery evidence (BE-BLOCKER-21)', { seed: false }, ({ pool }) => {
  let app
  let storageDir
  let jpegBytes

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'be-blocker-21-evidence-test-secret'
    process.env.NODE_ENV = 'test'
    storageDir = await mkdtemp(join(tmpdir(), 'acr-evidence-'))
    setEvidenceStorageForTests(createLocalEvidenceStorage({ rootDir: storageDir }))
    // Minimal valid JPEG (1x1 pixel)
    jpegBytes = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
      'base64',
    )
    ;({ app } = await import('./server.js'))
  })

  afterAll(async () => {
    if (storageDir) await rm(storageDir, { recursive: true, force: true }).catch(() => {})
  })

  it('migration 331 is idempotent and creates evidence table', async () => {
    const sql = await readFile(join(migrationsDir, '331_account_recovery_evidence.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const cols = await pool().query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'account_recovery_evidence_files'
          AND column_name IN (
            'id', 'case_id', 'filename', 'content_type', 'size_bytes',
            'storage_key', 'uploaded_at', 'uploaded_by_kind'
          )
        ORDER BY column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'case_id',
      'content_type',
      'filename',
      'id',
      'size_bytes',
      'storage_key',
      'uploaded_at',
      'uploaded_by_kind',
    ])
  })

  it('upload happy path stores private blob and returns metadata without URLs', async () => {
    const target = await agentAccount('Evidence Applicant')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/auth/recovery/${caseId}/evidence`)
      .attach('file', jpegBytes, { filename: 'id_front.jpg', contentType: 'image/jpeg' })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.evidence.id).toBeTruthy()
    expect(res.body.evidence.filename).toBe('id_front.jpg')
    expect(res.body.evidence.content_type).toBe('image/jpeg')
    expect(res.body.evidence.size_bytes).toBeGreaterThan(0)
    expect(res.body.evidence.uploaded_at).toBeTruthy()

    const leaked = JSON.stringify(res.body)
    expect(leaked).not.toMatch(/storage_key/i)
    expect(leaked).not.toMatch(/\/uploads\//i)
    expect(leaked).not.toMatch(/https?:\/\//i)
    expect(leaked).not.toMatch(/presigned/i)

    const listed = await listEvidenceForCase(caseId)
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(res.body.evidence.id)
    expect(listed[0]).not.toHaveProperty('storage_key')

    const row = await findOne(
      'account_recovery_evidence_files',
      (r) => r.id === res.body.evidence.id,
    )
    expect(row.storage_key).toBeTruthy()
    expect(row.case_id).toBe(caseId)
  })

  it('rejects upload for unknown case', async () => {
    const res = await request(app)
      .post(`/api/auth/recovery/${randomUUID()}/evidence`)
      .attach('file', jpegBytes, { filename: 'id.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })

  it('rejects upload when case is not accepting evidence', async () => {
    const target = await agentAccount('Closed Case Applicant')
    const caseId = await openRecoveryCase({ ...target, status: 'approved' })

    const res = await request(app)
      .post(`/api/auth/recovery/${caseId}/evidence`)
      .attach('file', jpegBytes, { filename: 'id.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CASE_CLOSED')
  })

  it('allows upload when case is awaiting_info', async () => {
    const target = await agentAccount('Awaiting Info Applicant')
    const caseId = await openRecoveryCase({ ...target, status: 'awaiting_info' })

    const res = await request(app)
      .post(`/api/auth/recovery/${caseId}/evidence`)
      .attach('file', Buffer.from('%PDF-1.4 minimal'), {
        filename: 'letter.pdf',
        contentType: 'application/pdf',
      })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.evidence.content_type).toBe('application/pdf')
  })

  it('rejects unsupported content type', async () => {
    const target = await agentAccount('Bad Type Applicant')
    const caseId = await openRecoveryCase(target)

    const res = await request(app)
      .post(`/api/auth/recovery/${caseId}/evidence`)
      .attach('file', Buffer.from('MZ exe'), {
        filename: 'malware.exe',
        contentType: 'application/octet-stream',
      })

    expect(res.status).toBe(415)
    expect(res.body.code).toBe('INVALID_TYPE')
  })

  it('PA proxy requires auth', async () => {
    const target = await agentAccount('Proxy Auth Applicant')
    const caseId = await openRecoveryCase(target)
    const up = await request(app)
      .post(`/api/auth/recovery/${caseId}/evidence`)
      .attach('file', jpegBytes, { filename: 'id.jpg', contentType: 'image/jpeg' })
    expect(up.status).toBe(201)
    const evidenceId = up.body.evidence.id

    const unauth = await request(app)
      .get(`/api/admin/account-recovery/${caseId}/evidence/${evidenceId}`)
    expect(unauth.status).toBe(401)

    const nonAdmin = await agentAccount('Regular Agent')
    const forbidden = await request(app)
      .get(`/api/admin/account-recovery/${caseId}/evidence/${evidenceId}`)
      .set('Authorization', `Bearer ${nonAdmin.token}`)
    expect(forbidden.status).toBe(403)
  })

  it('PA proxy returns bytes inline for images and audits access', async () => {
    const pa = await agentAccount('PA Evidence Viewer', { platformAdmin: true })
    const target = await agentAccount('Proxy Bytes Applicant')
    const caseId = await openRecoveryCase(target)

    const up = await request(app)
      .post(`/api/auth/recovery/${caseId}/evidence`)
      .attach('file', jpegBytes, { filename: 'selfie.jpg', contentType: 'image/jpeg' })
    expect(up.status).toBe(201)
    const evidenceId = up.body.evidence.id

    const res = await request(app)
      .get(`/api/admin/account-recovery/${caseId}/evidence/${evidenceId}`)
      .set('Authorization', `Bearer ${pa.token}`)
      .buffer(true)
      .parse((response, callback) => {
        const data = []
        response.on('data', (chunk) => data.push(chunk))
        response.on('end', () => callback(null, Buffer.concat(data)))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/jpeg/)
    expect(res.headers['content-disposition']).toMatch(/^inline;/i)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.length).toBe(jpegBytes.length)
    expect(res.body.equals(jpegBytes)).toBe(true)

    // Response body is binary — ensure no Location / redirect to public URL.
    expect(res.headers.location).toBeUndefined()
    expect(JSON.stringify(res.headers)).not.toMatch(/\/uploads\//i)

    const audits = await findAll(
      'activity_log',
      (a) => a.type === 'account_recovery_evidence_accessed'
        && a.meta?.evidence_id === evidenceId,
    )
    expect(audits.length).toBeGreaterThanOrEqual(1)
    expect(audits[0].agent_id).toBe(pa.userId)
    expect(audits[0].meta.case_id).toBe(caseId)
  })

  it('PA proxy uses attachment disposition when download=1', async () => {
    const pa = await agentAccount('PA Download Viewer', { platformAdmin: true })
    const target = await agentAccount('Download Applicant')
    const caseId = await openRecoveryCase(target)

    const up = await request(app)
      .post(`/api/auth/recovery/${caseId}/evidence`)
      .attach('file', jpegBytes, { filename: 'id_back.jpg', contentType: 'image/jpeg' })
    const evidenceId = up.body.evidence.id

    const res = await request(app)
      .get(`/api/admin/account-recovery/${caseId}/evidence/${evidenceId}?download=1`)
      .set('Authorization', `Bearer ${pa.token}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toMatch(/^attachment;/i)
  })
})
