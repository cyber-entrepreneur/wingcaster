/**
 * Unit tests for issue #192a Personal Access Tokens.
 *
 * Boots only the api-tokens module against a bare Express app with mocked
 * db + identity. Covers: create returns raw once, list never leaks hash,
 * revoke is ownership-gated, bearer authenticate handles revoked/expired,
 * validation rejects unknown scopes, cap enforced.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  query: vi.fn(),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let registerApiTokenRoutes
let authenticateWithApiToken
let __testables

const USER = { id: 'user-1', email: 'agent@example.test', token_version: 3 }

async function createApp(overrides = {}) {
  const app = express()
  app.use(express.json())
  registerApiTokenRoutes(app, {
    authMiddleware: (req, res, next) => {
      req.user = { id: overrides.userId || USER.id, agency_id: overrides.agencyId || null }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.insert.mockReset()
  db.query.mockReset()
  identity.findUserById.mockReset()
  identity.findUserById.mockResolvedValue({ ...USER })

  ;({ registerApiTokenRoutes, authenticateWithApiToken, __testables } = await import(
    './api-tokens-routes.js'
  ))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/settings/api-tokens', () => {
  beforeEach(() => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT COUNT/i.test(sql)) return [{ n: 0 }]
      if (/^SELECT 1 FROM api_tokens/i.test(sql)) return []
      return []
    })
  })

  it('mints a wc_pat_-prefixed token returned exactly once + records the row', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/settings/api-tokens')
      .send({ name: 'My CRM Sync', scopes: ['listings:read', 'inquiries:read'] })
    expect(res.status).toBe(201)
    expect(res.body.token).toMatch(/^wc_pat_/)
    expect(res.body.token.length).toBeGreaterThan(40)
    expect(res.body.record).toMatchObject({
      name: 'My CRM Sync',
      scopes: ['inquiries:read', 'listings:read'], // sorted
    })
    expect(res.body.record.hashed_secret).toBeUndefined() // never leak the hash
    const inserts = db.insert.mock.calls.filter((c) => c[0] === 'api_tokens')
    expect(inserts.length).toBe(1)
    expect(inserts[0][1].hashed_secret).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects missing name with 400', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/settings/api-tokens').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/name is required/)
  })

  it('rejects a scope that is not on the supported list', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/settings/api-tokens')
      .send({ name: 'X', scopes: ['listings:read', 'billing:steal-money'] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Unsupported scope/)
  })

  it('rejects an expires_at in the past', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/settings/api-tokens')
      .send({ name: 'X', expires_at: '2020-01-01T00:00:00Z' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/must be in the future/)
  })

  it('refuses to create above MAX_TOKENS_PER_USER active tokens', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT COUNT/i.test(sql)) return [{ n: __testables.MAX_TOKENS_PER_USER }]
      return []
    })
    const app = await createApp()
    const res = await request(app).post('/api/settings/api-tokens').send({ name: 'One too many' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('token_limit_reached')
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('normalises scopes to unique+sorted', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/settings/api-tokens')
      .send({ name: 'X', scopes: ['listings:read', 'listings:read', 'contacts:read'] })
    expect(res.status).toBe(201)
    expect(res.body.record.scopes).toEqual(['contacts:read', 'listings:read'])
  })
})

describe('GET /api/settings/api-tokens', () => {
  it('lists caller tokens without hashed_secret', async () => {
    db.query.mockResolvedValue([
      {
        id: 't-1',
        user_id: USER.id,
        name: 'CRM',
        hashed_secret: 'SHOULD-NOT-LEAK',
        scopes: ['listings:read'],
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        created_at: '2026-09-15T00:00:00Z',
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/settings/api-tokens')
    expect(res.status).toBe(200)
    expect(res.body.tokens.length).toBe(1)
    const listed = res.body.tokens[0]
    expect(listed.hashed_secret).toBeUndefined()
    expect(listed.name).toBe('CRM')
    expect(JSON.stringify(res.body)).not.toContain('SHOULD-NOT-LEAK')
  })
})

describe('DELETE /api/settings/api-tokens/:id', () => {
  it('returns 204 and updates revoked_at on ownership match', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT id, user_id, revoked_at/i.test(sql)) {
        return [{ id: params[0], user_id: USER.id, revoked_at: null }]
      }
      return []
    })
    const app = await createApp()
    const res = await request(app).delete('/api/settings/api-tokens/t-1')
    expect(res.status).toBe(204)
    const updates = db.query.mock.calls.filter((c) => /^UPDATE api_tokens/i.test(c[0]))
    expect(updates.length).toBe(1)
  })

  it('refuses a token owned by a different user with 403', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT id, user_id, revoked_at/i.test(sql)) {
        return [{ id: params[0], user_id: 'someone-else', revoked_at: null }]
      }
      return []
    })
    const app = await createApp()
    const res = await request(app).delete('/api/settings/api-tokens/t-1')
    expect(res.status).toBe(403)
  })

  it('returns 404 for a missing token', async () => {
    db.query.mockResolvedValue([])
    const app = await createApp()
    const res = await request(app).delete('/api/settings/api-tokens/does-not-exist')
    expect(res.status).toBe(404)
  })
})

describe('authenticateWithApiToken (bearer)', () => {
  it('resolves an active token to its owning user + touches last_used_at', async () => {
    const raw = __testables.generateRawToken()
    const hash = __testables.hashSecret(raw)
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT \* FROM api_tokens/i.test(sql) && params?.[0] === hash) {
        return [
          {
            id: 't-1',
            user_id: USER.id,
            hashed_secret: hash,
            scopes: [],
            revoked_at: null,
            expires_at: null,
          },
        ]
      }
      if (/^UPDATE api_tokens SET last_used_at/i.test(sql)) return []
      return []
    })
    const result = await authenticateWithApiToken(raw)
    expect(result?.user.id).toBe(USER.id)
    expect(result?.tokenRow.id).toBe('t-1')
    // Give the fire-and-forget UPDATE a tick.
    await new Promise((r) => setImmediate(r))
    expect(db.query.mock.calls.some((c) => /^UPDATE api_tokens SET last_used_at/i.test(c[0]))).toBe(true)
  })

  it('refuses a revoked token', async () => {
    const raw = __testables.generateRawToken()
    const hash = __testables.hashSecret(raw)
    db.query.mockResolvedValue([
      {
        id: 't-1',
        user_id: USER.id,
        hashed_secret: hash,
        scopes: [],
        revoked_at: '2026-09-15T00:00:00Z',
        expires_at: null,
      },
    ])
    const result = await authenticateWithApiToken(raw)
    expect(result).toBeNull()
  })

  it('refuses an expired token', async () => {
    const raw = __testables.generateRawToken()
    const hash = __testables.hashSecret(raw)
    db.query.mockResolvedValue([
      {
        id: 't-1',
        user_id: USER.id,
        hashed_secret: hash,
        scopes: [],
        revoked_at: null,
        expires_at: '2020-01-01T00:00:00Z',
      },
    ])
    const result = await authenticateWithApiToken(raw)
    expect(result).toBeNull()
  })

  it('refuses garbage / non-wc_pat_ input without touching the DB', async () => {
    expect(await authenticateWithApiToken('')).toBeNull()
    expect(await authenticateWithApiToken('wc_jwt_something')).toBeNull()
    expect(await authenticateWithApiToken('wc_pat_')).toBeNull()
    expect(await authenticateWithApiToken('wc_pat_!!!invalid')).toBeNull()
    expect(db.query).not.toHaveBeenCalled()
  })
})
