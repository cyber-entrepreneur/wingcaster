import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRendererProvider, LocalRendererProvider, BannerbearRendererProvider } from './renderer-providers.js'
import { buildPublishPayloads, assertPublishable } from './service.js'
import { CHANNEL_KEY_TO_PUBLISH } from './constants.js'

vi.mock('../../modules/social-cards/renderer.js', () => ({
  renderSocialCard: vi.fn().mockResolvedValue({
    url: '/uploads/social-cards/listing/local.png',
    dimensions: { width: 1080, height: 1080 },
    filename: 'local.png',
    path: '/tmp/local.png',
  }),
}))

vi.mock('../../modules/social-cards/bannerbear-adapter.js', () => ({
  renderBannerbearCard: vi.fn().mockResolvedValue({
    url: '/uploads/social-cards/listing/bb.png',
    dimensions: { width: 1080, height: 1080 },
    filename: 'bb.png',
    path: '/tmp/bb.png',
    bannerbear_uid: 'bb_uid',
  }),
}))

const { renderSocialCard } = await import('../../modules/social-cards/renderer.js')
const { renderBannerbearCard } = await import('../../modules/social-cards/bannerbear-adapter.js')

const baseInput = {
  template: { id: 'platform_editorial_v1', engine: 'builtin' },
  listing: { id: 'lst_1', title: 'Test' },
  agent: { id: 'agt_1', name: 'Agent' },
  brand: null,
  platform: 'instagram_feed',
  storageRoot: '/tmp',
  publicBaseUrl: '/uploads/social-cards',
}

describe('Creative renderer providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createRendererProvider returns local by default', () => {
    expect(createRendererProvider()).toBeInstanceOf(LocalRendererProvider)
  })

  it('createRendererProvider returns bannerbear when requested', () => {
    expect(createRendererProvider('bannerbear')).toBeInstanceOf(BannerbearRendererProvider)
  })

  it('local provider renders via renderSocialCard', async () => {
    const provider = createRendererProvider('local')
    const result = await provider.renderRendition(baseInput)
    expect(renderSocialCard).toHaveBeenCalledOnce()
    expect(renderBannerbearCard).not.toHaveBeenCalled()
    expect(result.provider).toBe('local')
    expect(result.asset_url).toContain('local.png')
  })

  it('bannerbear provider renders via renderBannerbearCard', async () => {
    const provider = createRendererProvider('bannerbear')
    const result = await provider.renderRendition(baseInput)
    expect(renderBannerbearCard).toHaveBeenCalledOnce()
    expect(renderSocialCard).not.toHaveBeenCalled()
    expect(result.provider).toBe('bannerbear')
  })
})

describe('approval gate', () => {
  const bundle = {
    creative: {
      id: 'cre_1',
      source: 'ai',
      approval_state: 'pending',
    },
    variants: [{
      id: 'crv_1',
      copy: { instagram_feed: 'Hello' },
      renditions: [{
        channel_key: 'instagram_feed',
        asset_url: '/uploads/test.png',
      }],
    }],
  }

  it('blocks publish when AI creative is pending', () => {
    expect(() => assertPublishable(bundle.creative)).toThrow(/approval/i)
  })

  it('allows publish after approval', () => {
    expect(() => assertPublishable({ ...bundle.creative, approval_state: 'approved' })).not.toThrow()
  })

  it('buildPublishPayloads maps channel keys to publish platforms', () => {
    const approved = { ...bundle, creative: { ...bundle.creative, approval_state: 'approved' } }
    const payloads = buildPublishPayloads(approved, [{ variant_id: 'crv_1', channel_key: 'instagram_feed' }])
    expect(payloads[0].platform).toBe(CHANNEL_KEY_TO_PUBLISH.instagram_feed.platform)
    expect(payloads[0].caption).toBe('Hello')
  })
})
