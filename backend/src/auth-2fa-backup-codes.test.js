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
import bcrypt from 'bcryptjs'
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

const OLD_RAW = 'ABCDEFGHJK'
const OLD_DISPLAY = 'ABCDE-FGHJK'

let signElevatedToken
let registerTwoFactorRoutes
let matchBackupCode
let clientQuery
let deletedUserIds
let insertedHashes
let storedRows
let logActivity

async function createApp({ user = USER } = {}) {
  const app = express()
  app.use(express.json())
  registerTwoFactorRoutes(app, {
    authMiddleware: (req, res, next) => {
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      req.user = { id: user.id, token_version: user.token_version ?? 0 }
      next()
    },
    buildAuthSession: async () => ({ token: 'session-token', agent: { id: user?.id } }),
    findAgentForUser: async () => ({ id: user?.id }),
    logActivity,
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
  storedRows = [{ id: 'old-1', code_hash: bcrypt.hashSync(OLD_RAW, 8) }]
  logActivity = vi.fn(async () => {})
  clientQuery = vi.fn(async (sql, params = []) => {
    if (sql.startsWith('DELETE FROM user_backup_codes')) {
      deletedUserIds.push(params[0])
      storedRows = []
      return { rows: [] }
    }
    if (sql.startsWith('INSERT INTO user_backup_codes')) {
      insertedHashes.push(params[2])
      storedRows.push({ id: params[0], code_hash: params[2] })
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
    const missing = await request(app).post('/api/auth/2fa/backup-codes/regenerate')
    expect(missing.status).toBe(401)
    expect(missing.body.code).toBe('step_up_required')

    const garbage = await request(app)
      .post('/api/auth/2fa/backup-codes/regenerate')
      .set('X-Elevated-Token', 'not-a-jwt')
    expect(garbage.status).toBe(401)
    expect(garbage.body.code).toBe('step_up_required')

    expect(db.transaction).not.toHaveBeenCalled()
    expect(matchBackupCode(OLD_DISPLAY, storedRows)?.id).toBe('old-1')
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
    expect(logActivity).toHaveBeenCalledWith({
      type: '2fa_backup_codes_regenerated',
      agent_id: USER.id,
      meta: {},
    })
  })

  it('invalidates every prior backup code before inserting the new set', async () => {
    expect(matchBackupCode(OLD_DISPLAY, storedRows)?.id).toBe('old-1')

    const app = await createApp()
    const elevated = signElevatedToken({ userId: USER.id, tokenVersion: 0 })

    let deleted = false
    clientQuery.mockImplementation(async (sql, params = []) => {
      if (sql.startsWith('DELETE FROM user_backup_codes')) {
        deletedUserIds.push(params[0])
        storedRows = []
        deleted = true
        return { rows: [] }
      }
      if (sql.startsWith('INSERT INTO user_backup_codes')) {
        // INSERT must never run until the prior set has been wiped.
        expect(deleted).toBe(true)
        insertedHashes.push(params[2])
        storedRows.push({ id: params[0], code_hash: params[2] })
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
    expect(storedRows.every((row) => row.id !== 'old-1')).toBe(true)
    expect(matchBackupCode(OLD_DISPLAY, storedRows)).toBeNull()
    expect(matchBackupCode(OLD_RAW, storedRows)).toBeNull()

    // Each newly issued plaintext code must match exactly one of the hashes
    // that replaced the deleted set — proving the returned set is what was
    // persisted, and the wiped prior set is gone.
    for (const code of res.body.backup_codes) {
      expect(matchBackupCode(code, storedRows)).not.toBeNull()
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
