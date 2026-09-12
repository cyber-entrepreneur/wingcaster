import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildSettingsIndex,
  isOauthOnlyUser,
  normalizeCapabilityPacks,
  packsFromMembership,
  registerRoutes,
  resolveSettingsCapabilities,
} from './index-route.js'

const originalSecret = process.env.JWT_SECRET

beforeEach(() => {
  process.env.JWT_SECRET = 'settings-index-test-secret'
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

function itemIds(body) {
  return (body.groups || []).flatMap((group) => group.items.map((item) => item.id))
}

function groupIds(body) {
  return (body.groups || []).map((group) => group.id)
}

function personalOwner(overrides = {}) {
  return {
    tenant_id: 'personal:u1',
    user_id: 'u1',
    role: 'owner',
    affiliation_mode: 'personal',
    status: 'active',
    ...overrides,
  }
}

function agencyMembership(role, overrides = {}) {
  return {
    tenant_id: 'agency:a1',
    user_id: 'u1',
    role,
    affiliation_mode: role === 'guest' ? 'non_exclusive' : 'exclusive',
    status: 'active',
    ...overrides,
  }
}

function createApp({ user = { id: 'user-1' }, memberships = [], loadCallerContext, auth } = {}) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: auth || ((req, _res, next) => {
      if (user) req.user = user
      next()
    }),
    loadCallerContext: loadCallerContext || (async () => ({ user, memberships })),
  })
  return app
}

describe('registerRoutes', () => {
  it('throws when authMiddleware is missing', () => {
    expect(() => registerRoutes(express())).toThrow(/authMiddleware/)
  })
})

describe('normalizeCapabilityPacks', () => {
  it('falls back to [] when packs are missing (pre BE-BLOCKER-29)', () => {
    expect(normalizeCapabilityPacks(undefined)).toEqual([])
    expect(normalizeCapabilityPacks(null)).toEqual([])
    expect(normalizeCapabilityPacks({})).toEqual([])
  })

  it('keeps string pack ids and parses JSON arrays', () => {
    expect(normalizeCapabilityPacks(['finance', ' marketer ', ''])).toEqual(['finance', 'marketer'])
    expect(normalizeCapabilityPacks('["finance"]')).toEqual(['finance'])
  })

  it('reads pack identity from capabilities JSONB', () => {
    expect(packsFromMembership({ capabilities: { pack: 'finance' } })).toEqual(['finance'])
    expect(packsFromMembership({ capability_packs: null, capabilities: {} })).toEqual([])
  })
})

describe('isOauthOnlyUser', () => {
  it('treats a hydrated user with null password_hash as oauth-only', () => {
    expect(isOauthOnlyUser({ id: 'u1', password_hash: null })).toBe(true)
    expect(isOauthOnlyUser({ id: 'u1', password_hash: 'hashed' })).toBe(false)
  })

  it('does not treat a JWT principal (no password_hash key) as oauth-only', () => {
    expect(isOauthOnlyUser({ id: 'u1', email: 'a@b.test' })).toBe(false)
  })
})

describe('resolveSettingsCapabilities — role variants', () => {
  it('solo agent (personal owner) has billing, not team', () => {
    const caps = resolveSettingsCapabilities({ memberships: [personalOwner()] })
    expect(caps).toMatchObject({
      canManageTeam: false,
      canSeeBilling: true,
      capability_packs: [],
    })
  })

  it('grants team to agency owners and admins', () => {
    for (const role of ['owner', 'admin']) {
      const caps = resolveSettingsCapabilities({
        memberships: [personalOwner(), agencyMembership(role)],
      })
      expect(caps.canManageTeam).toBe(true)
      expect(caps.canSeeBilling).toBe(true)
    }
  })

  it('denies team to agency members and guests', () => {
    for (const role of ['member', 'guest']) {
      const caps = resolveSettingsCapabilities({
        memberships: [personalOwner(), agencyMembership(role)],
      })
      expect(caps.canManageTeam).toBe(false)
    }
  })

  it('proves guest-only callers have no billing', () => {
    const caps = resolveSettingsCapabilities({
      memberships: [agencyMembership('guest')],
    })
    expect(caps.canSeeBilling).toBe(false)
    expect(caps.canManageTeam).toBe(false)
  })
})

describe('buildSettingsIndex — menu contains/excludes expected items', () => {
  it('solo agent → no team group', () => {
    const body = buildSettingsIndex({
      memberships: [personalOwner()],
      user: { id: 'u1', password_hash: 'x' },
    })
    expect(groupIds(body)).toEqual(['account', 'security', 'billing', 'danger'])
    expect(groupIds(body)).not.toContain('team')
    expect(itemIds(body)).toEqual(expect.arrayContaining([
      'profile', 'password', 'two_factor', 'sessions',
      'billing_notifications', 'subscription', 'delete_account',
    ]))
    expect(itemIds(body)).not.toContain('members')
  })

  it('agency owner/admin → team group present', () => {
    for (const role of ['owner', 'admin']) {
      const body = buildSettingsIndex({
        memberships: [personalOwner(), agencyMembership(role)],
        user: { id: 'u1', password_hash: 'x' },
      })
      expect(groupIds(body)).toContain('team')
      expect(itemIds(body)).toEqual(expect.arrayContaining(['members', 'roles', 'delete_account']))
    }
  })

  it('member → no team group (still sees account, security, billing, danger)', () => {
    const body = buildSettingsIndex({
      memberships: [personalOwner(), agencyMembership('member')],
      user: { id: 'u1', password_hash: 'x' },
    })
    expect(groupIds(body)).not.toContain('team')
    expect(itemIds(body)).not.toContain('members')
    expect(itemIds(body)).toEqual(expect.arrayContaining(['profile', 'delete_account', 'billing_notifications']))
  })

  it('oauth-only → no password item', () => {
    const body = buildSettingsIndex({
      memberships: [personalOwner()],
      user: { id: 'u1', password_hash: null },
    })
    expect(itemIds(body)).not.toContain('password')
    expect(itemIds(body)).toEqual(expect.arrayContaining(['two_factor', 'sessions']))
    expect(body.capabilities.password).toBe(false)
  })

  it('embeds nested security + billing capabilities from the snapshot', () => {
    const body = buildSettingsIndex({
      memberships: [personalOwner()],
      user: { id: 'u1', password_hash: 'x', totp_enabled: true },
      snapshot: {
        two_factor_enrolled: true,
        active_session_count: 3,
        plan: 'semsar',
        display_name: 'Semsar',
        renews_at: '2026-10-01T00:00:00Z',
        past_due: false,
      },
    })
    expect(body.capabilities.security).toEqual({
      two_factor_enrolled: true,
      active_session_count: 3,
    })
    expect(body.capabilities.billing).toMatchObject({
      plan: 'semsar',
      display_name: 'Semsar',
      past_due: false,
    })
    const twoFa = body.groups.flatMap((g) => g.items).find((i) => i.id === 'two_factor')
    expect(twoFa.badge).toBeNull()
    const sessions = body.groups.flatMap((g) => g.items).find((i) => i.id === 'sessions')
    expect(sessions.badge).toEqual({ kind: 'count', value: 3 })
  })

  it('embeds nested security + billing capabilities from the snapshot', () => {
    const body = buildSettingsIndex({
      memberships: [personalOwner()],
      user: { id: 'u1', password_hash: 'x', totp_enabled: true },
      snapshot: {
        two_factor_enrolled: true,
        active_session_count: 3,
        plan: 'semsar',
        display_name: 'Semsar',
        renews_at: '2026-10-01T00:00:00Z',
        past_due: false,
      },
    })
    expect(body.capabilities.security).toEqual({
      two_factor_enrolled: true,
      active_session_count: 3,
    })
    expect(body.capabilities.billing).toMatchObject({
      plan: 'semsar',
      display_name: 'Semsar',
      past_due: false,
    })
    const twoFa = body.groups.flatMap((g) => g.items).find((i) => i.id === 'two_factor')
    expect(twoFa.badge).toBeNull()
    const sessions = body.groups.flatMap((g) => g.items).find((i) => i.id === 'sessions')
    expect(sessions.badge).toEqual({ kind: 'count', value: 3 })
  })

  it('does not return empty groups', () => {
    const body = buildSettingsIndex({
      memberships: [agencyMembership('guest')],
      user: { id: 'u1', password_hash: 'x' },
    })
    expect(body.groups.length).toBeGreaterThan(0)
    for (const group of body.groups) {
      expect(group.items.length).toBeGreaterThan(0)
    }
    expect(groupIds(body)).toEqual(['account', 'security', 'danger'])
  })

  it('fallback omits team and billing but keeps Account + Security + Danger', () => {
    const body = buildSettingsIndex({ fallback: true, user: { id: 'u1' } })
    expect(groupIds(body)).toEqual(['account', 'security', 'danger'])
    expect(itemIds(body)).toEqual(expect.arrayContaining(['profile', 'two_factor', 'sessions', 'delete_account']))
    expect(itemIds(body)).not.toContain('members')
    expect(itemIds(body)).not.toContain('billing_notifications')
  })

  it('includes Wave 0.5 labels plus SHR-SET-001 extras', () => {
    const body = buildSettingsIndex({
      memberships: [personalOwner()],
      user: { id: 'u1', password_hash: 'x' },
    })
    const account = body.groups.find((g) => g.id === 'account')
    const danger = body.groups.find((g) => g.id === 'danger')
    expect(account).toMatchObject({
      id: 'account',
      label: 'Account',
      label_key: 'settings.groups.account',
      items: [expect.objectContaining({
        id: 'profile',
        label: 'Account & profile',
        label_key: 'settings.items.profile',
        route: '/settings/account',
        icon: 'user',
        badge: null,
      })],
    })
    expect(danger.items).toEqual([expect.objectContaining({
      id: 'delete_account',
      label: 'Delete account',
      route: '/settings/danger/delete-account',
    })])
    expect(body.capabilities).toMatchObject({
      account: true,
      danger: true,
      password: true,
      identity: { oauth_only: false, signin_method: 'email' },
      security: { two_factor_enrolled: false, active_session_count: 0 },
      billing: { plan: null, past_due: false },
      team: false,
      env: 'live',
    })
  })
})

describe('GET /api/settings/index', () => {
  it('unauthenticated → 401', async () => {
    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    registerRoutes(app, { authMiddleware })
    const res = await request(app).get('/api/settings/index')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('solo agent → no team group', async () => {
    const res = await request(createApp({
      memberships: [personalOwner()],
      user: { id: 'user-1', password_hash: 'x' },
    })).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(groupIds(res.body)).not.toContain('team')
    expect(itemIds(res.body)).toContain('profile')
    expect(itemIds(res.body)).toContain('delete_account')
  })

  it('agency owner → team group present', async () => {
    const res = await request(createApp({
      user: { id: 'user-1', password_hash: 'x' },
      memberships: [personalOwner(), agencyMembership('owner')],
    })).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(groupIds(res.body)).toContain('team')
    expect(itemIds(res.body)).toContain('members')
  })

  it('agency admin → team group present', async () => {
    const res = await request(createApp({
      user: { id: 'user-1', password_hash: 'x' },
      memberships: [personalOwner(), agencyMembership('admin')],
    })).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(groupIds(res.body)).toContain('team')
  })

  it('member → no team group', async () => {
    const res = await request(createApp({
      user: { id: 'user-1', password_hash: 'x' },
      memberships: [personalOwner(), agencyMembership('member')],
    })).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(groupIds(res.body)).not.toContain('team')
    expect(itemIds(res.body)).not.toContain('members')
  })

  it('oauth-only → no password item', async () => {
    const res = await request(createApp({
      user: { id: 'user-1', password_hash: null },
      memberships: [personalOwner()],
    })).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(itemIds(res.body)).not.toContain('password')
    expect(itemIds(res.body)).toContain('two_factor')
  })

  it('never trusts a client-supplied role header — gates from memberships', async () => {
    const res = await request(createApp({
      user: { id: 'user-1', role: 'owner', password_hash: 'x' },
      memberships: [agencyMembership('member')],
    })).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(groupIds(res.body)).not.toContain('team')
  })

  it('defensive fallback returns Account + Security + Danger when lookup fails', async () => {
    const res = await request(createApp({
      user: { id: 'user-1' },
      loadCallerContext: async () => {
        throw new Error('membership lookup exploded')
      },
    })).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(groupIds(res.body)).toEqual(['account', 'security', 'danger'])
    expect(itemIds(res.body)).toContain('delete_account')
    expect(itemIds(res.body)).not.toContain('members')
  })
})
