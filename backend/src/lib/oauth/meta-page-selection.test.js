import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret } from '../credentials.js'
import {
  createPageSelection,
  sanitizePagesForPicker,
} from './meta-page-selection.js'

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../../persistence/index.js', () => db)

const TEST_KEY = randomBytes(32).toString('base64')

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
  vi.clearAllMocks()
  db.insert.mockResolvedValue({})
})

describe('meta-page-selection', () => {
  it('sanitizePagesForPicker omits access tokens', () => {
    const pages = [
      { id: 'p1', name: 'Page One', access_token: 'secret', instagram_business_account_id: 'ig1' },
      { id: 'p2', name: 'Page Two', access_token: 'secret2', instagram_business_account_id: null },
    ]
    expect(sanitizePagesForPicker(pages)).toEqual([
      { id: 'p1', name: 'Page One', has_instagram: true },
      { id: 'p2', name: 'Page Two', has_instagram: false },
    ])
  })

  it('createPageSelection stores encrypted page candidates', async () => {
    const pages = [{ id: 'p1', name: 'Page One', access_token: 'page-token' }]
    const result = await createPageSelection({
      agentId: 'agent-1',
      agencyId: 'agy-1',
      platform: 'facebook',
      pages,
      userToken: 'user-token',
      userTokenExpiresAt: '2026-12-01T00:00:00.000Z',
    })

    expect(result.id).toBeTruthy()
    expect(db.insert).toHaveBeenCalledWith('oauth_states', expect.objectContaining({
      agent_id: 'agent-1',
      agency_id: 'agy-1',
      platform: 'facebook_page_select',
      pages_encrypted: expect.any(String),
      user_token_encrypted: expect.any(String),
      target_platform: 'facebook',
    }))
  })
})
