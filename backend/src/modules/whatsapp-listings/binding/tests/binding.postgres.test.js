import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeDb, configure, insert, query } from '../../../../db.js'
import { skipIfNoPostgres, withTestDb } from '../../../../testing/postgres.js'
import { registerBindingRoutes } from '../routes.js'
import {
  _resetIntakeConfigCache,
  getIntakeConfig,
} from '../config.js'
import { runWhatsAppIntakeJanitorTick } from '../janitor.js'
import {
  CAP_REPLY,
  HINT_REPLY,
  LINKED_REPLY,
} from '../webhook-parser.js'
import {
  generateActivationCode,
  getCurrentBinding,
  listActiveBindingsForUser,
} from '../service.js'
import { getPool } from '../../../../persistence/postgres-adapter.js'

const logger = { warn() {}, error() {}, info() {}, debug() {} }

function waPayload({ from, text, id = randomUUID() }) {
  return {
    entry: [{
      id: 'waba',
      changes: [{
        value: {
          contacts: [{ profile: { name: 'Tester' } }],
          messages: [{
            id,
            from,
            timestamp: '1',
            type: 'text',
            text: { body: text },
          }],
        },
      }],
    }],
  }
}

async function seedAgent({ name, email }) {
  const id = randomUUID()
  const now = new Date().toISOString()
  await insert('users', {
    id,
    email,
    phone: null,
    name,
    password_hash: 'nope',
    role: 'agent',
    token_version: 0,
    created_at: now,
    updated_at: now,
  })
  await insert('agents', {
    id,
    user_id: id,
    email,
    phone: null,
    name,
    role: 'agent',
    subscription_features: { whatsapp_listings: { enabled: true } },
    created_at: now,
    updated_at: now,
  })
  return id
}

function createHandler({ ingest = vi.fn().mockResolvedValue({ handled: true, reason: 'ingested' }), sendReply }) {
  return createWebhookHandler({
    adapter: {
      getAgentByWhatsAppNumber: async () => null,
      getAgentAgencyId: async () => null,
    },
    entitlements: { isEnabled: () => true },
    credits: {},
    pipeline: { ingest },
    config: {},
    logger,
    sendReply,
  })
}

skipIfNoPostgres()('WhatsApp Model B binding (postgres)', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP
    _resetIntakeConfigCache()
  })

  it('generates a code, binds from the phone, then routes the next message to the agent', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const replies = []
        const ingest = vi.fn().mockResolvedValue({ handled: true, reason: 'ingested' })
        const webhook = createHandler({ ingest, sendReply: async (_to, text) => { replies.push(text) } })
        const userId = await seedAgent({ name: 'Jamil Haddad', email: `jamil-${randomUUID()}@example.com` })
        const issued = await generateActivationCode(userId, { firstName: 'Jamil' })
        expect(issued.display_code).toMatch(/^WC-[A-Z0-9]{4}-JAMIL$/)
        expect(issued.shared_number_e164).toBeTruthy()

        const from = '971501234567'
        const bind = await webhook.handle({ payload: waPayload({ from, text: issued.display_code }) })
        expect(bind.results[0].reason).toBe('bound')
        expect(replies[0]).toBe(LINKED_REPLY)
        const binding = await getCurrentBinding(from)
        expect(binding.user_id).toBe(userId)

        replies.length = 0
        const listing = await webhook.handle({
          payload: waPayload({ from, text: 'Bright 2-bed in Marina, 2.1M' }),
        })
        expect(listing.results[0].handled).toBe(true)
        expect(ingest).toHaveBeenCalledTimes(1)
        expect(ingest.mock.calls[0][0].text).toContain('Marina')
      } finally {
        await closeDb()
      }
    })
  })

  it('rejects an expired code and replies with the H1 hint', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const replies = []
        const webhook = createHandler({ sendReply: async (_to, text) => { replies.push(text) } })
        const userId = await seedAgent({ name: 'Amina', email: `amina-${randomUUID()}@example.com` })
        await query(
          `INSERT INTO public.whatsapp_activation_codes
             (user_id, code, display_code, shared_number_index, created_at, expires_at)
           VALUES ($1, 'A4K9', 'WC-A4K9-AMINA', 0, NOW() - INTERVAL '25 hours', NOW() - INTERVAL '1 hour')`,
          [userId],
        )
        await webhook.handle({ payload: waPayload({ from: '971509999001', text: 'A4K9' }) })
        expect(replies[0]).toBe(HINT_REPLY)
      } finally {
        await closeDb()
      }
    })
  })

  it('prompts to select when a second agent binds the same phone, then routes to B after 2', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const replies = []
        const ingest = vi.fn().mockResolvedValue({ handled: true, reason: 'ingested' })
        const webhook = createHandler({ ingest, sendReply: async (_to, text) => { replies.push(text) } })
        const userA = await seedAgent({ name: 'Husband', email: `h-${randomUUID()}@example.com` })
        const userB = await seedAgent({ name: 'Wife', email: `w-${randomUUID()}@example.com` })
        const from = '971501112223'
        const codeA = await generateActivationCode(userA, { firstName: 'Husband' })
        await webhook.handle({ payload: waPayload({ from, text: codeA.code }) })
        expect(replies.at(-1)).toBe(LINKED_REPLY)

        const codeB = await generateActivationCode(userB, { firstName: 'Wife' })
        await webhook.handle({ payload: waPayload({ from, text: codeB.code }) })
        expect(replies.at(-1)).toMatch(/Send `1` to keep sending as Husband/)
        expect(replies.at(-1)).toMatch(/`2` to switch to Wife/)

        await webhook.handle({ payload: waPayload({ from, text: '2' }) })
        expect(replies.at(-1)).toBe(LINKED_REPLY)
        const current = await getCurrentBinding(from)
        expect(current.user_id).toBe(userB)

        ingest.mockClear()
        await webhook.handle({ payload: waPayload({ from, text: 'Villa for sale in Palm' }) })
        expect(ingest).toHaveBeenCalledTimes(1)
      } finally {
        await closeDb()
      }
    })
  })

  it('WC-LIST returns the bound phones and WC-UNBIND then hints on the next message', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const replies = []
        const webhook = createHandler({ sendReply: async (_to, text) => { replies.push(text) } })
        const userId = await seedAgent({ name: 'Nour', email: `nour-${randomUUID()}@example.com` })
        const from = '971508887776'
        const issued = await generateActivationCode(userId, { firstName: 'Nour' })
        await webhook.handle({ payload: waPayload({ from, text: issued.code }) })

        replies.length = 0
        await webhook.handle({ payload: waPayload({ from, text: 'WC-LIST' }) })
        expect(replies[0]).toMatch(/^1\. \+971 XX XXX 7776/)

        await webhook.handle({ payload: waPayload({ from, text: 'WC-UNBIND' }) })
        expect(replies.at(-1)).toMatch(/Unlinked this phone from Nour/)
        const still = await listActiveBindingsForUser(userId)
        expect(still).toHaveLength(0)

        replies.length = 0
        await webhook.handle({ payload: waPayload({ from, text: 'another listing' }) })
        expect(replies[0]).toBe(HINT_REPLY)
      } finally {
        await closeDb()
      }
    })
  })

  it('enforces the per-agent daily cap before ingest/AI', async () => {
    await withTestDb(async (databaseUrl) => {
      process.env.WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP = '1'
      _resetIntakeConfigCache()
      configure({ databaseUrl, force: true })
      try {
        const cfg = await getIntakeConfig()
        expect(cfg.WHATSAPP_INTAKE_PER_AGENT_DAILY_CAP).toBe(1)
        const replies = []
        const ingest = vi.fn().mockResolvedValue({ handled: true, reason: 'ingested' })
        const webhook = createHandler({ ingest, sendReply: async (_to, text) => { replies.push(text) } })
        const userId = await seedAgent({ name: 'Cap', email: `cap-${randomUUID()}@example.com` })
        const from = '971500000100'
        const issued = await generateActivationCode(userId, { firstName: 'Cap' })
        await webhook.handle({ payload: waPayload({ from, text: issued.code }) })

        await webhook.handle({ payload: waPayload({ from, text: 'first listing' }) })
        expect(ingest).toHaveBeenCalledTimes(1)

        replies.length = 0
        const capped = await webhook.handle({ payload: waPayload({ from, text: 'second listing' }) })
        expect(capped.results[0].reason).toBe('daily_cap')
        expect(replies[0]).toBe(CAP_REPLY)
        expect(ingest).toHaveBeenCalledTimes(1)
      } finally {
        await closeDb()
      }
    })
  })

  it('janitor invalidates codes past 24h', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const userId = await seedAgent({ name: 'Jan', email: `jan-${randomUUID()}@example.com` })
        await query(
          `INSERT INTO public.whatsapp_activation_codes
             (user_id, code, display_code, shared_number_index, created_at, expires_at)
           VALUES ($1, 'ZZZ2', 'WC-ZZZ2-JAN', 0, NOW() - INTERVAL '25 hours', NOW() - INTERVAL '1 minute')`,
          [userId],
        )
        const tick = await runWhatsAppIntakeJanitorTick({ pool: getPool() })
        expect(tick.skipped).toBe(false)
        expect(tick.processed).toBeGreaterThanOrEqual(1)
        const rows = await query(
          `SELECT invalidated_reason FROM public.whatsapp_activation_codes WHERE code = 'ZZZ2'`,
        )
        expect(rows[0].invalidated_reason).toBe('EXPIRED')
      } finally {
        await closeDb()
      }
    })
  })

  it('HTTP activation-code, binding-status, bindings list and delete work for the signed-in user', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const userId = await seedAgent({ name: 'Lina Saleh', email: `lina-${randomUUID()}@example.com` })
        const auth = (req, _res, next) => {
          req.user = { id: userId, name: 'Lina Saleh' }
          next()
        }
        const app = express()
        app.use(express.json())
        registerBindingRoutes(app, { auth })

        const created = await request(app).post('/api/auth/whatsapp/activation-code').expect(200)
        expect(created.body.display_code).toMatch(/^WC-[A-Z0-9]{4}-LINA$/)
        expect(created.body.shared_number_e164).toMatch(/^\+/)
        expect(created.body.expires_at).toBeTruthy()

        const status = await request(app).get('/api/auth/whatsapp/binding-status').expect(200)
        expect(status.body.bound).toBe(false)

        const list = await request(app).get('/api/auth/whatsapp/bindings').expect(200)
        expect(list.body).toEqual([])

        const webhook = createHandler({ sendReply: async () => {} })
        await webhook.handle({
          payload: waPayload({ from: '971501230000', text: created.body.display_code }),
        })

        const boundStatus = await request(app).get('/api/auth/whatsapp/binding-status').expect(200)
        expect(boundStatus.body.bound).toBe(true)
        expect(boundStatus.body.phone_e164).toBe('+971501230000')

        const boundList = await request(app).get('/api/auth/whatsapp/bindings').expect(200)
        expect(boundList.body).toHaveLength(1)
        const del = await request(app).delete(`/api/auth/whatsapp/bindings/${boundList.body[0].id}`).expect(200)
        expect(del.body.success).toBe(true)
        const after = await request(app).get('/api/auth/whatsapp/bindings').expect(200)
        expect(after.body).toEqual([])
      } finally {
        await closeDb()
      }
    })
  })
})
