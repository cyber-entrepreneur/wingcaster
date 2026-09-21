import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret } from '../../credentials.js'

const getFreshAccessTokenMock = vi.hoisted(() => vi.fn())

vi.mock('../../oauth/token-store.js', () => ({
  getFreshAccessToken: getFreshAccessTokenMock,
}))

import { sendViaDelegatedMailbox } from './delegated-mailbox.js'

const TEST_KEY = randomBytes(32).toString('base64')

function googleConnection(overrides = {}) {
  return {
    id: 'conn-google',
    platform: 'google',
    account_name: 'agent@example.com',
    settings: {
      mailbox_email: 'agent@example.com',
      handle: 'Agent Name',
    },
    ...overrides,
  }
}

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
  vi.clearAllMocks()
  getFreshAccessTokenMock.mockResolvedValue('fresh-access-token')
})

describe('sendViaDelegatedMailbox', () => {
  it('sends via Gmail API with base64url raw message', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gmail-msg-1' }),
    }))

    const result = await sendViaDelegatedMailbox(
      googleConnection(),
      { to: 'Buyer@Example.com', subject: 'Hello', body: 'Plain text' },
      { fetch: fetchFn },
    )

    expect(getFreshAccessTokenMock).toHaveBeenCalled()
    expect(fetchFn).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-access-token' }),
      }),
    )
    const payload = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(payload.raw).toBeTruthy()
    expect(result).toMatchObject({
      provider: 'gmail',
      provider_message_id: 'gmail-msg-1',
      to: 'buyer@example.com',
      from: 'agent@example.com',
      status: 'accepted',
    })
  })

  it('sends via Graph /me/sendMail for microsoft', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 202 }))

    const result = await sendViaDelegatedMailbox(
      {
        id: 'conn-ms',
        platform: 'microsoft',
        account_name: 'agent@contoso.com',
        settings: { mailbox_email: 'agent@contoso.com' },
      },
      { to: 'buyer@example.com', subject: 'Hi', html: '<p>Hi</p>' },
      { fetch: fetchFn },
    )

    expect(fetchFn).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-access-token' }),
      }),
    )
    const payload = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(payload.message.body.contentType).toBe('HTML')
    expect(result).toMatchObject({ provider: 'microsoft', status: 'accepted' })
  })

  it('refreshes token via getFreshAccessToken before send', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gmail-msg-2' }),
    }))

    await sendViaDelegatedMailbox(
      googleConnection({
        settings: {
          mailbox_email: 'agent@example.com',
          credentials: {
            access_token_encrypted: encryptSecret('stale'),
            refresh_token_encrypted: encryptSecret('refresh'),
            expires_at: new Date(Date.now() - 1000).toISOString(),
          },
        },
      }),
      { to: 'buyer@example.com', subject: 'Test', body: 'Body' },
      { fetch: fetchFn },
    )

    expect(getFreshAccessTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'google' }),
      expect.any(Object),
    )
  })
})
