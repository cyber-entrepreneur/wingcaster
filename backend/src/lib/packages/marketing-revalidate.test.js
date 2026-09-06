import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerMarketingRevalidate } from './marketing-revalidate.js'

describe('triggerMarketingRevalidate', () => {
  afterEach(() => {
    delete process.env.MARKETING_REVALIDATE_URL
    delete process.env.MARKETING_REVALIDATE_SECRET
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('skips when env is not configured', async () => {
    const result = await triggerMarketingRevalidate('tier_updated')
    expect(result).toEqual({ skipped: true, reason: 'env_missing' })
  })

  it('POSTs a signed JSON body and does not throw on HTTP errors', async () => {
    process.env.MARKETING_REVALIDATE_URL = 'https://wingcaster.com/api/revalidate'
    process.env.MARKETING_REVALIDATE_SECRET = 'test-secret'
    const fetchMock = vi.fn(async (_url, init) => {
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(init.headers['X-Wingcaster-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
      const body = JSON.parse(init.body)
      expect(body.reason).toBe('tier_updated')
      expect(body.generated_at).toEqual(expect.any(String))
      return { ok: false, status: 503 }
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await triggerMarketingRevalidate('tier_updated')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ skipped: false, ok: false, status: 503 })
  })

  it('returns ok on a 2xx response', async () => {
    process.env.MARKETING_REVALIDATE_URL = 'https://wingcaster.com/api/revalidate'
    process.env.MARKETING_REVALIDATE_SECRET = 'test-secret'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })))
    const result = await triggerMarketingRevalidate()
    expect(result).toEqual({ skipped: false, ok: true, status: 200 })
  })
})
