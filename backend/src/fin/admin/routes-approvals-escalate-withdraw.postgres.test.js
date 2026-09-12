import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../testing/suite.js'
import { ADMIN_ID, makeOpsApp, writeHeaders } from './http-support.js'

const TARGET_ID = '00000000-0000-0000-0000-0000000000b2'
const OTHER_SUBMITTER = '00000000-0000-0000-0000-0000000000c3'

async function ensureUser(pool, { id, email, name, platformRole = 'platform_admin', outOfOffice = false }) {
  await pool.query(
    `INSERT INTO public.users (id, email, name, role, platform_role, data)
     VALUES ($1, $2, $3, 'agent', $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           platform_role = EXCLUDED.platform_role,
           data = EXCLUDED.data`,
    [id, email, name, platformRole, JSON.stringify({ out_of_office: outOfOffice })],
  )
}

async function insertOpenApproval(pool, {
  environment = 'LIVE',
  createdBy = OTHER_SUBMITTER,
  status = 'REQUESTED',
  subjectType = null,
  subjectId = null,
  actionKind = 'LARGE_GRANT',
} = {}) {
  const id = randomUUID()
  const now = new Date().toISOString()
  await pool.query(
    `INSERT INTO fin.approval_requests (
       id, environment, tenant_id, action_kind, status, subject_type, subject_id,
       payload_hash, created_at, created_by_actor_type, created_by_actor_id, updated_at
     ) VALUES (
       $1, $2, NULL, $3, $4, $5, $6,
       'be33-test', $7::timestamptz, 'USER', $8, $7::timestamptz
     )`,
    [id, environment, actionKind, status, subjectType, subjectId, now, createdBy],
  )
  return id
}

finPostgresSuite('admin/routes-approvals-escalate-withdraw', {}, ({ url, pool }) => {
  it('auth: escalate/withdraw require elevation; eligible-targets require admin', async () => {
    const approvalId = await insertOpenApproval(pool())
    const unauth = await makeOpsApp(url(), { authenticated: false })
    expect((await request(unauth.app).get(`/api/admin/fin/approvals/${approvalId}/eligible-escalation-targets`)).status)
      .toBe(401)

    const nonAdmin = await makeOpsApp(url(), { role: 'agent' })
    expect((await request(nonAdmin.app).get(`/api/admin/fin/approvals/${approvalId}/eligible-escalation-targets`)).status)
      .toBe(403)

    const { app } = await makeOpsApp(url())
    const unelevated = await request(app)
      .post(`/api/admin/fin/approvals/${approvalId}/escalate`)
      .set({ 'If-Match': '"1"', 'Idempotency-Key': `e-${randomUUID()}` })
      .send({
        reason_vocab: 'out_of_scope_authority',
        target_approver_id: TARGET_ID,
        notes: 'Needs a senior reviewer for this grant.',
        notify_channels: ['email'],
      })
    expect(unelevated.status).toBe(401)
    expect(unelevated.body.code).toBe('step_up_required')
  })

  it('withdraw: submitter-only → 403 SUBMITTER_ONLY for non-submitter', async () => {
    await ensureUser(pool(), { id: OTHER_SUBMITTER, email: 'submitter@example.test', name: 'Submitter' })
    const approvalId = await insertOpenApproval(pool(), { createdBy: OTHER_SUBMITTER })
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post(`/api/admin/fin/approvals/${approvalId}/withdraw`)
      .set(writeHeaders(elevate()))
      .send({ reason: 'I need to fix a mistake before resubmitting.' })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('SUBMITTER_ONLY')
  })

  it('withdraw: happy path → WITHDRAWN + entity DRAFT + audit', async () => {
    await ensureUser(pool(), { id: ADMIN_ID, email: 'admin@example.test', name: 'Admin' })
    const packageId = randomUUID()
    const versionId = randomUUID()
    const code = `be33-${packageId.slice(0, 8)}`

    await pool().query(
      `INSERT INTO public.product_packages (
         id, code, display_name, tier, target_audience, currency, billing_cadence, active, data
       ) VALUES ($1, $2, 'BE33 pkg', 'starter', 'agent', 'USD', 'monthly', true, '{}'::jsonb)`,
      [packageId, code],
    )
    await pool().query(
      `INSERT INTO public.product_package_versions (
         id, package_id, version_number, state, properties_covered, monthly_price_minor, data
       ) VALUES ($1, $2, 1, 'PENDING_APPROVAL', 10, 1000, '{}'::jsonb)`,
      [versionId, packageId],
    )

    const approvalId = await insertOpenApproval(pool(), {
      createdBy: ADMIN_ID,
      subjectType: 'product_package_versions',
      subjectId: versionId,
    })
    await pool().query(
      `UPDATE public.product_package_versions SET approval_request_id = $2 WHERE id = $1`,
      [versionId, approvalId],
    )

    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post(`/api/admin/fin/approvals/${approvalId}/withdraw`)
      .set(writeHeaders(elevate()))
      .send({ reason: 'Found a pricing typo — withdrawing to fix and resubmit.' })
    expect(res.status).toBe(200)
    expect(res.body.approval_request.status).toBe('WITHDRAWN')
    expect(res.body.approval_request.withdrawal_reason).toMatch(/pricing typo/)
    expect(res.body.entity).toMatchObject({ type: 'package_version', id: versionId, status: 'DRAFT' })

    const row = await pool().query(
      `SELECT status, withdrawn_by FROM fin.approval_requests WHERE id = $1`,
      [approvalId],
    )
    expect(row.rows[0].status).toBe('WITHDRAWN')
    expect(row.rows[0].withdrawn_by).toBe(ADMIN_ID)

    const version = await pool().query(
      `SELECT state, approval_request_id FROM public.product_package_versions WHERE id = $1`,
      [versionId],
    )
    expect(version.rows[0].state).toBe('DRAFT')
    expect(version.rows[0].approval_request_id).toBeNull()

    const audit = await pool().query(
      `SELECT action FROM fin.financial_audit_events
        WHERE approval_request_id = $1 AND action = 'approval.withdrawn'`,
      [approvalId],
    )
    expect(audit.rowCount).toBe(1)
  })

  it('escalate: happy path + TARGET_INELIGIBLE + submitter cannot escalate', async () => {
    await ensureUser(pool(), { id: ADMIN_ID, email: 'admin@example.test', name: 'Admin One' })
    await ensureUser(pool(), {
      id: TARGET_ID,
      email: 'target@example.test',
      name: 'Layla H.',
      platformRole: 'platform_admin',
    })
    await ensureUser(pool(), {
      id: OTHER_SUBMITTER,
      email: 'submitter@example.test',
      name: 'Submitter',
    })

    const openId = await insertOpenApproval(pool(), { createdBy: OTHER_SUBMITTER })
    const { app, elevate } = await makeOpsApp(url())

    const targets = await request(app)
      .get(`/api/admin/fin/approvals/${openId}/eligible-escalation-targets`)
      .query({ request_type: 'LARGE_GRANT', q: 'Layla' })
    expect(targets.status).toBe(200)
    expect(targets.body.targets.some((t) => t.id === TARGET_ID)).toBe(true)
    expect(targets.body.targets.every((t) => t.id !== OTHER_SUBMITTER && t.id !== ADMIN_ID)).toBe(true)

    const ok = await request(app)
      .post(`/api/admin/fin/approvals/${openId}/escalate`)
      .set(writeHeaders(elevate()))
      .send({
        reason_vocab: 'out_of_scope_authority',
        target_approver_id: TARGET_ID,
        notes: 'Amount exceeds my per-approver authority for this grant.',
        notify_channels: ['email', 'slack'],
      })
    expect(ok.status).toBe(201)
    expect(ok.body.approval_request.escalated_to).toBe(TARGET_ID)
    expect(ok.body.approval_request.escalated_from).toBe(ADMIN_ID)
    expect(ok.body.approval_request.escalation_reason).toBe('out_of_scope_authority')
    expect(ok.body.approval_request.escalation_chain).toHaveLength(1)
    expect(ok.body.notifications_dispatched).toEqual(expect.arrayContaining(['email', 'slack']))

    const audit = await pool().query(
      `SELECT action FROM fin.financial_audit_events
        WHERE approval_request_id = $1 AND action = 'approval.escalated'`,
      [openId],
    )
    expect(audit.rowCount).toBe(1)

    const openId2 = await insertOpenApproval(pool(), { createdBy: OTHER_SUBMITTER })
    const alias = await request(app)
      .post(`/api/admin/fin/approvals/${openId2}/escalate`)
      .set(writeHeaders(elevate()))
      .send({
        reason_vocab: 'conflict_of_interest',
        targetUserId: TARGET_ID,
        rationale: 'Conflict of interest — please take this one instead.',
        notify_channels: ['email'],
      })
    expect(alias.status).toBe(201)

    const ineligible = await request(app)
      .post(`/api/admin/fin/approvals/${await insertOpenApproval(pool(), { createdBy: OTHER_SUBMITTER })}/escalate`)
      .set(writeHeaders(elevate()))
      .send({
        reason_vocab: 'requires_domain_expertise',
        target_approver_id: OTHER_SUBMITTER,
        notes: 'Trying to escalate to the original submitter should fail.',
        notify_channels: ['email'],
      })
    expect(ineligible.status).toBe(422)
    expect(ineligible.body.error).toBe('TARGET_INELIGIBLE')
    expect(ineligible.body.reason).toBe('target_same_as_submitter')

    const asSubmitter = await makeOpsApp(url(), { userId: OTHER_SUBMITTER, email: 'submitter@example.test' })
    const own = await insertOpenApproval(pool(), { createdBy: OTHER_SUBMITTER })
    const blocked = await request(asSubmitter.app)
      .post(`/api/admin/fin/approvals/${own}/escalate`)
      .set(writeHeaders(asSubmitter.elevate()))
      .send({
        reason_vocab: 'contentious',
        target_approver_id: TARGET_ID,
        notes: 'Submitter should never be allowed to escalate own request.',
        notify_channels: ['email'],
      })
    expect(blocked.status).toBe(403)
    expect(blocked.body.error).toBe('SUBMITTER_CANNOT_ESCALATE')
  })

  it('withdraw of already-decided request → ALREADY_DECIDED; WITHDRAWN status round-trip', async () => {
    await ensureUser(pool(), { id: ADMIN_ID, email: 'admin@example.test', name: 'Admin' })
    const now = new Date().toISOString()
    const decidedId = randomUUID()
    await pool().query(
      `INSERT INTO fin.approval_requests (
         id, environment, tenant_id, action_kind, status, payload_hash,
         created_at, created_by_actor_type, created_by_actor_id, updated_at
       ) VALUES (
         $1, 'LIVE', NULL, 'LARGE_GRANT', 'REJECTED', 'be33',
         $2::timestamptz, 'USER', $3, $2::timestamptz
       )`,
      [decidedId, now, ADMIN_ID],
    )
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post(`/api/admin/fin/approvals/${decidedId}/withdraw`)
      .set(writeHeaders(elevate()))
      .send({ reason: 'Too late — already decided by another PA.' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('ALREADY_DECIDED')

    // Confirm WITHDRAWN is a legal status after migration 345
    const withdrawnId = randomUUID()
    await pool().query(
      `INSERT INTO fin.approval_requests (
         id, environment, tenant_id, action_kind, status, payload_hash,
         created_at, created_by_actor_type, created_by_actor_id, updated_at,
         withdrawn_at, withdrawn_by, withdrawal_reason
       ) VALUES (
         $1, 'LIVE', NULL, 'LARGE_GRANT', 'WITHDRAWN', 'be33',
         $2::timestamptz, 'USER', $3, $2::timestamptz,
         $2::timestamptz, $3, 'seed withdrawn row'
       )`,
      [withdrawnId, now, ADMIN_ID],
    )
    const again = await request(app)
      .post(`/api/admin/fin/approvals/${withdrawnId}/withdraw`)
      .set(writeHeaders(elevate()))
      .send({ reason: 'Already withdrawn — should return ALREADY_WITHDRAWN.' })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('ALREADY_WITHDRAWN')
  })
})
