/**
 * Real-Postgres coverage for BE-BLOCKER-19:
 *   - public token view + cancel
 *   - reminder cron idempotency
 *   - seeded email template rendering
 */
import { createHmac, randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { insert, query } from './db.js'
import {
  REMINDER_KEYS,
  REMINDER_TEMPLATE_CODES,
  buildDeletionEmailVariables,
  cancelScheduledDeletionByToken,
  claimReminderSend,
  getScheduledDeletionByToken,
  issueScheduledDeletionViewToken,
  publicNoAuth,
  registerScheduledDeletionRoutes,
  renderDeletionTemplate,
} from './auth-scheduled-deletion.js'
import { runScheduledDeletionReminderTick } from './workers/scheduled-deletion-reminders.js'
import { signPurposeToken } from './lib/signed-token.js'

function craftToken({ purpose, claims = {}, expOffsetSeconds = 3600, secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me' }) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    ...claims,
    purpose,
    iat: now,
    exp: now + expOffsetSeconds,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

async function seedUser({ email, name } = {}) {
  const id = randomUUID()
  const now = new Date().toISOString()
  await insert('users', {
    id,
    email: email || `del-${id.slice(0, 8)}@example.test`,
    phone: null,
    name: name || 'Delete Me',
    password_hash: 'x',
    role: 'agent',
    verified: true,
    verified_at: now,
    created_at: now,
    updated_at: now,
  })
  return id
}

async function seedScheduledDeletion({
  userId,
  scheduledFor,
  remindersSent = [],
  status = 'scheduled',
} = {}) {
  const id = randomUUID()
  const now = new Date().toISOString()
  await query(
    `INSERT INTO public.deletion_requests
      (id, user_id, status, scheduled_for, confirmed_at, reminders_sent, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $7)`,
    [id, userId, status, scheduledFor, now, remindersSent, now],
  )
  return id
}

function daysFromNow(days, base = new Date()) {
  const d = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + days,
    12, 0, 0, 0,
  ))
  return d.toISOString()
}

finPostgresSuite('scheduled deletion public + reminders', { seed: false }, ({ pool }) => {
  it('migration adds reminders_sent and seeds three templates', async () => {
    const col = await pool().query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'deletion_requests'
          AND column_name = 'reminders_sent'`,
    )
    expect(col.rows[0]?.data_type).toBe('ARRAY')

    const templates = await pool().query(
      `SELECT code FROM platform_message_templates
        WHERE code IN ($1, $2, $3)
        ORDER BY code`,
      [
        REMINDER_TEMPLATE_CODES.t0,
        REMINDER_TEMPLATE_CODES.tminus1,
        REMINDER_TEMPLATE_CODES.tminus7,
      ],
    )
    expect(templates.rows.map((r) => r.code)).toEqual([
      'scheduled_deletion_confirm_t0',
      'scheduled_deletion_reminder_tminus1',
      'scheduled_deletion_reminder_tminus7',
    ])
  })

  it('publicNoAuth marker is explicit PUBLIC_NO_AUTH', () => {
    expect(publicNoAuth.marker).toBe('PUBLIC_NO_AUTH')
  })

  it('token validation: valid / wrong purpose / garbage', async () => {
    const userId = await seedUser({ email: `tok-${randomUUID().slice(0, 8)}@ex.test` })
    const deletionId = await seedScheduledDeletion({
      userId,
      scheduledFor: daysFromNow(30),
    })
    const token = issueScheduledDeletionViewToken({ deletionRequestId: deletionId, userId })

    const ok = await getScheduledDeletionByToken(token)
    expect(ok.ok).toBe(true)
    expect(ok.body.deletion_request_id).toBe(deletionId)
    expect(ok.body.cancel_available).toBe(true)
    expect(ok.body.days_remaining).toBeGreaterThanOrEqual(29)

    const wrong = signPurposeToken({
      purpose: 'password_reset',
      ttlSeconds: 3600,
      claims: { deletion_request_id: deletionId, user_id: userId },
    })
    const badPurpose = await getScheduledDeletionByToken(wrong)
    expect(badPurpose.ok).toBe(false)
    expect(badPurpose.status).toBe(401)

    const garbage = await getScheduledDeletionByToken('not.a.token')
    expect(garbage.ok).toBe(false)
    expect([401, 410]).toContain(garbage.status)

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-for-scheduled-deletion'
    const expired = craftToken({
      purpose: 'scheduled_deletion_view',
      claims: { deletion_request_id: deletionId, user_id: userId },
      expOffsetSeconds: -60,
    })
    const expiredResult = await getScheduledDeletionByToken(expired)
    expect(expiredResult.ok).toBe(false)
    expect(expiredResult.code).toBe('expired')
    expect(expiredResult.status).toBe(410)

    const valid = issueScheduledDeletionViewToken({ deletionRequestId: deletionId, userId })
    const [payloadSeg, sig] = valid.split('.')
    const decoded = JSON.parse(Buffer.from(payloadSeg, 'base64url').toString('utf8'))
    decoded.deletion_request_id = randomUUID()
    const tampered = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${sig}`
    const tamperedResult = await getScheduledDeletionByToken(tampered)
    expect(tamperedResult.ok).toBe(false)
    expect(['invalid_signature', 'invalid_token'].includes(tamperedResult.code)).toBe(true)
  })

  it('HTTP GET/POST cancel flow works without a session cookie', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-for-scheduled-deletion'
    const userId = await seedUser({ email: `http-${randomUUID().slice(0, 8)}@ex.test`, name: 'Sara' })
    const deletionId = await seedScheduledDeletion({
      userId,
      scheduledFor: daysFromNow(30),
    })
    const token = issueScheduledDeletionViewToken({ deletionRequestId: deletionId, userId })

    const app = express()
    registerScheduledDeletionRoutes(app)

    const viewed = await request(app)
      .get(`/api/auth/scheduled-deletion/${encodeURIComponent(token)}`)
      .expect(200)
    expect(viewed.body.deletion_request_id).toBe(deletionId)
    expect(viewed.body.cancel_available).toBe(true)

    const cancelled = await request(app)
      .post(`/api/auth/scheduled-deletion/${encodeURIComponent(token)}/cancel`)
      .expect(200)
    expect(cancelled.body.success).toBe(true)
    expect(cancelled.body.cancelled || cancelled.body.status === 'cancelled').toBeTruthy()

    const row = await query(
      `SELECT status, cancelled_at FROM public.deletion_requests WHERE id = $1`,
      [deletionId],
    )
    expect(row[0].status).toBe('cancelled')
    expect(row[0].cancelled_at).toBeTruthy()

    // Idempotent second cancel
    const again = await request(app)
      .post(`/api/auth/scheduled-deletion/${encodeURIComponent(token)}/cancel`)
      .expect(200)
    expect(again.body.already_cancelled || again.body.status === 'cancelled').toBeTruthy()
  })

  it('cancelScheduledDeletionByToken refuses completed deletions', async () => {
    const userId = await seedUser()
    const deletionId = await seedScheduledDeletion({
      userId,
      scheduledFor: daysFromNow(1),
      status: 'completed',
    })
    await query(
      `UPDATE public.deletion_requests SET completed_at = NOW() WHERE id = $1`,
      [deletionId],
    )
    const token = issueScheduledDeletionViewToken({ deletionRequestId: deletionId, userId })
    const result = await cancelScheduledDeletionByToken(token)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('already_completed')
  })

  it('email templates render required variables', async () => {
    const userId = await seedUser({ name: 'Alex', email: `render-${randomUUID().slice(0, 8)}@ex.test` })
    const deletionId = await seedScheduledDeletion({
      userId,
      scheduledFor: daysFromNow(30),
    })
    const rows = await query(
      `SELECT dr.*, u.email AS user_email, u.name AS user_name
         FROM public.deletion_requests dr
         JOIN public.users u ON u.id = dr.user_id
        WHERE dr.id = $1`,
      [deletionId],
    )
    const variables = await buildDeletionEmailVariables(rows[0])

    for (const code of Object.values(REMINDER_TEMPLATE_CODES)) {
      const { rendered, template } = await renderDeletionTemplate(code, variables)
      expect(template.code).toBe(code)
      expect(rendered.subject).toContain(code.includes('tminus1') ? 'tomorrow' : code.includes('tminus7') ? '7 days' : 'deleted')
      expect(rendered.html_body).toContain(variables.cancel_url)
      expect(rendered.html_body).toContain('Alex')
      expect(rendered.text_body).toContain(variables.deletion_date)
    }
  })

  it('reminder cron sends T-7 and T-1 once (idempotent)', async () => {
    const now = new Date('2026-09-08T12:00:00.000Z')
    const send = vi.fn(async ({ code, to }) => ({
      sent: true,
      provider: 'graph',
      provider_message_id: `msg_${code}`,
      used_template_id: 'tpl',
      used_fallback: false,
      to,
    }))

    const user7 = await seedUser({ email: `t7-${randomUUID().slice(0, 8)}@ex.test` })
    const user1 = await seedUser({ email: `t1-${randomUUID().slice(0, 8)}@ex.test` })
    const userSkip = await seedUser({ email: `skip-${randomUUID().slice(0, 8)}@ex.test` })

    const id7 = await seedScheduledDeletion({
      userId: user7,
      scheduledFor: daysFromNow(7, now),
    })
    const id1 = await seedScheduledDeletion({
      userId: user1,
      scheduledFor: daysFromNow(1, now),
    })
    // Already reminded — must not send again
    await seedScheduledDeletion({
      userId: userSkip,
      scheduledFor: daysFromNow(7, now),
      remindersSent: [REMINDER_KEYS.tminus7],
    })
    // Wrong day — must not send
    await seedScheduledDeletion({
      userId: await seedUser(),
      scheduledFor: daysFromNow(14, now),
    })

    const first = await runScheduledDeletionReminderTick({ now, send })
    expect(first.sent).toBe(2)
    expect(first.tminus7.sent).toBe(1)
    expect(first.tminus1.sent).toBe(1)
    expect(send).toHaveBeenCalledTimes(2)

    const codes = send.mock.calls.map((c) => c[0].code).sort()
    expect(codes).toEqual([
      'scheduled_deletion_reminder_tminus1',
      'scheduled_deletion_reminder_tminus7',
    ])

    const after7 = await query(
      `SELECT reminders_sent FROM public.deletion_requests WHERE id = $1`,
      [id7],
    )
    expect(after7[0].reminders_sent).toContain('tminus7')
    const after1 = await query(
      `SELECT reminders_sent FROM public.deletion_requests WHERE id = $1`,
      [id1],
    )
    expect(after1[0].reminders_sent).toContain('tminus1')

    // Second tick: idempotent — zero new sends
    send.mockClear()
    const second = await runScheduledDeletionReminderTick({ now, send })
    expect(second.sent).toBe(0)
    expect(send).not.toHaveBeenCalled()
  })

  it('claimReminderSend is race-safe', async () => {
    const userId = await seedUser()
    const id = await seedScheduledDeletion({
      userId,
      scheduledFor: daysFromNow(7),
    })
    const a = await claimReminderSend(id, 'tminus7')
    const b = await claimReminderSend(id, 'tminus7')
    expect(a).toBe(true)
    expect(b).toBe(false)
  })

  it('cron does not record a reminder key when send fails (retry next tick)', async () => {
    const now = new Date('2026-09-08T12:00:00.000Z')
    const userId = await seedUser({ email: `fail-${randomUUID().slice(0, 8)}@ex.test` })
    const id = await seedScheduledDeletion({
      userId,
      scheduledFor: daysFromNow(7, now),
    })
    const failing = vi.fn(async () => {
      throw Object.assign(new Error('graph down'), { code: 'GRAPH_SEND_FAILED' })
    })
    const failedTick = await runScheduledDeletionReminderTick({ now, send: failing })
    expect(failedTick.failed).toBeGreaterThanOrEqual(1)
    const afterFail = await query(
      `SELECT reminders_sent FROM public.deletion_requests WHERE id = $1`,
      [id],
    )
    expect(afterFail[0].reminders_sent || []).not.toContain('tminus7')

    const send = vi.fn(async ({ code, to }) => ({
      sent: true, provider: 'graph', provider_message_id: `msg_${code}`, to,
    }))
    const retried = await runScheduledDeletionReminderTick({ now, send })
    expect(retried.sent).toBeGreaterThanOrEqual(1)
    const afterOk = await query(
      `SELECT reminders_sent FROM public.deletion_requests WHERE id = $1`,
      [id],
    )
    expect(afterOk[0].reminders_sent).toContain('tminus7')
  })
})
