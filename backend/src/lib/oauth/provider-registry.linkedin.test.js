import { describe, expect, it, vi } from 'vitest'
import { getProvider } from './provider-registry.js'

describe('linkedin provider resolveIdentity', () => {
  const env = {}

  it('resolves person URN from OIDC userinfo', async () => {
    const fetchFn = vi.fn(async (url) => {
      if (String(url).includes('/v2/userinfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ sub: 'abc123', name: 'Alex Agent', email: 'alex@example.com' }),
        }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const config = getProvider('linkedin')
    const identity = await config.resolveIdentity(
      { access_token: 'access', scope: 'openid profile email w_member_social' },
      { fetch: fetchFn },
    )

    expect(identity.li_author_urn).toBe('urn:li:person:abc123')
    expect(identity.authors).toEqual([
      { urn: 'urn:li:person:abc123', label: 'Alex Agent', type: 'person' },
    ])
  })

  it('returns person + org authors when org scopes granted', async () => {
    const fetchFn = vi.fn(async (url) => {
      if (String(url).includes('/v2/userinfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ sub: 'abc123', name: 'Alex Agent' }),
        }
      }
      if (String(url).includes('/rest/organizationAcls')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            elements: [
              {
                organization: 'urn:li:organization:999',
                'organization~': { localizedName: 'WingCaster HQ' },
              },
            ],
          }),
        }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const config = getProvider('linkedin')
    const identity = await config.resolveIdentity(
      {
        access_token: 'access',
        scope: 'openid profile email w_member_social w_organization_social r_organization_social',
      },
      { fetch: fetchFn },
    )

    expect(identity.li_author_urn).toBeNull()
    expect(identity.authors).toHaveLength(2)
    expect(identity.authors).toEqual(expect.arrayContaining([
      { urn: 'urn:li:person:abc123', label: 'Alex Agent', type: 'person' },
      { urn: 'urn:li:organization:999', label: 'WingCaster HQ', type: 'organization' },
    ]))
  })
})
