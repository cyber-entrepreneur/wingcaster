/**
 * AGT-CTC-005 — contact export route tests (Express + mocked db).
 *
 * Covers: CSV is the default and only includes the caller's own contacts, the
 * vcard format switch, field selection, download headers, and a 400 on an
 * unsupported format.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../db.js', () => db)

let registerRoutes

async function createApp(userId = 'agent-1') {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

const allContacts = [
  { id: 'c1', assigned_agent_id: 'agent-1', name: 'Alice', email: 'alice@example.com', phone: '+9715', tags: ['vip'] },
  { id: 'c2', assigned_agent_id: 'agent-1', name: 'Bob', email: 'bob@example.com', phone: null, tags: [] },
  { id: 'c3', assigned_agent_id: 'other-agent', name: 'Not Mine', email: 'x@example.com' },
]

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  db.findAll.mockImplementation(async (_collection, pred) => allContacts.filter(pred || (() => true)))
  ;({ registerRoutes } = await import('./contact-export-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('GET /api/contacts/export', () => {
  it('defaults to CSV with only the caller\'s own contacts and download headers', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/contacts/export')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="contacts-\d{4}-\d{2}-\d{2}\.csv"/)
    expect(res.headers['x-contact-export-rows']).toBe('2')
    expect(res.text).toContain('Alice')
    expect(res.text).toContain('Bob')
    expect(res.text).not.toContain('Not Mine')
  })

  it('honours a field subset', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/contacts/export?fields=name,email')
    expect(res.status).toBe(200)
    const header = res.text.replace(/^\uFEFF/, '').split('\r\n')[0]
    expect(header).toBe('Name,Email')
  })

  it('serves vCard when format=vcard', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/contacts/export?format=vcard')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/vcard')
    expect(res.headers['content-disposition']).toContain('.vcf')
    expect(res.text.match(/BEGIN:VCARD/g)).toHaveLength(2)
  })

  it('returns 400 on an unsupported format', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/contacts/export?format=pdf')
    expect(res.status).toBe(400)
    expect(db.findAll).not.toHaveBeenCalled()
  })
})
