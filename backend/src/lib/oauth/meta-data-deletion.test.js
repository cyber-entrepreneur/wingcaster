import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../persistence/index.js', () => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

import { findAll, findOne, insert, update } from '../../persistence/index.js'
import {
  parseSignedRequest,
  scrubMetaUserConnections,
  handleMetaDataDeletion,
  handleMetaDeauthorize,
  getDeletionStatus,
  META_DELETION_PLATFORMS,
} from './meta-data-deletion.js'

const APP_SECRET = 'test-app-secret'

function makeSignedRequest(payload, secret = APP_SECRET) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  return `${sig}.${encodedPayload}`
}

function conn(id, platform, userId, extra = {}) {
  return {
    id,
    platform,
    status: 'connected',
    health: 'healthy',
    settings: { credentials: { user_id: userId, access_token_encrypted: 'enc:tok' } },
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parseSignedRequest', () => {
  it('verifies + decodes a valid signed_request', () => {
    const sr = makeSignedRequest({ user_id: '12345', algorithm: 'HMAC-SHA256', issued_at: 1710000000 })
    const payload = parseSignedRequest(sr, APP_SECRET)
    expect(payload.user_id).toBe('12345')
  })

  it('rejects a bad signature (wrong secret)', () => {
    const sr = makeSignedRequest({ user_id: '12345' }, 'other-secret')
    expect(() => parseSignedRequest(sr, APP_SECRET)).toThrowError(/signature mismatch/)
  })

  it('rejects a tampered payload', () => {
    const sr = makeSignedRequest({ user_id: '12345' })
    const [sig] = sr.split('.', 2)
    const forged = Buffer.from(JSON.stringify({ user_id: '99999' })).toString('base64url')
    expect(() => parseSignedRequest(`${sig}.${forged}`, APP_SECRET)).toThrowError(/signature mismatch/)
  })

  it('rejects a malformed signed_request', () => {
    expect(() => parseSignedRequest('not-a-signed-request', APP_SECRET)).toThrowError(/Malformed/)
  })

  it('requires an app secret', () => {
    const sr = makeSignedRequest({ user_id: '1' })
    expect(() => parseSignedRequest(sr, '')).toThrowError(/app secret/)
  })

  it('rejects a non-HMAC-SHA256 algorithm', () => {
    const sr = makeSignedRequest({ user_id: '1', algorithm: 'MD5' })
    expect(() => parseSignedRequest(sr, APP_SECRET)).toThrowError(/algorithm/)
  })
})

describe('scrubMetaUserConnections', () => {
  it('disconnects + wipes only matching Meta connections', async () => {
    findAll.mockResolvedValue([
      conn('c1', 'facebook', 'meta-1'),
      conn('c2', 'instagram', 'meta-1'),
      conn('c3', 'facebook', 'meta-2'), // different user
      conn('c4', 'x', 'meta-1'), // non-meta platform
      conn('c5', 'whatsapp', 'meta-1'),
    ])
    update.mockResolvedValue(undefined)

    const result = await scrubMetaUserConnections('meta-1')

    expect(result.scrubbed).toBe(3)
    expect(result.connectionIds.sort()).toEqual(['c1', 'c2', 'c5'])
    expect(update).toHaveBeenCalledTimes(3)

    // Verify the scrub shape on the first call
    const [, , mutator] = update.mock.calls[0]
    const next = mutator(conn('c1', 'facebook', 'meta-1'))
    expect(next.status).toBe('disconnected')
    expect(next.health).toBe('data_deleted')
    expect(next.settings.credentials).toEqual({})
    expect(next.settings.data_deleted_at).toBeTruthy()
  })

  it('is a no-op for an empty user id', async () => {
    const result = await scrubMetaUserConnections('')
    expect(result.scrubbed).toBe(0)
    expect(findAll).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('covers exactly the three Meta platforms', () => {
    expect(META_DELETION_PLATFORMS).toEqual(['facebook', 'instagram', 'whatsapp'])
  })
})

describe('handleMetaDataDeletion', () => {
  it('scrubs, records, and returns a status url + confirmation code', async () => {
    findAll.mockResolvedValue([conn('c1', 'facebook', '777')])
    update.mockResolvedValue(undefined)
    insert.mockResolvedValue(undefined)

    const sr = makeSignedRequest({ user_id: '777', algorithm: 'HMAC-SHA256' })
    const result = await handleMetaDataDeletion({
      signedRequest: sr,
      appSecret: APP_SECRET,
      statusBaseUrl: 'https://api.wingcaster.test/api/', // trailing /api must be stripped
    })

    expect(result.scrubbed).toBe(1)
    expect(result.confirmation_code).toMatch(/^del_/)
    expect(result.url).toBe(
      `https://api.wingcaster.test/api/oauth/meta/data-deletion/status?code=${result.confirmation_code}`,
    )

    const [, recorded] = insert.mock.calls[0]
    expect(recorded.confirmation_code).toBe(result.confirmation_code)
    expect(recorded.provider).toBe('meta')
    expect(recorded.provider_user_id).toBe('777')
    expect(recorded.status).toBe('completed')
    expect(recorded.connections_scrubbed).toBe(1)
  })
})

describe('handleMetaDeauthorize', () => {
  it('scrubs the user connections and returns a count', async () => {
    findAll.mockResolvedValue([conn('c1', 'facebook', '888'), conn('c2', 'instagram', '888')])
    update.mockResolvedValue(undefined)

    const sr = makeSignedRequest({ user_id: '888' })
    const result = await handleMetaDeauthorize({ signedRequest: sr, appSecret: APP_SECRET })

    expect(result.scrubbed).toBe(2)
    expect(result.provider_user_id).toBe('888')
    expect(insert).not.toHaveBeenCalled() // deauthorize does not record a status row
  })
})

describe('getDeletionStatus', () => {
  it('returns null for an empty code', async () => {
    expect(await getDeletionStatus('')).toBeNull()
    expect(findOne).not.toHaveBeenCalled()
  })

  it('looks up by confirmation code', async () => {
    findOne.mockResolvedValue({ confirmation_code: 'del_abc', status: 'completed' })
    const row = await getDeletionStatus('del_abc')
    expect(row.status).toBe('completed')
  })
})
