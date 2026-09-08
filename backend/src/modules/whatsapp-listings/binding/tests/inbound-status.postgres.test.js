import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDb, configure, insert, query } from '../../../../db.js'
import { skipIfNoPostgres, withTestDb } from '../../../../testing/postgres.js'
import { createWebhookHandler } from '../../application/webhook.js'
import { registerBindingRoutes } from '../routes.js'
import { _resetIntakeConfigCache } from '../config.js'
import { generateActivationCode, touchBinding, stampProcessedMessage } from '../service.js'

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

function createApp(userId, name = 'Agent') {
  const auth = (req, _res, next) => {
    req.user = { id: userId, name }
    next()
  }
  const app = express()
  app.use(express.json())
  registerBindingRoutes(app, { auth })
  return app
}

skipIfNoPostgres()('GET /api/intake/inbound-status/:bindingId (postgres)', () => {
  afterEach(() => {
    _resetIntakeConfigCache()
  })

  it('returns null latest_message_at until inbound content arrives, then session id', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const userId = await seedAgent({ name: 'Sara Nour', email: `sara-${randomUUID()}@example.com` })
        const app = createApp(userId, 'Sara Nour')
        const issued = await generateActivationCode(userId, { firstName: 'Sara' })

        const webhook = createWebhookHandler({
          adapter: {
            getAgentByWhatsAppNumber: async () => null,
            getAgentAgencyId: async () => null,
          },
          entitlements: { isEnabled: () => true },
          credits: {},
          pipeline: { ingest: async () => ({ handled: true, reason: 'ingested' }) },
          config: {},
          logger,
          sendReply: async () => {},
        })

        const from = '971509991122'
        await webhook.handle({ payload: waPayload({ from, text: issued.display_code }) })

        const bindings = await query(
          `SELECT id, active_from, last_used_at FROM public.user_whatsapp_bindings
            WHERE user_id = $1 AND deactivated_at IS NULL`,
          [userId],
        )
        expect(bindings).toHaveLength(1)
        const bindingId = bindings[0].id

        const before = await request(app)
          .get(`/api/intake/inbound-status/${bindingId}`)
          .expect(200)
        expect(before.body).toMatchObject({
          bound: true,
          binding_id: bindingId,
          latest_message_at: null,
          draft_session_id: null,
        })

        // Simulate content path: stamp processed_messages + touch binding + session.
        const messageId = randomUUID()
        await query(
          `INSERT INTO wa_listings.processed_messages (id, message_id, from_number, processed_at)
           VALUES ($1, $2, $3, NOW() + INTERVAL '1 second')`,
          [randomUUID(), messageId, from],
        )
        await stampProcessedMessage({
          messageId,
          userId,
          sharedNumberIndex: 0,
        })
        await touchBinding(bindingId)

        const sessionId = randomUUID()
        await query(
          `INSERT INTO wa_listings.sessions
             (id, agent_id, phone_number, state, created_at, last_activity_at, updated_at, data)
           VALUES ($1, $2, $3, 'collecting', NOW() + INTERVAL '1 second', NOW() + INTERVAL '1 second', NOW(), '{}'::jsonb)`,
          [sessionId, userId, from],
        )

        const after = await request(app)
          .get(`/api/intake/inbound-status/${bindingId}`)
          .expect(200)
        expect(after.body.bound).toBe(true)
        expect(after.body.binding_id).toBe(bindingId)
        expect(after.body.latest_message_at).toBeTruthy()
        expect(typeof after.body.latest_message_at).toBe('string')
        expect(after.body.draft_session_id).toBe(sessionId)
      } finally {
        await closeDb()
      }
    })
  })

  it('returns 404 for missing binding and for another user\'s binding', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const ownerId = await seedAgent({ name: 'Owner', email: `owner-${randomUUID()}@example.com` })
        const otherId = await seedAgent({ name: 'Other', email: `other-${randomUUID()}@example.com` })
        const ownerApp = createApp(ownerId, 'Owner')
        const otherApp = createApp(otherId, 'Other')

        await query(
          `INSERT INTO public.user_whatsapp_bindings
             (id, user_id, phone_e164, shared_number_index, active_from, last_used_at)
           VALUES ($1, $2, '+971500000001', 0, NOW(), NOW())`,
          ['binding-owner-1', ownerId],
        )

        await request(ownerApp)
          .get('/api/intake/inbound-status/does-not-exist')
          .expect(404)

        await request(otherApp)
          .get('/api/intake/inbound-status/binding-owner-1')
          .expect(404)

        const ok = await request(ownerApp)
          .get('/api/intake/inbound-status/binding-owner-1')
          .expect(200)
        expect(ok.body.bound).toBe(true)
        expect(ok.body.latest_message_at).toBeNull()
      } finally {
        await closeDb()
      }
    })
  })

  it('reports bound:false when the owned binding was deactivated', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      try {
        const userId = await seedAgent({ name: 'Deact', email: `deact-${randomUUID()}@example.com` })
        const app = createApp(userId, 'Deact')
        const bindingId = randomUUID()
        await query(
          `INSERT INTO public.user_whatsapp_bindings
             (id, user_id, phone_e164, shared_number_index, active_from, last_used_at, deactivated_at)
           VALUES ($1, $2, '+971500000002', 0, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NOW())`,
          [bindingId, userId],
        )

        const res = await request(app)
          .get(`/api/intake/inbound-status/${bindingId}`)
          .expect(200)
        expect(res.body.bound).toBe(false)
        expect(res.body.binding_id).toBe(bindingId)
        expect(res.body.latest_message_at).toBeNull()
        expect(res.body.draft_session_id).toBeNull()
      } finally {
        await closeDb()
      }
    })
  })
})
