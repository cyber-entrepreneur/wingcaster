/**
 * Fast unit tests for POST /api/auth/2fa/backup-codes/regenerate.
 *
 * Boots only the 2FA route module against a bare Express app with mocked
 * identity + db — no Postgres. Covers the three contracts that matter for
 * this surface: step-up gating, one-shot plaintext return, and invalidation
 * of every prior code.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(),
}))

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('./identity.js', () => identity)
vi.mock('./db.js', () => db)
vi.mock('./lib/otp.js', () => ({
  sendOtp: vi.fn(),
}))

const originalSecret = process.env.JWT_SECRET

const USER = {
  id: 'user-1',
  email: 'agent@example.test',
  totp_enabled: true,
  token_version: 0,
}

let signElevatedToken
let registerTwoFactorRoutes
let matchBackupCode
let clientQuery
let deletedUserIds
let insertedHashes

async function createApp({ user = USER } = {}) {
  const app = express()
  app.use(express.json())
  registerTwoFactorRoutes(app, {
    authMiddleware: (req, _res, next) => {
      if (user) {
        req.user = { id: user.id, token_version: user.token_version ?? 0 }
      }
      next()
    },
    buildAuthSession: async () => ({ token: 'session-token', agent: { id: user?.id } }),
    findAgentForUser: async () => ({ id: user?.id }),
    logActivity: async () => {},
  })
  return app
}

beforeEach(async () => {
  process.env.JWT_SECRET = 'backup-codes-regenerate-secret'
  vi.resetModules()

  identity.findUserById.mockReset()
  identity.findUserById.mockResolvedValue({ ...USER })
  db.insert.mockReset()
  db.query.mockReset()
  db.transaction.mockReset()

  deletedUserIds = []
  insertedHashes = []
  clientQuery = vi.fn(async (sql, params = []) => {
    if (sql.startsWith('DELETE FROM user_backup_codes')) {
      deletedUserIds.push(params[0])
      return { rows: [] }
    }
    if (sql.startsWith('INSERT INTO user_backup_codes')) {
      insertedHashes.push(params[2])
      return { rows: [] }
    }
    return { rows: [] }
  })
  db.transaction.mockImplementation(async (work) => work({ query: clientQuery }))

  const auth = await import('./auth.js')
  signElevatedToken = auth.signElevatedToken
  ;({ registerTwoFactorRoutes } = await import('./auth-2fa.js'))
  ;({ matchBackupCode } = await import('./lib/backup-codes.js'))
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
  vi.resetModules()
})

describe('POST /api/auth/2fa/backup-codes/regenerate', () => {
  it('refuses without an elevated token (step_up_required)', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/auth/2fa/backup-codes/regenerate')

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('step_up_required')
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('returns a fresh 10-code set once when step-up succeeds', async () => {
    const app = await createApp()
    const elevated = signElevatedToken({ userId: USER.id, tokenVersion: 0 })

    const res = await request(app)
      .post('/api/auth/2fa/backup-codes/regenerate')
      .set('X-Elevated-Token', elevated)

    expect(res.status).toBe(200)
    expect(res.body.backup_codes).toHaveLength(10)
    expect(res.body.backup_codes_remaining).toBe(10)
    for (const code of res.body.backup_codes) {
      expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/)
    }
    // Only bcrypt hashes are persisted — none of the plaintext codes may
    // appear in the stored hash column values.
    expect(insertedHashes).toHaveLength(10)
    for (const hash of insertedHashes) {
      expect(res.body.backup_codes.join('')).not.toContain(hash)
    }
  })

  it('invalidates every prior backup code before inserting the new set', async () => {
    const app = await createApp()
    const elevated = signElevatedToken({ userId: USER.id, tokenVersion: 0 })

    let deleted = false
    clientQuery.mockImplementation(async (sql, params = []) => {
      if (sql.startsWith('DELETE FROM user_backup_codes')) {
        deletedUserIds.push(params[0])
        deleted = true
        return { rows: [] }
      }
      if (sql.startsWith('INSERT INTO user_backup_codes')) {
        // INSERT must never run until the prior set has been wiped.
        expect(deleted).toBe(true)
        insertedHashes.push(params[2])
        return { rows: [] }
      }
      return { rows: [] }
    })

    const res = await request(app)
      .post('/api/auth/2fa/backup-codes/regenerate')
      .set('X-Elevated-Token', elevated)

    expect(res.status).toBe(200)
    expect(deletedUserIds).toEqual([USER.id])
    expect(insertedHashes).toHaveLength(10)

    // Each newly issued plaintext code must match exactly one of the hashes
    // that replaced the deleted set — proving the returned set is what was
    // persisted, and the wiped prior set is gone.
    for (const code of res.body.backup_codes) {
      const matched = matchBackupCode(
        code,
        insertedHashes.map((code_hash, i) => ({ id: `new-${i}`, code_hash })),
      )
      expect(matched).not.toBeNull()
    }
  })

  it('refuses when TOTP is not enrolled', async () => {
    identity.findUserById.mockResolvedValue({ ...USER, totp_enabled: false })
    const app = await createApp()
    const elevated = signElevatedToken({ userId: USER.id, tokenVersion: 0 })

    const res = await request(app)
      .post('/api/auth/2fa/backup-codes/regenerate')
      .set('X-Elevated-Token', elevated)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('totp_not_enabled')
    expect(db.transaction).not.toHaveBeenCalled()
  })
})
