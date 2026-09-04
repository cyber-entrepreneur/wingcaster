import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { insert, query } from '../../db.js'
import { finPostgresSuite } from '../../fin/testing/suite.js'

const emailMock = vi.hoisted(() => ({
  isEmailEnabled: vi.fn(() => true),
  sendEmail: vi.fn(async () => ({ ok: true, provider: 'resend', provider_message_id: 'em_1' })),
}))
const smsMock = vi.hoisted(() => ({
  isSMSEnabled: vi.fn(() => true),
  sendSMS: vi.fn(async () => ({ ok: true, provider: 'twilio', provider_message_id: 'SM1' })),
}))
const waMock = vi.hoisted(() => ({
  isWhatsAppConfigured: vi.fn(() => true),
  sendWhatsAppText: vi.fn(async () => ({ messages: [{ id: 'wamid.1' }] })),
}))

vi.mock('./email.js', () => emailMock)
vi.mock('./sms.js', () => smsMock)
vi.mock('../../whatsapp.js', () => waMock)

const {
  dispatchConsumerNotification,
  processPendingNotificationRetries,
  getDispatchConfig,
  _resetDispatchConfigCache,
  DISPATCH_MAX_RETRIES,
} = await import('./dispatch.js')

const CFG_ENV = [
  'NOTIFICATION_PER_TENANT_PER_HOUR',
  'NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES',
  'NOTIFICATION_BATCH_SIZE',
  'NOTIFICATION_INTER_BATCH_DELAY_MS',
]

function resetTransportMocks() {
  emailMock.isEmailEnabled.mockReset().mockReturnValue(true)
  emailMock.sendEmail.mockReset().mockResolvedValue({ ok: true, provider: 'resend', provider_message_id: 'em_1' })
  smsMock.isSMSEnabled.mockReset().mockReturnValue(true)
  smsMock.sendSMS.mockReset().mockResolvedValue({ ok: true, provider: 'twilio', provider_message_id: 'SM1' })
  waMock.isWhatsAppConfigured.mockReset().mockReturnValue(true)
  waMock.sendWhatsAppText.mockReset().mockResolvedValue({ messages: [{ id: 'wamid.1' }] })
}

beforeEach(() => {
  resetTransportMocks()
  for (const key of CFG_ENV) delete process.env[key]
  _resetDispatchConfigCache()
})

afterEach(() => {
  for (const key of CFG_ENV) delete process.env[key]
  _resetDispatchConfigCache()
})

describe('dispatchConsumerNotification — validation and deferred channels', () => {
  it('rejects mismatched recipients per channel with skipped INVALID_RECIPIENT', async () => {
    const cases = [
      { channel: 'email', recipient: '+15551234567' },
      { channel: 'sms', recipient: 'buyer@example.com' },
      { channel: 'whatsapp', recipient: 'buyer@example.com' },
      { channel: 'in_app', recipient: 'x' },
      { channel: 'email', recipient: '' },
    ]
    for (const { channel, recipient } of cases) {
      const result = await dispatchConsumerNotification({
        channel,
        recipient,
        subject: 's',
        body: 'b',
      })
      expect(result, channel).toMatchObject({ ok: false, status: 'skipped', code: 'INVALID_RECIPIENT' })
    }
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
    expect(smsMock.sendSMS).not.toHaveBeenCalled()
    expect(waMock.sendWhatsAppText).not.toHaveBeenCalled()
  })

  it('returns PUSH_DEFERRED_TO_PART2 skipped for push', async () => {
    const result = await dispatchConsumerNotification({
      channel: 'push',
      recipient: 'usr_device_or_token',
      body: 'hello',
    })
    expect(result).toMatchObject({
      ok: false,
      status: 'skipped',
      code: 'PUSH_DEFERRED_TO_PART2',
    })
  })

  it('returns failed UNKNOWN_CHANNEL for an unknown channel', async () => {
    const result = await dispatchConsumerNotification({
      channel: 'carrier_pigeon',
      recipient: 'nest-1',
      body: 'hello',
    })
    expect(result).toMatchObject({ ok: false, status: 'failed', code: 'UNKNOWN_CHANNEL' })
  })

  it('email happy path maps the transport response', async () => {
    const result = await dispatchConsumerNotification({
      channel: 'email',
      recipient: 'buyer@example.com',
      subject: 'Match',
      body: '3 listings',
    })
    expect(result).toMatchObject({
      ok: true,
      status: 'sent',
      provider: 'resend',
      provider_message_id: 'em_1',
    })
    expect(emailMock.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'buyer@example.com',
      subject: 'Match',
      body: '3 listings',
    }))
  })

  it('SMS happy path maps the Twilio response', async () => {
    const result = await dispatchConsumerNotification({
      channel: 'sms',
      recipient: '+15551234567',
      body: 'Price drop',
    })
    expect(result).toMatchObject({
      ok: true,
      status: 'sent',
      provider: 'twilio',
      provider_message_id: 'SM1',
    })
  })

  it('WhatsApp happy path maps the Cloud API message id', async () => {
    const result = await dispatchConsumerNotification({
      channel: 'whatsapp',
      recipient: '+15551234567',
      body: 'New listing',
    })
    expect(result).toMatchObject({
      ok: true,
      status: 'sent',
      provider: 'whatsapp',
      provider_message_id: 'wamid.1',
    })
  })

  it('unconfigured email returns skipped EMAIL_UNCONFIGURED and does not call sendEmail', async () => {
    emailMock.isEmailEnabled.mockReturnValue(false)
    const result = await dispatchConsumerNotification({
      channel: 'email',
      recipient: 'buyer@example.com',
      subject: 'x',
      body: 'y',
    })
    expect(result).toMatchObject({ ok: false, status: 'skipped', code: 'EMAIL_UNCONFIGURED' })
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
  })

  it('unconfigured SMS returns skipped SMS_UNCONFIGURED', async () => {
    smsMock.isSMSEnabled.mockReturnValue(false)
    const result = await dispatchConsumerNotification({
      channel: 'sms',
      recipient: '+15551234567',
      body: 'y',
    })
    expect(result).toMatchObject({ ok: false, status: 'skipped', code: 'SMS_UNCONFIGURED' })
    expect(smsMock.sendSMS).not.toHaveBeenCalled()
  })

  it('unconfigured WhatsApp returns skipped WHATSAPP_UNCONFIGURED', async () => {
    waMock.isWhatsAppConfigured.mockReturnValue(false)
    const result = await dispatchConsumerNotification({
      channel: 'whatsapp',
      recipient: '+15551234567',
      body: 'y',
    })
    expect(result).toMatchObject({ ok: false, status: 'skipped', code: 'WHATSAPP_UNCONFIGURED' })
    expect(waMock.sendWhatsAppText).not.toHaveBeenCalled()
  })

  it('transient transport failure returns pending with retry_after', async () => {
    emailMock.sendEmail.mockRejectedValueOnce(Object.assign(new Error('smtp timeout'), { code: 'ETIMEDOUT' }))
    const result = await dispatchConsumerNotification({
      channel: 'email',
      recipient: 'buyer@example.com',
      subject: 'x',
      body: 'y',
    })
    expect(result).toMatchObject({ ok: false, status: 'pending' })
    expect(result.retry_after).toBeGreaterThan(0)
  })

  it('permanent 4xx from transport returns failed', async () => {
    emailMock.sendEmail.mockRejectedValueOnce(Object.assign(new Error('bounce'), {
      code: 'RESEND_400',
      status: 400,
    }))
    const result = await dispatchConsumerNotification({
      channel: 'email',
      recipient: 'buyer@example.com',
      subject: 'x',
      body: 'y',
    })
    expect(result).toMatchObject({ ok: false, status: 'failed', code: 'RESEND_400' })
  })
})

async function seedRetry({
  channel = 'email',
  recipient = 'buyer@example.com',
  attempts = 0,
  createdAt = new Date().toISOString(),
  nextRetryAt = new Date(Date.now() - 1000).toISOString(),
  title = 'Saved search match',
  body = '3 listings matched',
  tenantId = null,
  alertType = 'saved_search_match',
} = {}) {
  const notificationId = randomUUID()
  const retryId = randomUUID()
  await insert('consumer_notifications', {
    id: notificationId,
    type: alertType,
    title,
    body,
    read: false,
    metadata: { tenant_id: tenantId },
    dispatch: { channel, recipient, status: 'pending' },
  })
  await insert('consumer_notification_retries', {
    id: retryId,
    notification_id: notificationId,
    channel,
    status: 'pending',
    attempts,
    recipient,
    tenant_id: tenantId,
    alert_type: alertType,
    next_retry_at: nextRetryAt,
    created_at: createdAt,
  })
  return { notificationId, retryId }
}

finPostgresSuite('consumer notification dispatch (postgres)', { seed: false }, () => {
  beforeEach(async () => {
    await query(`
      TRUNCATE TABLE
        public.consumer_notification_retries,
        public.consumer_notifications,
        public.notifications,
        public.notification_dispatch_rate_events,
        public.notification_dispatch_cooldowns,
        public.audit_log
      RESTART IDENTITY CASCADE
    `)
  })

  it('in-app happy path writes public.notifications with type=consumer', async () => {
    const userId = `usr_${randomUUID().slice(0, 8)}`
    const result = await dispatchConsumerNotification({
      channel: 'in_app',
      recipient: userId,
      subject: 'Saved search match',
      body: '3 listings',
      metadata: {
        deep_link_url: 'https://app.example/saved-searches/ss_1',
        tracking_token: 'ss_1',
        alert_type: 'saved_search_match',
      },
    })
    expect(result).toMatchObject({ ok: true, status: 'delivered', provider: 'in_app' })
    const rows = await query(
      `SELECT type, user_id, title, body, metadata FROM public.notifications WHERE user_id = $1`,
      [userId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      type: 'consumer',
      user_id: userId,
      title: 'Saved search match',
      body: '3 listings',
    })
    const meta = typeof rows[0].metadata === 'string' ? JSON.parse(rows[0].metadata) : rows[0].metadata
    expect(meta).toMatchObject({
      deep_link_url: 'https://app.example/saved-searches/ss_1',
      alert_type: 'saved_search_match',
    })
  })

  it('accepts inapp as an alias for in_app', async () => {
    const userId = `usr_${randomUUID().slice(0, 8)}`
    const result = await dispatchConsumerNotification({
      channel: 'inapp',
      recipient: userId,
      subject: 'Hi',
      body: 'There',
    })
    expect(result).toMatchObject({ ok: true, status: 'delivered', provider: 'in_app' })
  })

  it('seeds CFG defaults for rate limits and batching', async () => {
    const cfg = await getDispatchConfig()
    expect(cfg.NOTIFICATION_PER_TENANT_PER_HOUR).toBe(1000)
    expect(cfg.NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES).toBe(60)
    expect(cfg.NOTIFICATION_BATCH_SIZE).toBe(100)
    expect(cfg.NOTIFICATION_INTER_BATCH_DELAY_MS).toBe(100)
    const rows = await query(
      `SELECT key, value FROM public.platform_config WHERE key LIKE 'NOTIFICATION_%' ORDER BY key`,
    )
    expect(rows.map((r) => r.key)).toEqual(expect.arrayContaining([
      'NOTIFICATION_PER_TENANT_PER_HOUR',
      'NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES',
      'NOTIFICATION_BATCH_SIZE',
      'NOTIFICATION_INTER_BATCH_DELAY_MS',
    ]))
  })

  it('unconfigured transport is skipped by the retry worker and is not retried', async () => {
    emailMock.isEmailEnabled.mockReturnValue(false)
    const { retryId } = await seedRetry({})
    const result = await processPendingNotificationRetries({ limit: 10 })
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ retry_id: retryId, status: 'skipped', code: 'EMAIL_UNCONFIGURED' }),
    ]))
    const rows = await query(`SELECT status FROM public.consumer_notification_retries WHERE id = $1`, [retryId])
    expect(rows[0].status).toBe('skipped')
  })

  it('transient failure is retried with backoff', async () => {
    emailMock.sendEmail.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    const { retryId } = await seedRetry({})
    const result = await processPendingNotificationRetries({ limit: 10 })
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ retry_id: retryId, status: 'pending' }),
    ]))
    const rows = await query(
      `SELECT status, attempts, next_retry_at FROM public.consumer_notification_retries WHERE id = $1`,
      [retryId],
    )
    expect(rows[0].status).toBe('pending')
    expect(Number(rows[0].attempts)).toBe(1)
    expect(new Date(rows[0].next_retry_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('permanent 4xx surfaces to dead_letter with an audit entry', async () => {
    emailMock.sendEmail.mockRejectedValue(Object.assign(new Error('content rejected'), {
      code: 'RESEND_400',
      status: 400,
    }))
    const { retryId } = await seedRetry({})
    const result = await processPendingNotificationRetries({ limit: 10 })
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ retry_id: retryId, status: 'dead_letter' }),
    ]))
    const rows = await query(`SELECT status FROM public.consumer_notification_retries WHERE id = $1`, [retryId])
    expect(rows[0].status).toBe('dead_letter')
    const audit = await query(
      `SELECT action FROM public.audit_log WHERE entity_id = $1 AND action = 'dead_letter'`,
      [retryId],
    )
    expect(audit.length).toBeGreaterThan(0)
  })

  it('transitions to dead_letter after 5 attempts', async () => {
    emailMock.sendEmail.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    const { retryId } = await seedRetry({ attempts: DISPATCH_MAX_RETRIES - 1 })
    const result = await processPendingNotificationRetries({ limit: 10 })
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ retry_id: retryId, status: 'dead_letter', reason: 'max_retries' }),
    ]))
    const rows = await query(
      `SELECT status, attempts FROM public.consumer_notification_retries WHERE id = $1`,
      [retryId],
    )
    expect(rows[0].status).toBe('dead_letter')
    expect(Number(rows[0].attempts)).toBe(DISPATCH_MAX_RETRIES)
  })

  it('transitions to dead_letter after 24h even if retries remain', async () => {
    const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const { retryId } = await seedRetry({ createdAt, attempts: 0 })
    const result = await processPendingNotificationRetries({ limit: 10 })
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ retry_id: retryId, status: 'dead_letter', reason: 'max_age' }),
    ]))
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
    const audit = await query(
      `SELECT action FROM public.audit_log WHERE entity_id = $1 AND action = 'dead_letter'`,
      [retryId],
    )
    expect(audit.length).toBeGreaterThan(0)
  })

  it('enforces the per-tenant hourly cap as pending RATE_LIMITED', async () => {
    process.env.NOTIFICATION_PER_TENANT_PER_HOUR = '2'
    _resetDispatchConfigCache()
    const tenantId = `ten_${randomUUID().slice(0, 8)}`
    const first = await dispatchConsumerNotification({
      channel: 'email',
      recipient: 'one@example.com',
      subject: 'a',
      body: 'b',
      metadata: { tenant_id: tenantId, alert_type: 'unique_a' },
    })
    const second = await dispatchConsumerNotification({
      channel: 'email',
      recipient: 'two@example.com',
      subject: 'a',
      body: 'b',
      metadata: { tenant_id: tenantId, alert_type: 'unique_b' },
    })
    const third = await dispatchConsumerNotification({
      channel: 'email',
      recipient: 'three@example.com',
      subject: 'a',
      body: 'b',
      metadata: { tenant_id: tenantId, alert_type: 'unique_c' },
    })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(third).toMatchObject({ ok: false, status: 'pending', code: 'RATE_LIMITED' })
    expect(third.retry_after).toBeGreaterThan(0)
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('cooldown skips the same recipient + alert_type within the window', async () => {
    process.env.NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES = '60'
    _resetDispatchConfigCache()
    const tenantId = `ten_${randomUUID().slice(0, 8)}`
    const payload = {
      channel: 'email',
      recipient: 'same@example.com',
      subject: 'a',
      body: 'b',
      metadata: { tenant_id: tenantId, alert_type: 'saved_search_match' },
    }
    const first = await dispatchConsumerNotification(payload)
    const second = await dispatchConsumerNotification(payload)
    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: false, status: 'skipped', code: 'COOLDOWN' })
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('urgent priority skips cooldown', async () => {
    const tenantId = `ten_${randomUUID().slice(0, 8)}`
    const payload = {
      channel: 'email',
      recipient: 'urgent@example.com',
      subject: 'a',
      body: 'b',
      metadata: { tenant_id: tenantId, alert_type: 'saved_search_match', priority: 'urgent' },
    }
    expect((await dispatchConsumerNotification(payload)).ok).toBe(true)
    const second = await dispatchConsumerNotification(payload)
    expect(second.ok).toBe(true)
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('processes a 200-item queue in 2 chunks with a delay between them', async () => {
    process.env.NOTIFICATION_BATCH_SIZE = '100'
    process.env.NOTIFICATION_INTER_BATCH_DELAY_MS = '25'
    _resetDispatchConfigCache()
    const createdAt = new Date().toISOString()
    const nextRetryAt = new Date(Date.now() - 1000).toISOString()
    await query(
      `INSERT INTO public.consumer_notification_retries
         (id, channel, status, attempts, next_retry_at, created_at, updated_at, data)
       SELECT gen_random_uuid()::text, 'email', 'pending', 0, $1::timestamptz, $2::timestamptz, $2::timestamptz,
              jsonb_build_object('recipient', 'buyer' || g::text || '@example.com')
       FROM generate_series(1, 200) g`,
      [nextRetryAt, createdAt],
    )
    const sleep = vi.fn(async () => {})
    const result = await processPendingNotificationRetries({ limit: 200, sleep })
    expect(result.processed).toBe(200)
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(sleep).toHaveBeenCalledWith(25)
    expect(emailMock.sendEmail).toHaveBeenCalledTimes(200)
  })
})
