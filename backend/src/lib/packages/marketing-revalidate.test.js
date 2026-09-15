import { afterEach, describe, expect, it, vi } from 'vitest'

describe('marketing-revalidate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MARKETING_REVALIDATE_URL
    delete process.env.MARKETING_REVALIDATE_SECRET
    vi.resetModules()
  })

  it('skips when env not configured and records event', async () => {
    const {
      triggerMarketingRevalidate,
      getRevalidationEvent,
      clearRevalidationEvents,
    } = await import('./marketing-revalidate.js')
    clearRevalidationEvents()
    const result = await triggerMarketingRevalidate('pricing-tiers', {
      packageId: 'pkg',
      versionId: 'ver',
      environment: 'LIVE',
    })
    expect(result.skipped).toBe(true)
    expect(result.status).toBe('skipped')
    expect(getRevalidationEvent(result.id)?.confirmed).toBe(false)
  })

  it('records confirmed when fetch returns ok', async () => {
    process.env.MARKETING_REVALIDATE_URL = 'https://example.test/api/revalidate'
    process.env.MARKETING_REVALIDATE_SECRET = 'secret'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })))
    const {
      triggerMarketingRevalidate,
      clearRevalidationEvents,
    } = await import('./marketing-revalidate.js')
    clearRevalidationEvents()
    const result = await triggerMarketingRevalidate('pricing-tiers')
    expect(result.confirmed).toBe(true)
    expect(result.status).toBe('confirmed')
  })
})

describe('packages env resolver', () => {
  it('prefers session over header', async () => {
    const { resolvePackagesEnv } = await import('./env.js')
    expect(resolvePackagesEnv({
      user: { fin_environment: 'TEST' },
      get: () => 'live',
      headers: {},
    })).toBe('TEST')
    expect(resolvePackagesEnv({
      user: {},
      get: () => 'test',
      headers: {},
    })).toBe('TEST')
    expect(resolvePackagesEnv({
      user: {},
      get: () => undefined,
      headers: {},
    })).toBe('LIVE')
  })
})
