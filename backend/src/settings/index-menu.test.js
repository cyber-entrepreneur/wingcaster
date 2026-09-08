import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  buildSettingsIndex,
  normalizeCapabilityPacks,
  resolveSettingsCapabilities,
} from './index-menu.js'
import { registerSettingsRoutes } from './routes.js'

function itemIds(body) {
  return (body.groups || []).flatMap((group) => group.items.map((item) => item.id))
}

function groupIds(body) {
  return (body.groups || []).map((group) => group.id)
}

describe('normalizeCapabilityPacks', () => {
  it('falls back to [] when packs are missing (pre BE-BLOCKER-29)', () => {
    expect(normalizeCapabilityPacks(undefined)).toEqual([])
    expect(normalizeCapabilityPacks(null)).toEqual([])
    expect(normalizeCapabilityPacks({})).toEqual([])
  })

  it('keeps string pack ids', () => {
    expect(normalizeCapabilityPacks(['finance', ' marketer ', ''])).toEqual(['finance', 'marketer'])
  })
})

describe('resolveSettingsCapabilities — role variants', () => {
  it('treats personal owner as account owner with billing, without team', () => {
    const caps = resolveSettingsCapabilities([
      {
        tenant_id: 'personal:u1',
        user_id: 'u1',
        role: 'owner',
        affiliation_mode: 'personal',
        status: 'active',
      },
    ])
    expect(caps).toMatchObject({
      isAccountOwner: true,
      canManageTeam: false,
      canManageBilling: true,
      capability_packs: [],
    })
  })

  it('grants team + billing to agency admins/owners', () => {
    for (const role of ['owner', 'admin']) {
      const caps = resolveSettingsCapabilities([
        {
          tenant_id: 'agency:a1',
          user_id: 'u1',
          role,
          affiliation_mode: 'exclusive',
          status: 'active',
          capability_packs: undefined,
        },
      ])
      expect(caps.canManageTeam).toBe(true)
      expect(caps.canManageBilling).toBe(true)
      expect(caps.capability_packs).toEqual([])
    }
  })

  it('denies team/billing to plain agency members and guests', () => {
    for (const role of ['member', 'guest']) {
      const caps = resolveSettingsCapabilities([
        {
          tenant_id: 'agency:a1',
          user_id: 'u1',
          role,
          affiliation_mode: role === 'guest' ? 'non_exclusive' : 'exclusive',
          status: 'active',
        },
      ])
      expect(caps.canManageTeam).toBe(false)
      expect(caps.canManageBilling).toBe(false)
      expect(caps.isAccountOwner).toBe(false)
    }
  })

  it('grants billing (not team) to member + finance capability pack', () => {
    const caps = resolveSettingsCapabilities([
      {
        tenant_id: 'agency:a1',
        user_id: 'u1',
        role: 'member',
        affiliation_mode: 'exclusive',
        status: 'active',
        capability_packs: ['finance'],
      },
    ])
    expect(caps.canManageBilling).toBe(true)
    expect(caps.canManageTeam).toBe(false)
    expect(caps.capability_packs).toEqual(['finance'])
  })
})

describe('buildSettingsIndex — menu contains/excludes expected items', () => {
  it('personal owner sees account, security, billing, danger — not team', () => {
    const body = buildSettingsIndex({
      memberships: [{
        tenant_id: 'personal:u1',
        role: 'owner',
        affiliation_mode: 'personal',
        status: 'active',
      }],
    })
    expect(groupIds(body)).toEqual(['account', 'security', 'billing', 'danger'])
    expect(itemIds(body)).toEqual(expect.arrayContaining([
      'profile',
      'two_factor',
      'sessions',
      'billing_notifications',
      'subscription',
      'delete_account',
    ]))
    expect(itemIds(body)).not.toContain('members')
    expect(itemIds(body)).not.toContain('roles')
  })

  it('agency admin sees team items', () => {
    const body = buildSettingsIndex({
      memberships: [
        { tenant_id: 'personal:u1', role: 'owner', affiliation_mode: 'personal', status: 'active' },
        { tenant_id: 'agency:a1', role: 'admin', affiliation_mode: 'exclusive', status: 'active' },
      ],
    })
    expect(groupIds(body)).toContain('team')
    expect(itemIds(body)).toEqual(expect.arrayContaining(['members', 'roles', 'delete_account']))
  })

  it('agency member without packs excludes team, billing, and danger', () => {
    const body = buildSettingsIndex({
      memberships: [{
        tenant_id: 'agency:a1',
        role: 'member',
        affiliation_mode: 'exclusive',
        status: 'active',
        capability_packs: [],
      }],
    })
    expect(groupIds(body)).toEqual(['account', 'security'])
    expect(itemIds(body)).toEqual(['profile', 'two_factor', 'sessions'])
    expect(itemIds(body)).not.toContain('delete_account')
    expect(itemIds(body)).not.toContain('members')
    expect(itemIds(body)).not.toContain('billing_notifications')
  })

  it('guest sees only account + security', () => {
    const body = buildSettingsIndex({
      memberships: [{
        tenant_id: 'agency:a1',
        role: 'guest',
        affiliation_mode: 'non_exclusive',
        status: 'active',
      }],
    })
    expect(groupIds(body)).toEqual(['account', 'security'])
    expect(itemIds(body)).not.toContain('delete_account')
  })

  it('finance pack member sees billing but not team or danger', () => {
    const body = buildSettingsIndex({
      memberships: [{
        tenant_id: 'agency:a1',
        role: 'member',
        affiliation_mode: 'exclusive',
        status: 'active',
        capability_packs: ['finance'],
      }],
    })
    expect(groupIds(body)).toEqual(['account', 'security', 'billing'])
    expect(itemIds(body)).toContain('billing_notifications')
    expect(itemIds(body)).not.toContain('members')
    expect(itemIds(body)).not.toContain('delete_account')
  })

  it('matches the documented response shape for account + danger items', () => {
    const body = buildSettingsIndex({
      memberships: [{
        tenant_id: 'personal:u1',
        role: 'owner',
        affiliation_mode: 'personal',
        status: 'active',
      }],
    })
    const account = body.groups.find((g) => g.id === 'account')
    const danger = body.groups.find((g) => g.id === 'danger')
    expect(account).toEqual({
      id: 'account',
      label: 'Account',
      items: [{ id: 'profile', label: 'Account & profile', route: '/settings/account' }],
    })
    expect(danger).toEqual({
      id: 'danger',
      label: 'Danger zone',
      items: [{ id: 'delete_account', label: 'Delete account', route: '/settings/delete-account' }],
    })
  })
})

describe('GET /api/settings/index', () => {
  function createApp(memberships) {
    const app = express()
    app.use(express.json())
    registerSettingsRoutes(app, {
      auth: (req, _res, next) => {
        req.user = { id: 'user-1' }
        next()
      },
      listMemberships: async () => memberships,
    })
    return app
  }

  it('returns gated menu for an agency owner (server-side, not client role)', async () => {
    const res = await request(createApp([
      { tenant_id: 'personal:user-1', role: 'owner', affiliation_mode: 'personal', status: 'active' },
      { tenant_id: 'agency:a1', role: 'owner', affiliation_mode: 'exclusive', status: 'active' },
    ])).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(groupIds(res.body)).toEqual(['account', 'security', 'billing', 'team', 'danger'])
    expect(itemIds(res.body)).toContain('members')
    // Response never echoes access metadata or client-trusted role fields.
    expect(JSON.stringify(res.body)).not.toMatch(/access|capability_packs|"role"/)
  })

  it('excludes team for a member even if a forged role were irrelevant', async () => {
    const res = await request(createApp([
      { tenant_id: 'agency:a1', role: 'member', affiliation_mode: 'exclusive', status: 'active' },
    ])).get('/api/settings/index')

    expect(res.status).toBe(200)
    expect(itemIds(res.body)).not.toContain('members')
    expect(itemIds(res.body)).not.toContain('delete_account')
  })
})
