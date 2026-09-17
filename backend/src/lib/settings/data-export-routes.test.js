/**
 * Unit tests for issue #192b self-serve data export.
 *
 * Boots the routes against a bare Express app with mocked db + identity
 * and a synchronous `scheduleRun` stub so the async worker completes
 * before the response is asserted. Covers: request → 202 with id, poll
 * returns status, download 409s when not ready, expired returns 410,
 * export cap enforced, payload strips server-side secrets.
 */
import express from 'express'
import request from 'supertest'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  query: vi.fn(),
  findAll: vi.fn(),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findAgentForUser: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

// Route to a tmp dir so tests never pollute a shared path.
const TEST_EXPORT_DIR = path.join(tmpdir(), `wingcaster-export-test-${process.pid}`)
process.env.WINGCASTER_DATA_EXPORT_DIR = TEST_EXPORT_DIR

let registerDataExportRoutes
let runExport
let __testables

const USER_ID = 'user-1'
const USER = {
  id: USER_ID,
  email: 'agent@example.test',
  name: 'Alice',
  password_hash: 'SHOULD-NOT-LEAK-HASH',
  totp_secret_encrypted: 'SHOULD-NOT-LEAK-SECRET',
  totp_last_time_step: 99,
  data: { pref: 'x' },
}

// Stash the worker promise per-request so tests can await completion.
let lastRunPromise = null

async function createApp(overrides = {}) {
  const app = express()
  app.use(express.json())
  registerDataExportRoutes(app, {
    authMiddleware: (req, res, next) => {
      req.user = { id: overrides.userId || USER_ID }
      next()
    },
    // Sync scheduling so tests can assert on the completed row deterministically.
    // Store the promise for the caller to await after the POST resolves.
    scheduleRun: (id, uid) => {
      lastRunPromise = runExport(id, uid)
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.insert.mockReset()
  db.query.mockReset()
  db.findAll.mockReset()
  identity.findUserById.mockReset()
  identity.findAgentForUser.mockReset()

  identity.findUserById.mockResolvedValue({ ...USER })
  identity.findAgentForUser.mockResolvedValue({ id: USER_ID, name: 'Alice' })
  db.findAll.mockResolvedValue([])

  ;({ registerDataExportRoutes, runExport, __testables } = await import(
    './data-export-routes.js'
  ))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/settings/data-export', () => {
  it('creates a pending row and returns 202 with the id', async () => {
    // In-memory row store so we can track state changes across handler + worker.
    const rows = []
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT COUNT/i.test(sql)) return [{ n: 0 }]
      if (/^SELECT \* FROM data_exports/i.test(sql)) {
        return rows.filter((r) => r.id === params[0])
      }
      if (/^UPDATE data_exports/i.test(sql)) {
        const target = rows.find((r) => r.id === params[0])
        if (target) {
          // Simple: rebuild target by walking parameters — sufficient for the
          // fields the worker sets (status, started_at, file_path, bytes,
          // sha256, completed_at, error).
          const fieldsClause = sql.match(/SET\s+(.+?)\s+WHERE/is)?.[1] || ''
          const fields = fieldsClause.split(',').map((f) => f.trim().split(' ')[0])
          fields.forEach((field, i) => {
            if (field === 'updated_at') return
            target[field] = params[i + 1]
          })
        }
        return []
      }
      return []
    })
    db.insert.mockImplementation(async (collection, row) => {
      if (collection === 'data_exports') rows.push({ ...row })
    })

    const app = await createApp()
    const res = await request(app).post('/api/settings/data-export').send({})
    expect(res.status).toBe(202)
    expect(res.body.export).toMatchObject({ status: 'pending' })
    expect(res.body.export.id).toMatch(/[0-9a-f-]{36}/)

    // Wait for the async worker (captured in lastRunPromise) to complete.
    await lastRunPromise
    expect(rows[0]).toBeTruthy()
    expect(rows[0].status).toBe('complete')
    expect(rows[0].bytes).toBeGreaterThan(0)
    expect(rows[0].sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses to start a new export when MAX_ACTIVE_EXPORTS_PER_USER already active', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT COUNT/i.test(sql)) return [{ n: __testables.MAX_ACTIVE_EXPORTS_PER_USER }]
      return []
    })
    const app = await createApp()
    const res = await request(app).post('/api/settings/data-export').send({})
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('export_in_progress')
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('GET /api/settings/data-export/:id/status', () => {
  it('returns the caller\'s export row', async () => {
    db.query.mockResolvedValue([
      {
        id: 'exp-1',
        user_id: USER_ID,
        status: 'complete',
        bytes: '1024',
        sha256: 'a'.repeat(64),
        requested_at: '2026-09-16T00:00:00Z',
        started_at: '2026-09-16T00:00:01Z',
        completed_at: '2026-09-16T00:00:03Z',
        expires_at: '2026-09-23T00:00:00Z',
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/settings/data-export/exp-1/status')
    expect(res.status).toBe(200)
    expect(res.body.export).toMatchObject({
      id: 'exp-1',
      status: 'complete',
      bytes: 1024,
    })
  })

  it('returns 404 for another user\'s export', async () => {
    db.query.mockResolvedValue([])
    const app = await createApp()
    const res = await request(app).get('/api/settings/data-export/exp-someone-else/status')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/settings/data-export/:id/download', () => {
  it('streams the file when complete and not expired', async () => {
    const filePath = path.join(TEST_EXPORT_DIR, 'download-test.json')
    await __testables.ensureExportDir()
    await writeFile(filePath, '{"hello":"world"}', 'utf8')
    db.query.mockResolvedValue([
      {
        id: 'exp-1',
        user_id: USER_ID,
        status: 'complete',
        file_path: filePath,
        bytes: 17,
        sha256: 'b'.repeat(64),
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/settings/data-export/exp-1/download')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.headers['content-disposition']).toMatch(/attachment/)
    expect(res.headers['x-wingcaster-export-sha256']).toBe('b'.repeat(64))
    expect(res.text).toBe('{"hello":"world"}')
  })

  it('returns 409 not_ready while status is running', async () => {
    db.query.mockResolvedValue([
      {
        id: 'exp-1',
        user_id: USER_ID,
        status: 'running',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/settings/data-export/exp-1/download')
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('not_ready')
  })

  it('returns 410 expired once past the 7-day window', async () => {
    db.query.mockResolvedValue([
      {
        id: 'exp-1',
        user_id: USER_ID,
        status: 'complete',
        file_path: '/nowhere.json',
        expires_at: '2020-01-01T00:00:00Z',
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/settings/data-export/exp-1/download')
    expect(res.status).toBe(410)
    expect(res.body.error).toBe('expired')
  })

  it('returns 410 file_missing when the row is complete but disk is gone', async () => {
    db.query.mockResolvedValue([
      {
        id: 'exp-1',
        user_id: USER_ID,
        status: 'complete',
        file_path: path.join(TEST_EXPORT_DIR, 'never-created.json'),
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/settings/data-export/exp-1/download')
    expect(res.status).toBe(410)
    expect(res.body.error).toBe('file_missing')
  })
})

describe('collectExportPayload', () => {
  it('strips server-side secrets (password_hash, totp_secret_encrypted) from the payload', async () => {
    const payload = await __testables.collectExportPayload(USER_ID)
    const json = JSON.stringify(payload)
    expect(json).not.toContain('SHOULD-NOT-LEAK-HASH')
    expect(json).not.toContain('SHOULD-NOT-LEAK-SECRET')
    // Sanity — user email IS included (portability requires it).
    expect(payload.data_subject.email).toBe('agent@example.test')
    expect(payload.export_format_version).toBe(1)
  })
})
