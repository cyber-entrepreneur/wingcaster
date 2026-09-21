import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret } from '../credentials.js'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

const getFreshAccessToken = vi.hoisted(() => vi.fn())

vi.mock('../../persistence/index.js', () => db)
vi.mock('./token-store.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getFreshAccessToken,
  }
})

import { sweepOAuthTokensNearExpiry } from './token-refresh-sweep.js'
import { REFRESH_SAFETY_WINDOW_MS } from './token-store.js'

const TEST_KEY = randomBytes(32).toString('base64')

function nearExpiryConnection(platform, overrides = {}) {
  return {
    id: `conn-${platform}`,
    agent_id: 'agent-1',
    agency_id: 'agy-1',
    platform,
    status: 'connected',
    health: 'healthy',
    settings: {
      credentials: {
        access_token_encrypted: encryptSecret('access'),
        refresh_token_encrypted: encryptSecret('refresh'),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    ...overrides,
  }
}

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
  vi.clearAllMocks()
  getFreshAccessToken.mockResolvedValue('fresh-token')
})

describe('sweepOAuthTokensNearExpiry', () => {
  it('refreshes x/tiktok connections within the safety window', async () => {
    const xConn = nearExpiryConnection('x')
    const ttConn = nearExpiryConnection('tiktok')
    const freshConn = nearExpiryConnection('x', {
      id: 'conn-fresh',
      settings: {
        credentials: {
          access_token_encrypted: encryptSecret('access'),
          refresh_token_encrypted: encryptSecret('refresh'),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    })
    const fbConn = nearExpiryConnection('facebook', { platform: 'facebook' })

    db.findAll.mockResolvedValue([xConn, ttConn, freshConn, fbConn])

    const summary = await sweepOAuthTokensNearExpiry({
      safetyWindowMs: REFRESH_SAFETY_WINDOW_MS,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    })

    expect(summary.candidates).toBe(2)
    expect(summary.refreshed).toBe(2)
    expect(summary.failed).toBe(0)
    expect(getFreshAccessToken).toHaveBeenCalledTimes(2)
    expect(getFreshAccessToken).toHaveBeenCalledWith(xConn, expect.objectContaining({
      safetyWindowMs: REFRESH_SAFETY_WINDOW_MS,
    }))
  })

  it('counts reauth_required failures without throwing', async () => {
    const conn = nearExpiryConnection('x')
    db.findAll.mockResolvedValue([conn])
    getFreshAccessToken.mockRejectedValue(
      Object.assign(new Error('invalid_grant'), { code: 'REAUTH_REQUIRED' }),
    )

    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const summary = await sweepOAuthTokensNearExpiry({ log })

    expect(summary.candidates).toBe(1)
    expect(summary.refreshed).toBe(0)
    expect(summary.failed).toBe(1)
    expect(log.warn).toHaveBeenCalled()
  })

  it('skips connections already flagged reauth_required', async () => {
    const conn = nearExpiryConnection('x', { health: 'reauth_required' })
    db.findAll.mockResolvedValue([conn])

    const summary = await sweepOAuthTokensNearExpiry({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    })

    expect(summary.candidates).toBe(0)
    expect(getFreshAccessToken).not.toHaveBeenCalled()
  })
})
