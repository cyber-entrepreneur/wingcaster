/**
 * Unit tests for T4 per-resource token scope enforcement.
 *
 * Covers:
 *   - JWT session always passes (resource scopes are PAT-only)
 *   - PAT with empty resource_scopes passes (unrestricted, H2 default)
 *   - PAT with matching {resource_type, resource_id} passes
 *   - PAT with only wrong-type entries fails
 *   - PAT with wrong resource_id fails; failure payload names resource_id
 *   - Route missing a resolver → 400 api_token_resource_not_resolved
 *   - attachApiTokenResourceScopes: happy path + fail-safe on DB error
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../db.js', () => db)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let requireApiTokenResource
let attachApiTokenResourceScopes

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  ;({ requireApiTokenResource, attachApiTokenResourceScopes } = await import(
    './api-token-resource.js'
  ))
})

afterEach(() => vi.restoreAllMocks())

function makeApp({ user, resourceScopes, param = 'id' }) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = user
    if (resourceScopes !== undefined) req.api_token_resource_scopes = resourceScopes
    next()
  })
  app.put(
    '/agencies/:id/mfa-policy',
    requireApiTokenResource({
      resourceType: 'agency',
      resolve: (r) => r.params[param],
    }),
    (_req, res) => res.json({ ok: true }),
  )
  app.put(
    '/broken',
    requireApiTokenResource({
      resourceType: 'agency',
      resolve: () => null, // simulates a route-authoring bug
    }),
    (_req, res) => res.json({ ok: true }),
  )
  return app
}

describe('requireApiTokenResource (middleware)', () => {
  it('JWT session passes without touching resource_scopes', async () => {
    const app = makeApp({ user: { id: 'u-1' } })
    const res = await request(app).put('/agencies/agency-a/mfa-policy').send({})
    expect(res.status).toBe(200)
  })

  it('PAT with empty resource_scopes passes (unrestricted, H2 default)', async () => {
    const app = makeApp({
      user: { id: 'u-1', api_token_id: 't-1' },
      resourceScopes: [],
    })
    const res = await request(app).put('/agencies/agency-a/mfa-policy').send({})
    expect(res.status).toBe(200)
  })

  it('PAT with matching {resource_type, resource_id} passes', async () => {
    const app = makeApp({
      user: { id: 'u-1', api_token_id: 't-1' },
      resourceScopes: [{ resource_type: 'agency', resource_id: 'agency-a' }],
    })
    const res = await request(app).put('/agencies/agency-a/mfa-policy').send({})
    expect(res.status).toBe(200)
  })

  it('PAT with wrong resource_id FAILS with 403 + names target in payload', async () => {
    const app = makeApp({
      user: { id: 'u-1', api_token_id: 't-1' },
      resourceScopes: [{ resource_type: 'agency', resource_id: 'agency-a' }],
    })
    const res = await request(app).put('/agencies/agency-b/mfa-policy').send({})
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('api_token_resource_scope_missing')
    expect(res.body.resource_id).toBe('agency-b')
    expect(res.body.resource_type).toBe('agency')
    expect(res.body.declared_resource_scopes).toEqual([
      { resource_type: 'agency', resource_id: 'agency-a' },
    ])
  })

  it('PAT with only wrong-type entries FAILS (no cross-resource leak)', async () => {
    const app = makeApp({
      user: { id: 'u-1', api_token_id: 't-1' },
      resourceScopes: [{ resource_type: 'listing', resource_id: 'agency-a' }],
    })
    const res = await request(app).put('/agencies/agency-a/mfa-policy').send({})
    expect(res.status).toBe(403)
  })

  it('resolver returning null → 400 api_token_resource_not_resolved (route-authoring bug)', async () => {
    const app = makeApp({
      user: { id: 'u-1', api_token_id: 't-1' },
      resourceScopes: [{ resource_type: 'agency', resource_id: 'agency-a' }],
    })
    const res = await request(app).put('/broken').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('api_token_resource_not_resolved')
  })

  it('missing api_token_resource_scopes context passes (treated as unrestricted)', async () => {
    const app = makeApp({ user: { id: 'u-1', api_token_id: 't-1' } })
    const res = await request(app).put('/agencies/agency-a/mfa-policy').send({})
    expect(res.status).toBe(200)
  })
})

describe('requireApiTokenResource — factory validation', () => {
  it('throws when resourceType missing', () => {
    expect(() =>
      requireApiTokenResource({ resolve: () => 'x' }),
    ).toThrow(/resourceType/)
  })
  it('throws when resolve missing / not a function', () => {
    expect(() =>
      requireApiTokenResource({ resourceType: 'agency' }),
    ).toThrow(/resolve/)
    expect(() =>
      requireApiTokenResource({ resourceType: 'agency', resolve: 'not-a-fn' }),
    ).toThrow(/resolve/)
  })
})

describe('attachApiTokenResourceScopes', () => {
  it('populates req.api_token_resource_scopes from the token row', async () => {
    db.query.mockResolvedValue([
      {
        resource_scopes: [{ resource_type: 'agency', resource_id: 'agency-a' }],
      },
    ])
    const req = {}
    await attachApiTokenResourceScopes(req, 't-1')
    expect(req.api_token_resource_scopes).toEqual([
      { resource_type: 'agency', resource_id: 'agency-a' },
    ])
  })

  it('no-ops for JWT session (missing api_token_id)', async () => {
    const req = {}
    await attachApiTokenResourceScopes(req, null)
    expect(req.api_token_resource_scopes).toBeUndefined()
    expect(db.query).not.toHaveBeenCalled()
  })

  it('is fail-open on DB error (sets [] rather than crashing the request)', async () => {
    db.query.mockRejectedValue(new Error('db down'))
    const req = {}
    await attachApiTokenResourceScopes(req, 't-1')
    expect(req.api_token_resource_scopes).toEqual([])
  })

  it('coerces null / non-array to []', async () => {
    db.query.mockResolvedValue([{ resource_scopes: null }])
    const req = {}
    await attachApiTokenResourceScopes(req, 't-1')
    expect(req.api_token_resource_scopes).toEqual([])
  })
})
