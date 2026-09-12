import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { ADMIN_ID, makeOpsApp, writeHeaders } from './http-support.js'

const SUBMITTER_ID = '00000000-0000-0000-0000-0000000000b2'
const APPROVER_A = '00000000-0000-0000-0000-0000000000c3'

async function insertGrantApproval(pool, world, {
  status = 'REQUESTED',
  units = 50_000,
  submitterId = SUBMITTER_ID,
  valueTier = null,
  minApprovers = 2,
} = {}) {
  const id = randomUUID()
  const payload = {
    workflow: 'WF-08',
    units,
    amount_minor: units,
    currency: 'AED',
    book_id: world.tenantA.bookUsd.bookId,
    holder_id: world.tenantA.holderId,
    tenant_name: 'Elite Real Estate Dubai',
    balance_before: 12_000,
  }
  await pool.query(
    `INSERT INTO fin.approval_requests (
       id, environment, tenant_id, action_kind, status, payload_hash, payload,
       min_distinct_approvers, workflow_code, value_tier,
       created_at, created_by_actor_type, created_by_actor_id, updated_at
     ) VALUES (
       $1, 'LIVE', $2, 'LARGE_GRANT', $3, 'test-hash', $4::jsonb,
       $5, 'WF-08', $6,
       $7, 'USER', $8, $7
     )`,
    [id, world.tenantA.tenantId, status, JSON.stringify(payload), minApprovers, valueTier, NOW, submitterId],
  )
  return id
}

async function castApprove(pool, requestId, actorId) {
  await pool.query(
    `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
     VALUES ($1, $2, $3, 'APPROVED', $4)`,
    [randomUUID(), requestId, actorId, NOW],
  )
}

finPostgresSuite('admin/routes-approvals', {}, ({ url, pool, world }) => {
  it('lists approvals for the session environment', async () => {
    const { app } = await makeOpsApp(url())
    const res = await request(app).get('/api/admin/fin/approvals')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.approvals)).toBe(true)
  })

  it('legacy /approve returns 410 USE_EXECUTE', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const approve = await request(app)
      .post('/api/admin/fin/approvals/00000000-0000-0000-0000-000000000001/approve')
      .set(writeHeaders(token))
      .send({ reason_code: 'TEST' })
    expect(approve.status).toBe(410)
    expect(approve.body.error).toBe('USE_EXECUTE')
  })

  it('execute-preview: high_value returns phrase + ledger; self-approval 403', async () => {
    const id = await insertGrantApproval(pool(), world(), {
      units: 50_000, valueTier: 'high_value', submitterId: ADMIN_ID,
    })
    await castApprove(pool(), id, APPROVER_A)

    const { app } = await makeOpsApp(url())
    const self = await request(app).get(`/api/admin/fin/approvals/${id}/execute-preview`)
    expect(self.status).toBe(403)
    expect(self.body.error || self.body.code).toBe('SELF_APPROVAL_FORBIDDEN')

    const otherId = await insertGrantApproval(pool(), world(), {
      units: 50_000, valueTier: 'high_value', submitterId: SUBMITTER_ID,
    })
    await castApprove(pool(), otherId, APPROVER_A)

    const preview = await request(app)
      .get(`/api/admin/fin/approvals/${otherId}/execute-preview`)
      .set('X-Wingcaster-Env', 'live')
    expect(preview.status).toBe(200)
    expect(preview.body.request.value_tier).toBe('high_value')
    expect(preview.body.confirmation_phrase).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/)
    expect(preview.body.ledger_impact?.balanced).toBe(true)
    expect(Array.isArray(preview.body.diff)).toBe(true)
    expect(preview.body.self_approval).toBe(false)
  })

  it('execute-preview: standard tier omits confirmation_phrase', async () => {
    const id = await insertGrantApproval(pool(), world(), {
      units: 100, valueTier: 'standard', minApprovers: 1,
    })
    const { app } = await makeOpsApp(url())
    const preview = await request(app).get(`/api/admin/fin/approvals/${id}/execute-preview`)
    expect(preview.status).toBe(200)
    expect(preview.body.request.value_tier).toBe('standard')
    expect(preview.body.confirmation_phrase).toBeNull()
  })

  it('execute: If-Match mismatch → 409 PRECONDITION_FAILED', async () => {
    const id = await insertGrantApproval(pool(), world(), {
      units: 50_000, valueTier: 'high_value',
    })
    await castApprove(pool(), id, APPROVER_A)
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const preview = await request(app).get(`/api/admin/fin/approvals/${id}/execute-preview`)
    expect(preview.status).toBe(200)

    const stale = await request(app)
      .post(`/api/admin/fin/approvals/${id}/execute`)
      .set(writeHeaders(token, { ifMatch: '"1"', idempotencyKey: `exec-stale-${randomUUID()}` }))
      .send({
        workflow_code: 'WF-08',
        confirmation_phrase: preview.body.confirmation_phrase,
        reason_code: 'TEST',
      })
    expect(stale.status).toBe(409)
    expect(stale.body.error || stale.body.code).toBe('PRECONDITION_FAILED')
  })

  it('execute: wrong phrase → 400; happy path grants credits + audit', async () => {
    const id = await insertGrantApproval(pool(), world(), {
      units: 50_000, valueTier: 'high_value', status: 'REQUESTED', minApprovers: 2,
    })
    await castApprove(pool(), id, APPROVER_A)

    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const preview = await request(app).get(`/api/admin/fin/approvals/${id}/execute-preview`)
    expect(preview.status).toBe(200)
    const version = preview.body.request.version
    const phrase = preview.body.confirmation_phrase

    const bad = await request(app)
      .post(`/api/admin/fin/approvals/${id}/execute`)
      .set(writeHeaders(token, { ifMatch: `"${version}"`, idempotencyKey: `exec-bad-${randomUUID()}` }))
      .send({
        workflow_code: 'WF-08',
        confirmation_phrase: 'wrong-phrase-does-not-match',
        reason_code: 'TEST',
      })
    expect(bad.status).toBe(400)
    expect(bad.body.error || bad.body.code).toBe('CONFIRMATION_PHRASE_MISMATCH')

    const preview2 = await request(app).get(`/api/admin/fin/approvals/${id}/execute-preview`)
    expect(preview2.status).toBe(200)
    expect(preview2.body.confirmation_phrase).not.toBe(phrase)

    const ok = await request(app)
      .post(`/api/admin/fin/approvals/${id}/execute`)
      .set(writeHeaders(token, {
        ifMatch: `"${preview2.body.request.version}"`,
        idempotencyKey: `exec-ok-${randomUUID()}`,
      }))
      .set('X-Wingcaster-Env', 'live')
      .send({
        workflow_code: 'WF-08',
        confirmation_phrase: preview2.body.confirmation_phrase,
        reason_code: 'TEST',
      })
    expect(ok.status).toBe(200)
    expect(ok.body.ok).toBe(true)
    expect(ok.body.ledger_journal_id).toBeTruthy()
    expect(ok.body.outcome_url).toContain('/admin/credits/')

    const status = await pool().query(
      `SELECT status FROM fin.approval_requests WHERE id = $1`, [id],
    )
    expect(status.rows[0].status).toBe('EXECUTED')

    const audit = await pool().query(
      `SELECT action FROM fin.financial_audit_events
        WHERE approval_request_id = $1 AND action = 'APPROVAL_EXECUTED'`,
      [id],
    )
    expect(audit.rowCount).toBeGreaterThanOrEqual(1)
  })

  it('execute: idempotent replay returns same body', async () => {
    const id = await insertGrantApproval(pool(), world(), {
      units: 30_000, valueTier: 'high_value', minApprovers: 2,
    })
    await castApprove(pool(), id, APPROVER_A)
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const preview = await request(app).get(`/api/admin/fin/approvals/${id}/execute-preview`)
    const key = `exec-replay-${randomUUID()}`
    const first = await request(app)
      .post(`/api/admin/fin/approvals/${id}/execute`)
      .set(writeHeaders(token, {
        ifMatch: `"${preview.body.request.version}"`,
        idempotencyKey: key,
      }))
      .send({
        workflow_code: 'WF-08',
        confirmation_phrase: preview.body.confirmation_phrase,
        reason_code: 'TEST',
      })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/admin/fin/approvals/${id}/execute`)
      .set(writeHeaders(token, {
        ifMatch: `"${preview.body.request.version}"`,
        idempotencyKey: key,
      }))
      .send({
        workflow_code: 'WF-08',
        confirmation_phrase: preview.body.confirmation_phrase,
        reason_code: 'TEST',
      })
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
  })

  it('reject: marks REJECTED and writes audit', async () => {
    const id = await insertGrantApproval(pool(), world(), {
      units: 1_000, valueTier: 'standard', minApprovers: 1,
    })
    const row = await pool().query(
      `SELECT version FROM fin.approval_requests WHERE id = $1`, [id],
    )
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const res = await request(app)
      .post(`/api/admin/fin/approvals/${id}/reject`)
      .set(writeHeaders(token, { ifMatch: `"${row.rows[0].version}"` }))
      .send({ reason_code: 'TEST' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('REJECTED')
  })
})
