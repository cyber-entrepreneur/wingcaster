import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from '../../db.js'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { authMiddleware } from '../../auth.js'
import {
  _resetPushForTests,
  _setMessagingForTests,
  buildFcmMessage,
  isPushConfigured,
  isStaleTokenError,
  registerPushToken,
  sendPushNotification,
} from './push.js'
import { registerPushTokenRoutes } from './push-routes.js'
import {
  dispatchConsumerNotification,
  processPendingNotificationRetries,
  _resetDispatchConfigCache,
} from './dispatch.js'

const FCM_ENV = ['FCM_SERVICE_ACCOUNT_JSON', 'FCM_PROJECT_ID']

const FAKE_SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'wc-test',
  private_key_id: 'key',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n',
  client_email: 'fcm@wc-test.iam.gserviceaccount.com',
  client_id: '1',
  token_uri: 'https://oauth2.googleapis.com/token',
}

function setFakeFcmEnv() {
  process.env.FCM_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify(FAKE_SERVICE_ACCOUNT)).toString('base64')
}

function clearFcmEnv() {
  for (const key of FCM_ENV) delete process.env[key]
}

function mockMessaging(responses) {
  const sendEach = vi.fn(async (messages) => {
    const list = typeof responses === 'function' ? responses(messages) : responses
    return {
      successCount: list.filter((r) => r.success).length,
      failureCount: list.filter((r) => !r.success).length,
      responses: list,
    }
  })
  _setMessagingForTests({ sendEach })
  return sendEach
}

async function seedUser(id = `usr_${randomUUID().slice(0, 8)}`) {
  await query(
    `INSERT INTO public.users (id, email, name, password_hash, role, verified, verified_at, data)
     VALUES ($1, $2, $3, 'x', 'agent', true, NOW(), '{}'::jsonb)`,
    [id, `${id}@push.test`, 'Push User'],
  )
  return id
}

function buildApp({ userId } = {}) {
  const app = express()
  app.use(express.json())
  const auth = userId
    ? (req, _res, next) => {
      req.user = { id: userId }
      next()
    }
    : authMiddleware
  registerPushTokenRoutes(app, { auth })
  return app
}

beforeEach(() => {
  clearFcmEnv()
  _resetPushForTests()
  _resetDispatchConfigCache()
})

afterEach(() => {
  clearFcmEnv()
  _resetPushForTests()
  _resetDispatchConfigCache()
})

describe('push config (fast)', () => {
  it('isPushConfigured is false without credentials', () => {
    expect(isPushConfigured()).toBe(false)
  })

  it('isPushConfigured is true for raw JSON and base64 service accounts', () => {
    process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify(FAKE_SERVICE_ACCOUNT)
    expect(isPushConfigured()).toBe(true)
    process.env.FCM_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify(FAKE_SERVICE_ACCOUNT)).toString('base64')
    expect(isPushConfigured()).toBe(true)
  })

  it('sendPushNotification throws PUSH_UNCONFIGURED when FCM is missing', async () => {
    await expect(sendPushNotification({ userId: 'usr_x', title: 't', body: 'b' }))
      .rejects.toMatchObject({ code: 'PUSH_UNCONFIGURED' })
  })

  it('dispatchConsumerNotification returns skipped PUSH_UNCONFIGURED and does not retry', async () => {
    const result = await dispatchConsumerNotification({
      channel: 'push',
      recipient: 'usr_device01',
      subject: 'Match',
      body: 'hello',
    })
    expect(result).toMatchObject({ ok: false, status: 'skipped', code: 'PUSH_UNCONFIGURED' })
  })

  it('builds per-platform FCM payloads', () => {
    const ios = buildFcmMessage(
      { token: 'ios-token', platform: 'ios' },
      { title: 'Hi', body: 'There', data: { deep_link_url: 'https://app.example/x' }, priority: 'urgent' },
    )
    expect(ios.apns.payload.aps.alert).toEqual({ title: 'Hi', body: 'There' })
    expect(ios.apns.headers['apns-priority']).toBe('10')
    expect(ios.data.deep_link_url).toBe('https://app.example/x')

    const android = buildFcmMessage(
      { token: 'and-token', platform: 'android' },
      { title: 'Hi', body: 'There' },
    )
    expect(android.android.notification.title).toBe('Hi')
    expect(android.android.priority).toBe('normal')

    const web = buildFcmMessage(
      { token: 'web-token', platform: 'web' },
      { title: 'Hi', body: 'There', data: { deep_link_url: 'https://app.example/x' } },
    )
    expect(web.webpush.notification.body).toBe('There')
    expect(web.webpush.fcmOptions.link).toBe('https://app.example/x')
  })

  it('treats FCM invalid-token codes as stale', () => {
    expect(isStaleTokenError({ code: 'messaging/registration-token-not-registered' })).toBe(true)
    expect(isStaleTokenError({ code: 'messaging/invalid-argument' })).toBe(true)
    expect(isStaleTokenError({ code: 'NOT_FOUND' })).toBe(true)
    expect(isStaleTokenError({ code: 'messaging/internal-error' })).toBe(false)
  })
})

finPostgresSuite('push tokens + FCM send (postgres)', { seed: false }, () => {
  beforeEach(async () => {
    clearFcmEnv()
    _resetPushForTests()
    await query(`TRUNCATE TABLE public.user_push_tokens, public.consumer_notification_retries, public.consumer_notifications, public.audit_log RESTART IDENTITY CASCADE`)
  })

  it('happy path: sendPushNotification succeeds and returns provider_message_id', async () => {
    setFakeFcmEnv()
    const userId = await seedUser()
    await registerPushToken({ userId, token: 'tok-android-1', platform: 'android', deviceId: 'pixel-1' })
    const sendEach = mockMessaging([
      { success: true, messageId: 'projects/wc-test/messages/abc' },
    ])

    const result = await sendPushNotification({
      userId,
      title: 'Price drop',
      body: 'Beirut 2-bed dropped',
      data: { alert_type: 'price_drop' },
    })

    expect(result).toMatchObject({
      ok: true,
      provider: 'fcm',
      provider_message_id: 'projects/wc-test/messages/abc',
      tokens_sent: 1,
      tokens_invalidated: 0,
    })
    expect(sendEach).toHaveBeenCalledTimes(1)
    expect(sendEach.mock.calls[0][0]).toHaveLength(1)
    expect(sendEach.mock.calls[0][0][0].android.notification.title).toBe('Price drop')
  })

  it('returns NO_TOKENS_FOR_USER when the user has no devices', async () => {
    setFakeFcmEnv()
    const userId = await seedUser()
    const sendEach = mockMessaging([])
    const result = await sendPushNotification({ userId, title: 't', body: 'b' })
    expect(result).toMatchObject({ ok: false, code: 'NO_TOKENS_FOR_USER', tokens_sent: 0 })
    expect(sendEach).not.toHaveBeenCalled()
  })

  it('sends 200 tokens in one sendEach call', async () => {
    setFakeFcmEnv()
    const userId = await seedUser()
    const values = Array.from({ length: 200 }, (_, i) => [
      userId, 'android', `tok-batch-${i}`,
    ])
    const placeholders = values.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')
    await query(
      `INSERT INTO public.user_push_tokens (user_id, platform, token) VALUES ${placeholders}`,
      values.flat(),
    )
    const sendEach = mockMessaging((messages) =>
      messages.map((_, i) => ({ success: true, messageId: `m-${i}` })),
    )

    const result = await sendPushNotification({ userId, title: 'Burst', body: '200' })
    expect(result).toMatchObject({ ok: true, tokens_sent: 200, tokens_invalidated: 0 })
    expect(sendEach).toHaveBeenCalledTimes(1)
    expect(sendEach.mock.calls[0][0]).toHaveLength(200)
  })

  it('deletes invalid tokens and returns partial success', async () => {
    setFakeFcmEnv()
    const userId = await seedUser()
    await registerPushToken({ userId, token: 'tok-good', platform: 'ios', deviceId: 'iphone' })
    await registerPushToken({ userId, token: 'tok-stale', platform: 'android', deviceId: 'old-pixel' })
    mockMessaging([
      { success: true, messageId: 'projects/wc-test/messages/good' },
      { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'not registered' } },
    ])

    const result = await sendPushNotification({ userId, title: 'Hi', body: 'There' })
    expect(result).toMatchObject({
      ok: true,
      provider: 'fcm',
      provider_message_id: 'projects/wc-test/messages/good',
      tokens_sent: 1,
      tokens_invalidated: 1,
    })
    const remaining = await query(
      `SELECT token FROM public.user_push_tokens WHERE user_id = $1 ORDER BY token`,
      [userId],
    )
    expect(remaining.map((r) => r.token)).toEqual(['tok-good'])
  })

  it('re-registering an existing token updates the row instead of conflicting', async () => {
    const userId = await seedUser()
    const first = await registerPushToken({ userId, token: 'tok-shared', platform: 'android', deviceId: 'd1' })
    expect(first.inserted).toBe(true)
    const second = await registerPushToken({ userId, token: 'tok-shared', platform: 'ios', deviceId: 'd2' })
    expect(second.inserted).toBe(false)
    expect(second.id).toBe(first.id)
    const rows = await query(`SELECT platform, device_id, user_id FROM public.user_push_tokens WHERE token = 'tok-shared'`)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ platform: 'ios', device_id: 'd2', user_id: userId })
  })

  it('evicts the previous user when another user registers the same token', async () => {
    setFakeFcmEnv()
    const userA = await seedUser(`usr_a_${randomUUID().slice(0, 6)}`)
    const userB = await seedUser(`usr_b_${randomUUID().slice(0, 6)}`)
    await registerPushToken({ userId: userA, token: 'tok-kiosk', platform: 'android', deviceId: 'kiosk' })
    await registerPushToken({ userId: userB, token: 'tok-kiosk', platform: 'android', deviceId: 'kiosk' })

    const owners = await query(`SELECT user_id FROM public.user_push_tokens WHERE token = 'tok-kiosk'`)
    expect(owners).toHaveLength(1)
    expect(owners[0].user_id).toBe(userB)

    mockMessaging([{ success: true, messageId: 'projects/wc-test/messages/b' }])
    const forA = await sendPushNotification({ userId: userA, title: 'A', body: 'no' })
    expect(forA).toMatchObject({ ok: false, code: 'NO_TOKENS_FOR_USER' })

    const sendEach = mockMessaging([{ success: true, messageId: 'projects/wc-test/messages/b2' }])
    const forB = await sendPushNotification({ userId: userB, title: 'B', body: 'yes' })
    expect(forB).toMatchObject({ ok: true, tokens_sent: 1 })
    expect(sendEach).toHaveBeenCalledTimes(1)
  })

  it('unconfigured push retries are skipped and not re-queued', async () => {
    const userId = await seedUser()
    const retryId = randomUUID()
    await query(
      `INSERT INTO public.consumer_notification_retries
         (id, channel, status, attempts, next_retry_at, created_at, updated_at, data)
       VALUES ($1, 'push', 'pending', 0, NOW() - interval '1 second', NOW(), NOW(), $2::jsonb)`,
      [retryId, JSON.stringify({ recipient: userId })],
    )
    const result = await processPendingNotificationRetries({ limit: 10 })
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ retry_id: retryId, status: 'skipped', code: 'PUSH_UNCONFIGURED' }),
    ]))
    const rows = await query(`SELECT status FROM public.consumer_notification_retries WHERE id = $1`, [retryId])
    expect(rows[0].status).toBe('skipped')
  })

  it('registration API: 401 unauth, 201 create, 200 conflict-update, 204 delete', async () => {
    const userId = await seedUser()
    const unauthApp = buildApp()
    const app = buildApp({ userId })

    const unauth = await request(unauthApp).post('/api/auth/push-token').send({
      token: 'tok-http-1',
      platform: 'android',
    })
    expect(unauth.status).toBe(401)

    const created = await request(app)
      .post('/api/auth/push-token')
      .send({ token: 'tok-http-1', platform: 'android', device_id: 'pixel' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ ok: true })
    expect(created.body.id).toBeTruthy()

    const updated = await request(app)
      .post('/api/auth/push-token')
      .send({ token: 'tok-http-1', platform: 'android', device_id: 'pixel' })
    expect(updated.status).toBe(200)
    expect(updated.body.id).toBe(created.body.id)

    const listed = await request(app).get('/api/auth/push-tokens')
    expect(listed.status).toBe(200)
    expect(listed.body.tokens).toHaveLength(1)
    expect(listed.body.tokens[0]).toMatchObject({ id: created.body.id, platform: 'android', device_id: 'pixel' })
    expect(listed.body.tokens[0].token).toBeUndefined()

    const deleted = await request(app).delete(`/api/auth/push-token/${created.body.id}`)
    expect(deleted.status).toBe(204)

    const leftover = await query(`SELECT id FROM public.user_push_tokens WHERE user_id = $1`, [userId])
    expect(leftover).toHaveLength(0)
  })

  it('DELETE /api/auth/push-token/all removes every device for the user', async () => {
    const userId = await seedUser()
    const app = buildApp({ userId })
    await request(app).post('/api/auth/push-token').send({ token: 'tok-all-1', platform: 'ios' })
    await request(app).post('/api/auth/push-token').send({ token: 'tok-all-2', platform: 'android' })

    const cleared = await request(app).delete('/api/auth/push-token/all')
    expect(cleared.status).toBe(204)
    const leftover = await query(`SELECT id FROM public.user_push_tokens WHERE user_id = $1`, [userId])
    expect(leftover).toHaveLength(0)
  })
})
