import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret } from '../credentials.js'

const resolveOAuthPublishAccessToken = vi.hoisted(() => vi.fn())
const publishXTweet = vi.hoisted(() => vi.fn())
const publishTikTokVideo = vi.hoisted(() => vi.fn())

vi.mock('../oauth/publish-token.js', () => ({
  resolveOAuthPublishAccessToken,
}))
vi.mock('../notifications/x.js', () => ({
  publishXTweet,
}))
vi.mock('../notifications/tiktok.js', () => ({
  publishTikTokPhoto: vi.fn(),
  publishTikTokVideo,
}))

import { dispatchPlatformPublish } from './platform-dispatch.js'

const TEST_KEY = randomBytes(32).toString('base64')

function oauthConnection(platform) {
  return {
    id: `conn-${platform}`,
    platform,
    agent_id: 'agent-1',
    status: 'connected',
    settings: {
      credentials: {
        access_token_encrypted: encryptSecret('stored-access'),
        refresh_token_encrypted: encryptSecret('refresh-token'),
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    },
  }
}

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
  vi.clearAllMocks()
  publishXTweet.mockResolvedValue({ tweet_id: 'tw-1', provider: 'x_api' })
  publishTikTokVideo.mockResolvedValue({ publish_id: 'tt-1', provider: 'tiktok_api' })
})

describe('dispatchPlatformPublish OAuth refresh', () => {
  it('calls resolveOAuthPublishAccessToken for x and uses the fresh token', async () => {
    resolveOAuthPublishAccessToken.mockResolvedValue('fresh-x-token')
    const connection = oauthConnection('x')

    const { publishResult, publishError } = await dispatchPlatformPublish({
      platform: 'x',
      connection,
      property: { title: 'Listing' },
      caption: 'Hello',
    })

    expect(publishError).toBeNull()
    expect(resolveOAuthPublishAccessToken).toHaveBeenCalledWith(connection, 'x')
    expect(publishXTweet).toHaveBeenCalledWith({
      text: 'Hello',
      bearerToken: 'fresh-x-token',
      creditContext: null,
    })
    expect(publishResult?.tweet_id).toBe('tw-1')
  })

  it('calls resolveOAuthPublishAccessToken for tiktok video publish', async () => {
    resolveOAuthPublishAccessToken.mockResolvedValue('fresh-tt-token')
    const connection = oauthConnection('tiktok')

    const { publishError } = await dispatchPlatformPublish({
      platform: 'tiktok',
      connection,
      property: { title: 'Listing' },
      caption: 'Clip',
      mediaUrls: ['https://cdn.example.com/clip.mp4'],
    })

    expect(publishError).toBeNull()
    expect(resolveOAuthPublishAccessToken).toHaveBeenCalledWith(connection, 'tiktok')
    expect(publishTikTokVideo).toHaveBeenCalledWith({
      videoUrl: 'https://cdn.example.com/clip.mp4',
      caption: 'Clip',
      accessToken: 'fresh-tt-token',
      creditContext: null,
    })
  })

  it('surfaces REAUTH_REQUIRED when refresh fails', async () => {
    resolveOAuthPublishAccessToken.mockRejectedValue(
      Object.assign(new Error('X authorization has expired. Re-authorise in Settings → Channels.'), {
        code: 'REAUTH_REQUIRED',
      }),
    )

    const { publishResult, publishError } = await dispatchPlatformPublish({
      platform: 'x',
      connection: oauthConnection('x'),
      property: { title: 'Listing' },
      caption: 'Hello',
    })

    expect(publishResult).toBeNull()
    expect(publishError?.code).toBe('REAUTH_REQUIRED')
    expect(publishError?.message).toContain('Re-authorise')
  })
})
