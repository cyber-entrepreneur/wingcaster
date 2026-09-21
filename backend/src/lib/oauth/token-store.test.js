import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  update: vi.fn(),
}))

const refreshTokenMock = vi.hoisted(() => vi.fn())

vi.mock('../../persistence/index.js', () => db)
vi.mock('./token-exchange.js', () => ({
  refreshToken: refreshTokenMock,
}))

import { encryptSecret } from '../credentials.js'
import {
  _clearRefreshLocksForTests,
  getFreshAccessToken,
  REFRESH_SAFETY_WINDOW_MS,
} from './token-store.js'

const TEST_KEY = randomBytes(32).toString('base64')

function connection(overrides = {}) {
  return {
    id: 'conn-1',
    platform: 'x',
    agency_id: 'agy-1',
    settings: {
      credentials: {
        access_token_encrypted: encryptSecret('stale-access'),
        refresh_token_encrypted: encryptSecret('refresh-token'),
        expires_at: new Date(Date.now() - 1000).toISOString(),
        user_id: 'user-1',
      },
    },
    ...overrides,
  }
}

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
  vi.clearAllMocks()
  _clearRefreshLocksForTests()
  db.findOne.mockResolvedValue(null)
  db.update.mockResolvedValue(1)
})

describe('getFreshAccessToken', () => {
  it('returns existing token when still fresh', async () => {
    const fresh = connection({
      settings: {
        credentials: {
          access_token_encrypted: encryptSecret('fresh-access'),
          refresh_token_encrypted: encryptSecret('refresh-token'),
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      },
    })

    const token = await getFreshAccessToken(fresh)
    expect(token).toBe('fresh-access')
    expect(refreshTokenMock).not.toHaveBeenCalled()
  })

  it('refreshes expired token and re-encrypts', async () => {
    const row = connection()
    db.findOne.mockResolvedValue(row)
    refreshTokenMock.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: 'tweet.read',
    })

    const token = await getFreshAccessToken(row)
    expect(token).toBe('new-access')
    expect(refreshTokenMock).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalled()
  })

  it('flags reauth_required on refresh failure', async () => {
    const row = connection()
    db.findOne.mockResolvedValue(row)
    refreshTokenMock.mockRejectedValue(new Error('invalid_grant'))

    await expect(getFreshAccessToken(row)).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' })
    expect(db.update).toHaveBeenCalledWith(
      'marketplace_connections',
      expect.any(Function),
      expect.any(Function),
    )
    const updater = db.update.mock.calls.find((call) => call[0] === 'marketplace_connections')?.[2]
    expect(updater(row).health).toBe('reauth_required')
  })

  it('dedupes concurrent refresh for the same connection', async () => {
    const row = connection()
    db.findOne.mockResolvedValue(row)

    let resolveRefresh
    refreshTokenMock.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = () => resolve({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_at: new Date(Date.now() + REFRESH_SAFETY_WINDOW_MS + 60_000).toISOString(),
      })
    }))

    const first = getFreshAccessToken(row)
    const second = getFreshAccessToken(row)
    await vi.waitFor(() => {
      expect(resolveRefresh).toBeTypeOf('function')
    })
    resolveRefresh()
    const [a, b] = await Promise.all([first, second])

    expect(a).toBe('new-access')
    expect(b).toBe('new-access')
    expect(refreshTokenMock).toHaveBeenCalledTimes(1)
  })
})
