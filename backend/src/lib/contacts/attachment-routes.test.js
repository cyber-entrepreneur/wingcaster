/**
 * Contact attachment routes — private + tenant-gated (AGT-CTC Pre-Approval Letter).
 *
 * Uses a mock DAL + in-memory storage + injected assertOwnsContact so the
 * ownership gate and private handling can be asserted without Postgres or disk.
 */
import { Readable } from 'node:stream'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '../authz.js'
import { registerRoutes } from './attachment-routes.js'

function memStorage() {
  const files = new Map()
  return {
    files,
    async put(key, buf) { files.set(key, Buffer.from(buf)); return { storageKey: key, size: buf.length } },
    async getStream(key) {
      if (!files.has(key)) { const e = new Error('missing'); e.code = 'ENOENT'; throw e }
      return Readable.from(files.get(key))
    },
    async remove(key) { return files.delete(key) },
    async exists(key) { return files.has(key) },
    publicUrlFor() { return null },
  }
}

let contacts
let attachments
let storage

function createApp(userId) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => { req.user = { id: userId }; next() },
    requireApiTokenScope: () => (_req, _res, next) => next(),
    assertOwnsContact: async (agentId, id) => {
      const c = contacts.find((row) => row.id === id)
      if (!c || c.assigned_agent_id !== agentId) throw new NotFoundError()
      return c
    },
    findOne: async (coll, pred) => (coll === 'contact_attachments' ? attachments : contacts).find(pred),
    findAll: async (coll, pred) => (coll === 'contact_attachments' ? attachments : contacts).filter(pred),
    insert: async (coll, row) => { if (coll === 'contact_attachments') attachments.push(row) },
    update: async (coll, pred, updater) => {
      const arr = coll === 'contacts' ? contacts : attachments
      const i = arr.findIndex(pred)
      if (i >= 0) arr[i] = updater(arr[i])
    },
    remove: async (coll, pred) => {
      const arr = coll === 'contact_attachments' ? attachments : contacts
      const i = arr.findIndex(pred)
      if (i >= 0) arr.splice(i, 1)
    },
    storage,
    logActivity: async () => {},
  })
  return app
}

beforeEach(() => {
  contacts = [
    { id: 'c-mine', assigned_agent_id: 'agent-1', agency_id: 'ag-1' },
    { id: 'c-theirs', assigned_agent_id: 'agent-2', agency_id: 'ag-2' },
  ]
  attachments = []
  storage = memStorage()
})
afterEach(() => vi.restoreAllMocks())

const PDF = Buffer.from('%PDF-1.4 pre-approval')

describe('POST /api/contacts/:id/attachments', () => {
  it('stores a PDF for the owner and links it to the contact, leaking no key/url', async () => {
    const res = await request(createApp('agent-1'))
      .post('/api/contacts/c-mine/attachments')
      .field('kind', 'pre_approval_letter')
      .attach('file', PDF, { filename: 'letter.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(201)
    expect(res.body.attachment).toMatchObject({ kind: 'pre_approval_letter', filename: 'letter.pdf', content_type: 'application/pdf' })
    expect(res.body.attachment.storage_key).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toMatch(/uploads|storage_key|private/i)
    expect(attachments).toHaveLength(1)
    expect(storage.files.size).toBe(1)
    // Reference linked onto the contact so it round-trips in the form.
    expect(contacts.find((c) => c.id === 'c-mine').pre_approval_letter.attachment_id).toBe(res.body.attachment.id)
  })

  it('returns 404 when uploading to a contact owned by someone else (no cross-tenant write)', async () => {
    const res = await request(createApp('agent-1'))
      .post('/api/contacts/c-theirs/attachments')
      .attach('file', PDF, { filename: 'x.pdf', contentType: 'application/pdf' })
    expect(res.status).toBe(404)
    expect(attachments).toHaveLength(0)
    expect(storage.files.size).toBe(0)
  })

  it('rejects an unsupported content type with 415', async () => {
    const res = await request(createApp('agent-1'))
      .post('/api/contacts/c-mine/attachments')
      .attach('file', Buffer.from('hi'), { filename: 'notes.txt', contentType: 'text/plain' })
    expect(res.status).toBe(415)
    expect(attachments).toHaveLength(0)
  })
})

describe('GET /api/contacts/:id/attachments/:attachmentId', () => {
  async function seedUpload() {
    await request(createApp('agent-1'))
      .post('/api/contacts/c-mine/attachments')
      .field('kind', 'pre_approval_letter')
      .attach('file', PDF, { filename: 'letter.pdf', contentType: 'application/pdf' })
    return attachments[0]
  }

  it('streams the file to the owner with a private, attachment disposition', async () => {
    const att = await seedUpload()
    const res = await request(createApp('agent-1')).get(`/api/contacts/c-mine/attachments/${att.id}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="letter\.pdf"/)
    expect(res.headers['cache-control']).toContain('no-store')
    expect(Buffer.from(res.body).toString()).toContain('%PDF-1.4')
  })

  it('returns 404 for a caller who does not own the contact', async () => {
    const att = await seedUpload()
    const res = await request(createApp('agent-2')).get(`/api/contacts/c-mine/attachments/${att.id}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 for an unknown attachment id', async () => {
    await seedUpload()
    const res = await request(createApp('agent-1')).get('/api/contacts/c-mine/attachments/nope')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/contacts/:id/attachments (list)', () => {
  it('accepts an audio voice note and lists it for the owner, filtered by kind', async () => {
    const app = createApp('agent-1')
    await request(app)
      .post('/api/contacts/c-mine/attachments')
      .field('kind', 'voice_note')
      .attach('file', Buffer.from('OggS voice'), { filename: 'note.webm', contentType: 'audio/webm' })
    await request(app)
      .post('/api/contacts/c-mine/attachments')
      .field('kind', 'pre_approval_letter')
      .attach('file', PDF, { filename: 'letter.pdf', contentType: 'application/pdf' })

    const all = await request(createApp('agent-1')).get('/api/contacts/c-mine/attachments')
    expect(all.status).toBe(200)
    expect(all.body.attachments).toHaveLength(2)

    const voice = await request(createApp('agent-1')).get('/api/contacts/c-mine/attachments?kind=voice_note')
    expect(voice.body.attachments).toHaveLength(1)
    expect(voice.body.attachments[0]).toMatchObject({ kind: 'voice_note', filename: 'note.webm' })
    expect(voice.body.attachments[0].storage_key).toBeUndefined()
  })

  it('returns 404 when listing a contact the caller does not own', async () => {
    const res = await request(createApp('agent-2')).get('/api/contacts/c-mine/attachments')
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/contacts/:id/attachments/:attachmentId', () => {
  it('removes the blob + row and clears the contact reference for the owner', async () => {
    await request(createApp('agent-1'))
      .post('/api/contacts/c-mine/attachments')
      .field('kind', 'pre_approval_letter')
      .attach('file', PDF, { filename: 'letter.pdf', contentType: 'application/pdf' })
    const att = attachments[0]
    const res = await request(createApp('agent-1')).delete(`/api/contacts/c-mine/attachments/${att.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ deleted: true })
    expect(attachments).toHaveLength(0)
    expect(storage.files.size).toBe(0)
    expect(contacts.find((c) => c.id === 'c-mine').pre_approval_letter).toBeUndefined()
  })

  it('returns 404 when a non-owner tries to delete', async () => {
    await request(createApp('agent-1'))
      .post('/api/contacts/c-mine/attachments')
      .attach('file', PDF, { filename: 'letter.pdf', contentType: 'application/pdf' })
    const att = attachments[0]
    const res = await request(createApp('agent-2')).delete(`/api/contacts/c-mine/attachments/${att.id}`)
    expect(res.status).toBe(404)
    expect(attachments).toHaveLength(1)
  })
})
