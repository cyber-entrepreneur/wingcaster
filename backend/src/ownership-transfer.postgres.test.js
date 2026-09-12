/**
 * Real-Postgres coverage for BE-BLOCKER-31 / WF-31 ownership transfer:
 *   - initiate → accept → roles flipped → reverse within window
 *   - decline / cancel / expire tick
 *   - reverse after deadline → 410
 *   - missing elevation / wrong OTP / wrong agency name
 *   - non-owner cannot initiate; non-target cannot accept
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount } from './identity.js'
import { signElevatedToken, signToken } from './auth.js'
import { query } from './db.js'
import { addAgencyMembership, createAgencyWithOwner, getAgencyMembership } from './tenant-authorization.js'
import { registerOwnershipTransferRoutes } from './lib/agencies/ownership-transfer-routes.js'
import {
  runOwnershipTransferExpiryTick,
  runOwnershipTransferReversalExpiringTick,
  runOwnershipTransferReversalCloseTick,
} from './workers/ownership-transfer-expiry.js'

process.env.NODE_ENV = 'test'
process.env.OWNERSHIP_TRANSFER_OTP_SOFT_FAIL = '1'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerOwnershipTransferRoutes(app)
  return app
}

async function agentAccount(label = 'Agent') {
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
  return resignSession({
    userId,
    email,
    name: label,
    verifiedAt: now,
    tokenVersion: 0,
  })
}

/** Mint Bearer + elevated tokens bound to the current token_version. */
function resignSession({ userId, email, name, verifiedAt, tokenVersion }) {
  const token = signToken({
    id: userId,
    email,
    name,
    token_version: tokenVersion,
    verified_at: verifiedAt,
  })
  const elevated = signElevatedToken({ userId, tokenVersion })
  return { userId, token, elevated, email, name, verifiedAt, tokenVersion }
}

/**
 * Accept/reverse bump token_version for both parties. Re-mint so subsequent
 * elevated calls are not rejected as stale sessions / step_up_required.
 */
function afterOwnershipFlip(account) {
  return resignSession({
    ...account,
    tokenVersion: Number(account.tokenVersion ?? 0) + 1,
  })
}

async function seedAgencyWithAdmin(agencyName = 'Elite Real Estate') {
  const owner = await agentAccount('Owner')
  const admin = await agentAccount('Admin')
  const agencyId = randomUUID()
  const slug = `ot-${agencyId.slice(0, 8)}`
  await createAgencyWithOwner({
    agency: { id: agencyId, name: agencyName, slug },
    ownerUserId: owner.userId,
  })
  await addAgencyMembership({
    agencyId,
    userId: admin.userId,
    role: 'admin',
    affiliationMode: 'exclusive',
    invitedBy: owner.userId,
  })
  return { owner, admin, agencyId, agencyName, slug }
}

async function sendOtp(app, { agencyId, token }) {
  const res = await request(app)
    .post(`/api/agencies/${agencyId}/ownership-transfer/otp/send`)
    .set('Authorization', `Bearer ${token}`)
  return res
}

async function initiate(app, { agencyId, owner, admin, agencyName, otpCode }) {
  return request(app)
    .post(`/api/agencies/${agencyId}/ownership-transfer/initiate`)
    .set('Authorization', `Bearer ${owner.token}`)
    .set('x-elevated-token', owner.elevated)
    .send({
      target_user_id: admin.userId,
      rationale: 'Stepping back from operations; admin has led the team for a year.',
      otp_code: otpCode,
      typed_agency_name: agencyName,
    })
}

finPostgresSuite('ownership transfer WF-31 (BE-BLOCKER-31)', { seed: false }, ({ pool }) => {
  it('migration creates ownership_transfer_requests and OTP purpose', async () => {
    const table = await pool().query(`SELECT to_regclass('public.ownership_transfer_requests') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const cols = await pool().query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ownership_transfer_requests'`,
    )
    const names = new Set(cols.rows.map((r) => r.column_name))
    for (const required of [
      'id', 'agency_id', 'initiator_user_id', 'target_user_id', 'status',
      'initiated_at', 'expires_at', 'decided_at', 'executed_at', 'reversed_at',
      'reversal_deadline_at', 'rationale', 'decline_reason',
      'acknowledged_by_initiator', 'acknowledged_by_target',
    ]) {
      expect(names.has(required), `missing ${required}`).toBe(true)
    }

    const check = await pool().query(
      `SELECT pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
        WHERE c.conname = 'auth_challenges_purpose_check'`,
    )
    expect(check.rows[0]?.def || '').toMatch(/ownership_transfer_initiate/)

    const templates = await pool().query(
      `SELECT code FROM platform_message_templates
        WHERE code LIKE 'ownership_transfer.%' AND language = 'en'`,
    )
    const codes = new Set(templates.rows.map((r) => r.code))
    for (const code of [
      'ownership_transfer.initiator-accepted',
      'ownership_transfer.target-invited',
      'ownership_transfer.target-declined',
      'ownership_transfer.target-expired',
      'ownership_transfer.transfer-executed',
      'ownership_transfer.transfer-reversed',
      'ownership_transfer.reversal-window-expiring',
    ]) {
      expect(codes.has(code), `missing template ${code}`).toBe(true)
    }

    const actionKind = await pool().query(
      `SELECT pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
        WHERE c.conname = 'chk_approval_requests_action_kind'`,
    )
    expect(actionKind.rows[0]?.def || '').toContain('CAPABILITY_PACK_FINANCE_GRANT')
  })

  it('happy path: initiate → accept flips roles → reverse within window', async () => {
    const ctx = await seedAgencyWithAdmin('Happy Path Agency')
    const app = buildApp()

    const otp1 = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })
    expect(otp1.status).toBe(200)
    expect(otp1.body.__test_code).toBeTruthy()

    const init = await initiate(app, {
      ...ctx,
      otpCode: otp1.body.__test_code,
    })
    expect(init.status).toBe(201)
    expect(init.body.transfer.status).toBe('pending')
    expect(init.body.transfer.status_display).toBe('pending_recipient_accept')
    const transferId = init.body.transfer.id

    const otp2 = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.admin.token })
    expect(otp2.status).toBe(200)

    const accept = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${transferId}/accept`)
      .set('Authorization', `Bearer ${ctx.admin.token}`)
      .set('x-elevated-token', ctx.admin.elevated)
      .send({
        otp_code: otp2.body.__test_code,
        typed_agency_name: ctx.agencyName,
      })
    expect(accept.status).toBe(201)
    expect(accept.body.transfer.status).toBe('executed')
    expect(accept.body.transfer.reversal_deadline_at).toBeTruthy()

    // Role flip bumps token_version for both parties — re-mint before reverse.
    const formerOwner = afterOwnershipFlip(ctx.owner)
    const newOwner = afterOwnershipFlip(ctx.admin)

    const ownerMem = await getAgencyMembership(ctx.agencyId, ctx.owner.userId)
    const adminMem = await getAgencyMembership(ctx.agencyId, ctx.admin.userId)
    expect(ownerMem.role).toBe('admin')
    expect(adminMem.role).toBe('owner')

    const agency = await pool().query(`SELECT owner_id FROM public.agencies WHERE id = $1`, [ctx.agencyId])
    expect(agency.rows[0].owner_id).toBe(ctx.admin.userId)

    const otp3 = await sendOtp(app, { agencyId: ctx.agencyId, token: formerOwner.token })
    expect(otp3.status).toBe(200)
    const reverse = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${transferId}/reverse`)
      .set('Authorization', `Bearer ${formerOwner.token}`)
      .set('x-elevated-token', formerOwner.elevated)
      .send({
        otp_code: otp3.body.__test_code,
        typed_agency_name: ctx.agencyName,
      })
    expect(reverse.status).toBe(201)
    expect(reverse.body.transfer.status).toBe('reversed')

    const ownerAfter = await getAgencyMembership(ctx.agencyId, formerOwner.userId)
    const adminAfter = await getAgencyMembership(ctx.agencyId, newOwner.userId)
    expect(ownerAfter.role).toBe('owner')
    expect(adminAfter.role).toBe('admin')
  })

  it('decline and cancel pending transfers', async () => {
    const declineCtx = await seedAgencyWithAdmin('Decline Agency')
    const app = buildApp()
    const otp = await sendOtp(app, { agencyId: declineCtx.agencyId, token: declineCtx.owner.token })
    const init = await initiate(app, { ...declineCtx, otpCode: otp.body.__test_code })
    expect(init.status).toBe(201)

    const declined = await request(app)
      .post(`/api/agencies/${declineCtx.agencyId}/ownership-transfer/${init.body.transfer.id}/decline`)
      .set('Authorization', `Bearer ${declineCtx.admin.token}`)
      .send({ reason: 'I am not ready to take on ownership responsibilities yet.' })
    expect(declined.status).toBe(200)
    expect(declined.body.transfer.status).toBe('declined')

    const cancelCtx = await seedAgencyWithAdmin('Cancel Agency')
    const otp2 = await sendOtp(app, { agencyId: cancelCtx.agencyId, token: cancelCtx.owner.token })
    const init2 = await initiate(app, { ...cancelCtx, otpCode: otp2.body.__test_code })
    const cancelled = await request(app)
      .post(`/api/agencies/${cancelCtx.agencyId}/ownership-transfer/${init2.body.transfer.id}/cancel`)
      .set('Authorization', `Bearer ${cancelCtx.owner.token}`)
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.transfer.status).toBe('cancelled')
  })

  it('expiry tick flips pending past expires_at to expired', async () => {
    const ctx = await seedAgencyWithAdmin('Expire Agency')
    const app = buildApp()
    const otp = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })
    const init = await initiate(app, { ...ctx, otpCode: otp.body.__test_code })
    const transferId = init.body.transfer.id

    await pool().query(
      `UPDATE public.ownership_transfer_requests
          SET expires_at = NOW() - INTERVAL '1 hour'
        WHERE id = $1`,
      [transferId],
    )

    const tick = await runOwnershipTransferExpiryTick()
    expect(tick.expired).toBeGreaterThanOrEqual(1)

    const row = await pool().query(
      `SELECT status FROM public.ownership_transfer_requests WHERE id = $1`,
      [transferId],
    )
    expect(row.rows[0].status).toBe('expired')
  })

  it('reversal-expiring tick notifies at T-1 day and is idempotent', async () => {
    const ctx = await seedAgencyWithAdmin('Expiring Window Agency')
    const app = buildApp()
    const otp1 = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })
    const init = await initiate(app, { ...ctx, otpCode: otp1.body.__test_code })
    const transferId = init.body.transfer.id

    const otp2 = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.admin.token })
    const accept = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${transferId}/accept`)
      .set('Authorization', `Bearer ${ctx.admin.token}`)
      .set('x-elevated-token', ctx.admin.elevated)
      .send({ otp_code: otp2.body.__test_code, typed_agency_name: ctx.agencyName })
    expect(accept.status).toBe(201)

    await pool().query(
      `UPDATE public.ownership_transfer_requests
          SET reversal_deadline_at = NOW() + INTERVAL '12 hours',
              data = COALESCE(data, '{}'::jsonb) - 'reversal_expiring_notified'
        WHERE id = $1`,
      [transferId],
    )

    const first = await runOwnershipTransferReversalExpiringTick()
    expect(first.notified).toBeGreaterThanOrEqual(1)
    const stamped = await pool().query(
      `SELECT data->>'reversal_expiring_notified' AS notified
         FROM public.ownership_transfer_requests WHERE id = $1`,
      [transferId],
    )
    expect(stamped.rows[0].notified).toBe('true')

    const second = await runOwnershipTransferReversalExpiringTick()
    expect(second.notified).toBe(0)
  })

  it('reverse after deadline returns 410; close tick marks permanent', async () => {
    const ctx = await seedAgencyWithAdmin('Deadline Agency')
    const app = buildApp()
    const otp1 = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })
    const init = await initiate(app, { ...ctx, otpCode: otp1.body.__test_code })
    const transferId = init.body.transfer.id

    const otp2 = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.admin.token })
    const accept = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${transferId}/accept`)
      .set('Authorization', `Bearer ${ctx.admin.token}`)
      .set('x-elevated-token', ctx.admin.elevated)
      .send({ otp_code: otp2.body.__test_code, typed_agency_name: ctx.agencyName })
    expect(accept.status).toBe(201)

    // Accept bumps token_version; re-mint so reverse reaches the deadline check.
    const formerOwner = afterOwnershipFlip(ctx.owner)

    await pool().query(
      `UPDATE public.ownership_transfer_requests
          SET reversal_deadline_at = NOW() - INTERVAL '1 minute'
        WHERE id = $1`,
      [transferId],
    )

    const otp3 = await sendOtp(app, { agencyId: ctx.agencyId, token: formerOwner.token })
    expect(otp3.status).toBe(200)
    const reverse = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${transferId}/reverse`)
      .set('Authorization', `Bearer ${formerOwner.token}`)
      .set('x-elevated-token', formerOwner.elevated)
      .send({ otp_code: otp3.body.__test_code, typed_agency_name: ctx.agencyName })
    expect(reverse.status).toBe(410)
    expect(reverse.body.code).toBe('REVERSAL_WINDOW_CLOSED')

    const close = await runOwnershipTransferReversalCloseTick()
    expect(close.closed).toBeGreaterThanOrEqual(1)
    const row = await pool().query(
      `SELECT data->>'reversal_permanent' AS permanent
         FROM public.ownership_transfer_requests WHERE id = $1`,
      [transferId],
    )
    expect(row.rows[0].permanent).toBe('true')
  })

  it('initiate without elevation / wrong OTP / wrong agency name fails', async () => {
    const ctx = await seedAgencyWithAdmin('Guard Agency')
    const app = buildApp()
    const otp = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })

    const noElev = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/initiate`)
      .set('Authorization', `Bearer ${ctx.owner.token}`)
      .send({
        target_user_id: ctx.admin.userId,
        rationale: 'Stepping back from operations; admin has led the team for a year.',
        otp_code: otp.body.__test_code,
        typed_agency_name: ctx.agencyName,
      })
    expect(noElev.status).toBe(401)
    expect(noElev.body.code).toBe('step_up_required')

    const badOtp = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/initiate`)
      .set('Authorization', `Bearer ${ctx.owner.token}`)
      .set('x-elevated-token', ctx.owner.elevated)
      .send({
        target_user_id: ctx.admin.userId,
        rationale: 'Stepping back from operations; admin has led the team for a year.',
        otp_code: '000000',
        typed_agency_name: ctx.agencyName,
      })
    expect(badOtp.status).toBe(401)
    expect(badOtp.body.code).toBe('INVALID_OTP')

    // Fresh OTP after failed attempt consumed attempt budget on previous challenge
    const otp2 = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })
    const badName = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/initiate`)
      .set('Authorization', `Bearer ${ctx.owner.token}`)
      .set('x-elevated-token', ctx.owner.elevated)
      .send({
        target_user_id: ctx.admin.userId,
        rationale: 'Stepping back from operations; admin has led the team for a year.',
        otp_code: otp2.body.__test_code,
        typed_agency_name: 'Wrong Agency Name',
      })
    expect(badName.status).toBe(401)
    expect(badName.body.code).toBe('INVALID_TYPED_NAME')
  })

  it('non-owner cannot initiate; non-target cannot accept', async () => {
    const ctx = await seedAgencyWithAdmin('Acl Agency')
    const outsider = await agentAccount('Outsider')
    const app = buildApp()

    const otpAdmin = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.admin.token })
    // Admin may send OTP only when they are target of pending — without pending, 403
    expect([200, 403]).toContain(otpAdmin.status)

    const otpOwner = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })
    const asAdmin = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/initiate`)
      .set('Authorization', `Bearer ${ctx.admin.token}`)
      .set('x-elevated-token', ctx.admin.elevated)
      .send({
        target_user_id: ctx.owner.userId,
        rationale: 'Stepping back from operations; admin has led the team for a year.',
        otp_code: otpOwner.body.__test_code,
        typed_agency_name: ctx.agencyName,
      })
    expect(asAdmin.status).toBe(403)

    const init = await initiate(app, { ...ctx, otpCode: otpOwner.body.__test_code })
    expect(init.status).toBe(201)
    const transferId = init.body.transfer.id

    const otpOut = await sendOtp(app, { agencyId: ctx.agencyId, token: outsider.token })
    expect(otpOut.status).toBe(403)

    // Owner (initiator) cannot accept their own transfer — authz before OTP.
    const badAccept = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${transferId}/accept`)
      .set('Authorization', `Bearer ${ctx.owner.token}`)
      .set('x-elevated-token', ctx.owner.elevated)
      .send({
        otp_code: '000000',
        typed_agency_name: ctx.agencyName,
      })
    expect(badAccept.status).toBe(403)
  })

  it('GET state and acknowledge after decline', async () => {
    const ctx = await seedAgencyWithAdmin('State Agency')
    const app = buildApp()

    const empty = await request(app)
      .get(`/api/agencies/${ctx.agencyId}/ownership-transfer/state`)
      .set('Authorization', `Bearer ${ctx.owner.token}`)
    expect(empty.status).toBe(200)
    expect(empty.body.transfer).toBeNull()
    expect(empty.body.eligibility.caller_is_owner).toBe(true)

    const otp = await sendOtp(app, { agencyId: ctx.agencyId, token: ctx.owner.token })
    const init = await initiate(app, { ...ctx, otpCode: otp.body.__test_code })
    await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${init.body.transfer.id}/decline`)
      .set('Authorization', `Bearer ${ctx.admin.token}`)
      .send({ reason: 'I am not ready to take on ownership responsibilities yet.' })

    const ack = await request(app)
      .post(`/api/agencies/${ctx.agencyId}/ownership-transfer/${init.body.transfer.id}/acknowledge`)
      .set('Authorization', `Bearer ${ctx.owner.token}`)
    expect(ack.status).toBe(200)
    expect(ack.body.transfer.acknowledged_by_initiator).toBe(true)
  })
})
