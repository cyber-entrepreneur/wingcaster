import { describe, expect, it } from 'vitest'
import { getProvider, isOAuthProvider, listProviders } from './provider-registry.js'

describe('provider-registry', () => {
  it('lists x and tiktok', () => {
    expect(listProviders()).toEqual(['x', 'tiktok'])
    expect(isOAuthProvider('x')).toBe(true)
    expect(isOAuthProvider('meta')).toBe(false)
  })

  it('exposes required provider shape', () => {
    for (const provider of listProviders()) {
      const config = getProvider(provider)
      expect(config.authUrl).toMatch(/^https:\/\//)
      expect(config.tokenUrl).toMatch(/^https:\/\//)
      expect(config.scopes.length).toBeGreaterThan(0)
      expect(config.usesPKCE).toBe(true)
      expect(config.pkceMethod).toBe('S256')
      expect(config.supportsRefresh).toBe(true)
      expect(config.tokenStyle).toBe('bearer')
      expect(config.redirectPath).toContain('/social-channels/oauth/')
      expect(config.appCredentialKey).toBe(provider)
      expect(typeof config.resolveIdentity).toBe('function')
    }
  })
})
