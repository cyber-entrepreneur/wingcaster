/**
 * Unit tests for issue #189 WebAuthn / passkey routes.
 *
 * Boots the routes against a bare Express app with mocked db, identity,
 * and @simplewebauthn/server. The real WebAuthn crypto is out-of-scope for
 * unit tests (browser + authenticator required); we assert the shape:
 *   - register/begin persists a challenge tied to the user
 *   - register/complete refuses without a live challenge (410)
 *   - register/complete stores the credential on verification success
 *   - authenticate/complete rejects unknown credential id (401)
 *   - authenticate/complete verifies + returns a session on success
 *   - list / rename / revoke honour ownership + return 403/404 correctly
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

const webauthn = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('@simplewebauthn/server', () => webauthn)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let registerWebauthnRoutes

const USER = { id: 'user-1', email: 'agent@example.test', name: 'Alice' }
const AGENT = { id: 'agent-1', name: 'Alice' }
const CHALLENGE = 'mock-challenge-abc123'

async function createApp(overrides = {}) {
  const app = express()
  app.use(express.json())
  registerWebauthnRoutes(app, {
    authMiddleware: overrides.skipAuth
      ? undefined
      : (req, res, next) => {
          req.user = { id: overrides.userId || USER.id }
          next()
        },
    buildAuthSession: async () => ({ token: 'session-jwt', agent: AGENT }),
    findAgentForUser: async () => AGENT,
    logActivity: vi.fn(),
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.insert.mockReset()
  db.query.mockReset()
  identity.findUserById.mockReset()
  identity.findUserById.mockResolvedValue({ ...USER })
  webauthn.generateRegistrationOptions.mockReset()
  webauthn.generateAuthenticationOptions.mockReset()
  webauthn.verifyRegistrationResponse.mockReset()
  webauthn.verifyAuthenticationResponse.mockReset()

  ;({ registerWebauthnRoutes } = await import('./webauthn-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/auth/webauthn/register/begin', () => {
  it('returns options + persists a challenge scoped to the user', async () => {
    webauthn.generateRegistrationOptions.mockResolvedValue({ challenge: CHALLENGE, rp: {}, user: {} })
    db.query.mockImplementation(async (sql) => {
      if (/^DELETE FROM webauthn_challenges/i.test(sql)) return []
      if (/^SELECT \* FROM webauthn_credentials/i.test(sql)) return [] // no existing creds
      return []
    })
    const app = await createApp()
    const res = await request(app).post('/api/auth/webauthn/register/begin').send({})
    expect(res.status).toBe(200)
    expect(res.body.options.challenge).toBe(CHALLENGE)
    // Challenge persisted (via insert('webauthn_challenges', ...))
    expect(db.insert.mock.calls.some((c) => c[0] === 'webauthn_challenges')).toBe(true)
  })
})

describe('POST /api/auth/webauthn/register/complete', () => {
  it('stores the verified credential and returns 201', async () => {
    // Sequence of query calls: delete stale challenge (in persistChallenge —
    // not reached), consumeChallenge SELECT returns one row, then UPDATE.
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT \* FROM webauthn_challenges/i.test(sql)) {
        return [
          {
            id: 'ch-1',
            user_id: USER.id,
            purpose: 'register',
            challenge: CHALLENGE,
            expires_at: new Date(Date.now() + 30_000).toISOString(),
            consumed_at: null,
          },
        ]
      }
      return []
    })
    webauthn.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credentialID: Buffer.from('cred-id-bytes'),
        credentialPublicKey: Buffer.from('pubkey-bytes'),
        counter: 0,
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        aaguid: '00000000-0000-0000-0000-000000000000',
      },
    })

    const app = await createApp()
    const res = await request(app)
      .post('/api/auth/webauthn/register/complete')
      .send({
        name: 'MacBook Touch ID',
        response: {
          id: 'cred-id-b64',
          response: { transports: ['internal', 'hybrid'] },
        },
      })
    expect(res.status).toBe(201)
    expect(res.body.credential.name).toBe('MacBook Touch ID')
    expect(res.body.credential.backup_eligible).toBe(true)
    // Credential row inserted.
    const inserts = db.insert.mock.calls.filter((c) => c[0] === 'webauthn_credentials')
    expect(inserts.length).toBe(1)
    expect(inserts[0][1].transports).toEqual(['internal', 'hybrid'])
    // public_key + credential_id are base64url strings.
    expect(inserts[0][1].credential_id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(inserts[0][1].public_key).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rejects when challenge missing / expired (410)', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT \* FROM webauthn_challenges/i.test(sql)) return []
      return []
    })
    const app = await createApp()
    const res = await request(app)
      .post('/api/auth/webauthn/register/complete')
      .send({ response: { id: 'x', response: {} } })
    expect(res.status).toBe(410)
    expect(webauthn.verifyRegistrationResponse).not.toHaveBeenCalled()
  })

  it('rejects when webauthn verification fails (400)', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT \* FROM webauthn_challenges/i.test(sql)) {
        return [
          {
            id: 'ch-1',
            user_id: USER.id,
            purpose: 'register',
            challenge: CHALLENGE,
            expires_at: new Date(Date.now() + 30_000).toISOString(),
          },
        ]
      }
      return []
    })
    webauthn.verifyRegistrationResponse.mockResolvedValue({ verified: false })
    const app = await createApp()
    const res = await request(app)
      .post('/api/auth/webauthn/register/complete')
      .send({ response: { id: 'x', response: {} } })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/webauthn/authenticate/complete', () => {
  it('mints a session on signature verify + advances sign_count', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT \* FROM webauthn_credentials WHERE credential_id/i.test(sql)) {
        return [
          {
            id: 'wc-1',
            user_id: USER.id,
            credential_id: 'cred-id-b64',
            public_key: Buffer.from('pk').toString('base64url'),
            sign_count: 3,
            transports: ['internal'],
            revoked_at: null,
          },
        ]
      }
      if (/^SELECT \* FROM webauthn_challenges/i.test(sql)) {
        return [
          {
            id: 'ch-1',
            user_id: USER.id,
            purpose: 'authenticate',
            challenge: CHALLENGE,
            expires_at: new Date(Date.now() + 30_000).toISOString(),
          },
        ]
      }
      return []
    })
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 4 },
    })
    const app = await createApp()
    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/complete')
      .send({ response: { id: 'cred-id-b64', response: {} } })
    expect(res.status).toBe(200)
    expect(res.body.token).toBe('session-jwt')
    expect(res.body.factor_used).toBe('passkey')
    // sign_count advanced via UPDATE
    expect(db.query.mock.calls.some((c) => /^UPDATE webauthn_credentials SET sign_count/i.test(c[0]))).toBe(true)
  })

  it('returns 401 when credential id is unknown', async () => {
    db.query.mockResolvedValue([])
    const app = await createApp()
    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/complete')
      .send({ response: { id: 'unknown', response: {} } })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/auth/webauthn/credentials/:id', () => {
  it('revokes when the caller owns the credential', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT id, user_id, revoked_at FROM webauthn_credentials/i.test(sql)) {
        return [{ id: params[0], user_id: USER.id, revoked_at: null }]
      }
      return []
    })
    const app = await createApp()
    const res = await request(app).delete('/api/auth/webauthn/credentials/wc-1')
    expect(res.status).toBe(204)
    expect(db.query.mock.calls.some((c) => /^UPDATE webauthn_credentials SET revoked_at/i.test(c[0]))).toBe(true)
  })

  it('refuses when the credential belongs to someone else (403)', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT id, user_id, revoked_at FROM webauthn_credentials/i.test(sql)) {
        return [{ id: params[0], user_id: 'someone-else', revoked_at: null }]
      }
      return []
    })
    const app = await createApp()
    const res = await request(app).delete('/api/auth/webauthn/credentials/wc-1')
    expect(res.status).toBe(403)
  })

  it('returns 404 when the credential does not exist', async () => {
    db.query.mockResolvedValue([])
    const app = await createApp()
    const res = await request(app).delete('/api/auth/webauthn/credentials/does-not-exist')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/auth/webauthn/credentials/:id/rename', () => {
  it('updates the friendly name on ownership match', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT id, user_id FROM webauthn_credentials/i.test(sql)) {
        return [{ id: params[0], user_id: USER.id }]
      }
      return []
    })
    const app = await createApp()
    const res = await request(app)
      .post('/api/auth/webauthn/credentials/wc-1/rename')
      .send({ name: 'Work YubiKey' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Work YubiKey')
  })

  it('rejects an empty name', async () => {
    db.query.mockResolvedValue([])
    const app = await createApp()
    const res = await request(app).post('/api/auth/webauthn/credentials/wc-1/rename').send({})
    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/webauthn/credentials', () => {
  it("lists caller's active credentials", async () => {
    db.query.mockResolvedValue([
      {
        id: 'wc-1',
        user_id: USER.id,
        credential_id: 'cred-1',
        name: 'iPhone',
        transports: ['internal', 'hybrid'],
        backup_eligible: true,
        backup_state: true,
        last_used_at: null,
        created_at: '2026-09-15T00:00:00Z',
        revoked_at: null,
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/auth/webauthn/credentials')
    expect(res.status).toBe(200)
    expect(res.body.credentials).toHaveLength(1)
    expect(res.body.credentials[0].name).toBe('iPhone')
    expect(res.body.credentials[0].transports).toEqual(['internal', 'hybrid'])
  })
})
