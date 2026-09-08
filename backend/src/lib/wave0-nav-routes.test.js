import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loginSchema } from './validation.js'
import { normalizeClientEnv, wingcasterEnvMiddleware, WINGCASTER_ENV_HEADER } from './session-env.js'

const dal = vi.hoisted(() => ({
  findAll: vi.fn(async () => []),
  findOne: vi.fn(async () => null),
  insert: vi.fn(async (collection, item) => item),
  update: vi.fn(async () => 1),
}))

const identity = vi.hoisted(() => ({
  findAgentForUser: vi.fn(async () => ({ id: 'user-1', user_id: 'user-1', name: 'Agent' })),
  findUserByEmail: vi.fn(async () => null),
  findUserById: vi.fn(async () => ({
    id: 'user-1',
    email: 'agent@example.test',
    preferred_locale: 'en',
    active_tenant_id: 'personal:user-1',
    platform_role: null,
    verified: true,
    verified_at: '2026-01-01T00:00:00.000Z',
  })),
  updateUser: vi.fn(async (_id, patch) => ({
    id: 'user-1',
    email: 'agent@example.test',
    preferred_locale: patch.preferred_locale || 'en',
    active_tenant_id: patch.active_tenant_id || 'personal:user-1',
    platform_role: null,
  })),
}))

vi.mock('../db.js', () => dal)
vi.mock('../identity.js', () => identity)
vi.mock('../tenant-authorization.js', () => ({
  personalTenantId: (userId) => `personal:${userId}`,
}))

describe('loginSchema identifier_type', () => {
  it('accepts legacy email + password', () => {
    const parsed = loginSchema.safeParse({ email: 'a@b.co', password: 'secret' })
    expect(parsed.success).toBe(true)
  })

  it('accepts identifier_type email|username|phone', () => {
    for (const identifier_type of ['email', 'username', 'phone']) {
      const parsed = loginSchema.safeParse({
        identifier_type,
        identifier: identifier_type === 'email' ? 'a@b.co' : 'value',
        password: 'secret',
      })
      expect(parsed.success).toBe(true)
    }
  })

  it('rejects missing identifier pair', () => {
    const parsed = loginSchema.safeParse({ password: 'secret' })
    expect(parsed.success).toBe(false)
  })
})

describe('session-env middleware', () => {
  it('normalizes and stamps X-Wingcaster-Env', async () => {
    expect(normalizeClientEnv('TEST')).toBe('test')
    expect(normalizeClientEnv('live')).toBe('live')

    const app = express()
    app.use(wingcasterEnvMiddleware)
    app.get('/ping', (req, res) => {
      req.user = { env: 'test' }
      res.json({ ok: true })
    })

    const res = await request(app).get('/ping')
    expect(res.status).toBe(200)
    expect(res.headers[WINGCASTER_ENV_HEADER.toLowerCase()]).toBe('test')
  })
})

describe('wave0 nav routes', () => {
  let registerWave0NavRoutes

  beforeEach(async () => {
    vi.resetModules()
    Object.values(dal).forEach((fn) => fn.mockReset())
    Object.values(identity).forEach((fn) => fn.mockReset())
    dal.findAll.mockResolvedValue([])
    dal.findOne.mockResolvedValue(null)
    dal.insert.mockImplementation(async (_c, item) => item)
    dal.update.mockResolvedValue(1)
    identity.findUserById.mockResolvedValue({
      id: 'user-1',
      email: 'agent@example.test',
      preferred_locale: 'en',
      active_tenant_id: 'personal:user-1',
      platform_role: null,
      verified: true,
      verified_at: '2026-01-01T00:00:00.000Z',
    })
    identity.findAgentForUser.mockResolvedValue({ id: 'user-1', user_id: 'user-1', name: 'Agent' })
    identity.updateUser.mockImplementation(async (_id, patch) => ({
      id: 'user-1',
      email: 'agent@example.test',
      preferred_locale: patch.preferred_locale || 'en',
      active_tenant_id: patch.active_tenant_id || 'personal:user-1',
      platform_role: null,
    }))

    ;({ registerWave0NavRoutes } = await import('./wave0-nav-routes.js'))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function buildApp({ user = { id: 'user-1', env: 'live', platform_role: null }, adminOk = false } = {}) {
    const app = express()
    app.use(express.json())
    app.use(wingcasterEnvMiddleware)
    registerWave0NavRoutes(app, {
      authMiddleware: (req, _res, next) => {
        req.user = user
        next()
      },
      requirePlatformAdmin: (req, res, next) => (
        adminOk ? next() : res.status(403).json({ error: 'Forbidden' })
      ),
      buildAuthSession: async (u) => ({
        token: 'fresh-token',
        agent: { id: u.id, active_tenant_id: u.active_tenant_id, env: user.env },
      }),
      startSigninChallengeIfRequired: async () => null,
    })
    return app
  }

  it('GET /api/auth/me/tenants returns contract shape', async () => {
    dal.findAll.mockImplementation(async (collection) => {
      if (collection === 'tenant_memberships') {
        return [{ tenant_id: 'personal:user-1', user_id: 'user-1', role: 'owner', status: 'active' }]
      }
      if (collection === 'tenants') {
        return [{ id: 'personal:user-1', name: 'Personal', tenant_type: 'personal', status: 'active', settings: {} }]
      }
      if (collection === 'properties') return [{ id: 'p1', tenant_id: 'personal:user-1' }]
      return []
    })

    const res = await request(buildApp()).get('/api/auth/me/tenants')
    expect(res.status).toBe(200)
    expect(res.body.tenants).toHaveLength(1)
    expect(res.body.tenants[0]).toMatchObject({
      id: 'personal:user-1',
      name: 'Personal',
      role: 'owner',
      listingsCount: 1,
      agentsCount: 1,
      isActive: true,
    })
  })

  it('POST /api/auth/switch-tenant updates active tenant and returns session', async () => {
    dal.findOne.mockImplementation(async (collection, filter) => {
      if (collection === 'tenant_memberships') {
        return filter({ tenant_id: 'agency:a1', user_id: 'user-1', status: 'active', role: 'member' })
          ? { tenant_id: 'agency:a1', user_id: 'user-1', status: 'active', role: 'member' }
          : null
      }
      if (collection === 'tenants') {
        return { id: 'agency:a1', name: 'Agency', status: 'active', tenant_type: 'agency' }
      }
      return null
    })

    const res = await request(buildApp())
      .post('/api/auth/switch-tenant')
      .send({ tenantId: 'agency:a1' })

    expect(res.status).toBe(200)
    expect(identity.updateUser).toHaveBeenCalledWith('user-1', { active_tenant_id: 'agency:a1' })
    expect(res.body.token).toBe('fresh-token')
  })

  it('PATCH /api/users/me updates preferred_locale', async () => {
    const res = await request(buildApp())
      .patch('/api/users/me')
      .send({ preferred_locale: 'ar' })
    expect(res.status).toBe(200)
    expect(res.body.preferred_locale).toBe('ar')
  })

  it('notification list + mark-all-read', async () => {
    dal.findAll.mockImplementation(async (collection) => {
      if (collection === 'notifications') {
        return [{
          id: 'n1',
          user_id: 'user-1',
          title: 'Hello',
          body: 'World',
          type: 'consumer',
          read: false,
          created_at: '2026-01-02T00:00:00.000Z',
        }]
      }
      return []
    })

    const list = await request(buildApp()).get('/api/auth/me/notifications')
    expect(list.status).toBe(200)
    expect(list.body.unreadCount).toBe(1)
    expect(list.body.notifications[0]).toMatchObject({
      id: 'n1',
      title: 'Hello',
      snippet: 'World',
      unread: true,
    })

    const mark = await request(buildApp()).post('/api/auth/me/notifications/mark-all-read')
    expect(mark.status).toBe(200)
    expect(mark.body.success).toBe(true)
    expect(dal.update).toHaveBeenCalled()
  })

  it('POST /api/search scopes by persona', async () => {
    dal.findAll.mockImplementation(async (collection) => {
      if (collection === 'properties') {
        return [{
          id: 'listing-1',
          title: 'Marina view',
          city: 'Dubai',
          agent_id: 'user-1',
          tenant_id: 'personal:user-1',
        }]
      }
      return []
    })

    const res = await request(buildApp())
      .post('/api/search')
      .send({ query: 'marina', persona: 'agent' })
    expect(res.status).toBe(200)
    expect(res.body.groups.listings[0].id).toBe('listing-1')
  })

  it('POST /api/admin/env/switch requires platform admin and returns session', async () => {
    const denied = await request(buildApp({ adminOk: false }))
      .post('/api/admin/env/switch')
      .send({ target: 'test' })
    expect(denied.status).toBe(403)

    const ok = await request(buildApp({
      user: { id: 'user-1', env: 'live', platform_role: 'platform_admin' },
      adminOk: true,
    }))
      .post('/api/admin/env/switch')
      .send({ target: 'test' })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBe('fresh-token')
    expect(ok.headers[WINGCASTER_ENV_HEADER.toLowerCase()]).toBe('test')
  })

  it('OAuth start/callback support google|apple|facebook in dev mode', async () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    delete process.env.GOOGLE_OAUTH_CLIENT_ID
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET

    const app = buildApp()
    const start = await request(app).post('/api/auth/oauth/google/start').send({})
    expect(start.status).toBe(200)
    expect(start.body).toMatchObject({ provider: 'google', dev: true })
    expect(start.body.state).toBeTruthy()
    expect(start.body.dev_code).toMatch(/^dev_/)

    dal.findOne.mockImplementation(async (collection) => {
      if (collection === 'oauth_states') {
        return {
          id: start.body.state,
          platform: 'login:google',
          redirect_uri: 'http://localhost/callback',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }
      }
      if (collection === 'auth_oauth_identities') return null
      return null
    })

    // No matching WingCaster account for the synthetic OAuth email.
    identity.findUserByEmail.mockResolvedValue(null)
    const missing = await request(app)
      .post('/api/auth/oauth/google/callback')
      .send({ code: start.body.dev_code, state: start.body.state })
    expect(missing.status).toBe(404)
    expect(missing.body.code).toBe('oauth_account_not_found')

    // Linked by email → session issued.
    const start2 = await request(app).post('/api/auth/oauth/apple/start').send({})
    expect(start2.status).toBe(200)
    dal.findOne.mockImplementation(async (collection) => {
      if (collection === 'oauth_states') {
        return {
          id: start2.body.state,
          platform: 'login:apple',
          redirect_uri: 'http://localhost/callback',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        }
      }
      return null
    })
    identity.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'agent@example.test',
      verified: true,
      verified_at: '2026-01-01T00:00:00.000Z',
      preferred_locale: 'en',
    })
    const linked = await request(app)
      .post('/api/auth/oauth/apple/callback')
      .send({ code: start2.body.dev_code, state: start2.body.state })
    expect(linked.status).toBe(200)
    expect(linked.body.token).toBe('fresh-token')

    process.env.NODE_ENV = previous
  })
})
