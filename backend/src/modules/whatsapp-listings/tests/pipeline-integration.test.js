import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'crypto'
import pg from 'pg'
import { loadDb, insert, findOne, findAll, update, closeDb, configure } from '../../../db.js'
import { skipIfNoPostgres } from '../../../testing/postgres.js'

const { createAiPostMock } = vi.hoisted(() => ({
  createAiPostMock: vi.fn(),
}))

vi.mock('../../../whatsapp.js', () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ messages: [{ id: 'mock-msg-id' }] }),
  sendWhatsAppImage: vi.fn().mockResolvedValue({ messages: [{ id: 'mock-img-id' }] }),
  sendWhatsAppInteractive: vi.fn().mockResolvedValue({ messages: [{ id: 'mock-interactive-id' }] }),
  getWhatsAppHealth: vi.fn().mockResolvedValue({ configured: false, healthy: false }),
  isWhatsAppConfigured: vi.fn().mockReturnValue(false),
}))

vi.mock('../../../lib/credits/ai-stubs.js', () => ({
  createAiPost: (...args) => createAiPostMock(...args),
  rateProperty: vi.fn(),
  activateLeadGen: vi.fn(),
}))

const { Client } = pg

const databaseUrl = process.env.TEST_DATABASE_URL

async function createTestDatabase() {
  const baseUrl = new URL(databaseUrl)
  const testDbName = `rebazaar_wa_test_${Date.now()}_${randomUUID().slice(0, 8)}`
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = '/postgres'

  const client = new Client({ connectionString: adminUrl.toString() })
  await client.connect()
  try {
    await client.query(`DROP DATABASE IF EXISTS ${testDbName}`)
    await client.query(`CREATE DATABASE ${testDbName}`)
  } finally {
    await client.end()
  }

  const testUrl = new URL(databaseUrl)
  testUrl.pathname = `/${testDbName}`
  return { testUrl: testUrl.toString(), testDbName }
}

async function dropTestDatabase(testDbName) {
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = '/postgres'
  const client = new Client({ connectionString: adminUrl.toString() })
  await client.connect()
  try {
    await client.query(`DROP DATABASE IF EXISTS ${testDbName}`)
  } finally {
    await client.end()
  }
}

/**
 * Integration test for the WhatsApp Listing module pipeline.
 *
 * Uses an isolated Postgres database and fake adapters so no live WhatsApp/AI
 * credentials are required. Verifies the full flow:
 *   webhook ingest → intake aggregation → extraction → approval draft.
 */

skipIfNoPostgres()('WhatsApp Listing pipeline integration', () => {
  const testRoot = join(process.cwd(), 'backend', 'src', 'modules', 'whatsapp-listings', 'tests', '.integration')
  const storageDir = join(testRoot, 'uploads')

  let agentId
  let module
  let testDbName

  beforeAll(async () => {
    await mkdir(testRoot, { recursive: true })
    await mkdir(storageDir, { recursive: true })

    const created = await createTestDatabase()
    testDbName = created.testDbName
    configure({ databaseUrl: created.testUrl, force: true })
    await loadDb()

    agentId = randomUUID()
    const createdAt = new Date().toISOString()

    await insert('users', {
      id: agentId,
      email: `test-${agentId}@example.com`,
      phone: '96131234567',
      name: 'Test Agent',
      password_hash: 'nope',
      role: 'agent',
      token_version: 0,
      created_at: createdAt,
      updated_at: createdAt,
    })

    await insert('agents', {
      id: agentId,
      user_id: agentId,
      email: `test-${agentId}@example.com`,
      phone: '96131234567',
      name: 'Test Agent',
      role: 'agent',
      subscription_features: {
        whatsapp_listings: {
          enabled: true,
          max_drafts_per_month: 50,
          ai_providers_allowed: ['gemini'],
          thumbnail_variants: ['modern'],
          auto_publish_social: false,
        },
      },
      created_at: createdAt,
      updated_at: createdAt,
    })

    const { createModule } = await import('../index.js')

    const fakeAdapter = {
      async getAgentByWhatsAppNumber(number) {
        return findOne('agents', (a) => String(a.phone).replace(/\D/g, '') === String(number).replace(/\D/g, ''))
      },
      async getAgentById(id) {
        return findOne('agents', (a) => a.id === id)
      },
      async getAgentAgencyId() {
        return null
      },
      async getAgentListings() {
        return []
      },
      async createListing(payload) {
        return { ...payload, id: randomUUID(), photos: [] }
      },
      async updateListing(listingId, payload) {
        return { id: listingId, ...payload }
      },
      async publishToInstagram(payload) {
        return { id: randomUUID(), ...payload }
      },
      async emit() {
        return { emitted: true }
      },
      async getPublicApiBase() {
        return 'http://localhost:3001/api'
      },
      async logActivity() {},
    }

    module = createModule({
      platformAdapter: fakeAdapter,
      config: {
        enabled: true,
        aiProvider: 'gemini',
        fallbackAiProviders: [],
        storagePath: storageDir,
        intakeWindowMs: 0,
        maxMediaPerDraft: 15,
        maxMediaSizeBytes: 12 * 1024 * 1024,
        instagramRealPublishing: false,
        workerIntervalMs: 1000,
        workerBatchSize: 10,
        dedupeTtlHours: 24,
        sessionTtlHours: 24,
        credits: { extractionCost: 0.05, thumbnailCost: 0.05, captionCost: 0.02, socialPublishCost: 0.03 },
      },
    })

    const { createCreditService } = await import('../../../lib/credits/compat.js')
    const seedCredits = createCreditService()
    await seedCredits.topUp('agent', agentId, 100, { description: 'pipeline integration seed' })

    const fakeProvider = {
      extractProperty: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          title: 'Integration Test Apartment',
          description: 'Bright 2-bed apartment',
          type: 'sale',
          property_type: 'apartment',
          price: 300000,
          price_unit: 'USD',
          bedrooms: 2,
          bathrooms: 2,
          area: 120,
          area_unit: 'sqm',
          location: 'Hamra',
          city: 'Beirut',
          neighborhood: 'Hamra',
          address: null,
          amenities: ['parking'],
          furnished: false,
          features: [],
          confidence: 0.95,
          latitude: 33.8938,
          longitude: 35.5018,
        }),
        raw: {},
        usage: { inputTokens: 120, outputTokens: 50 },
      }),
      classifyIntent: vi.fn().mockResolvedValue({
        text: JSON.stringify({ intent: 'create', confidence: 0.9, matched_listing_id: null, matched_address: null, reason: 'test' }),
        raw: {},
        usage: { inputTokens: 40, outputTokens: 10 },
      }),
      generateCaption: vi.fn().mockResolvedValue({
        text: JSON.stringify({ caption: 'Great apartment! #realestate', hashtags: ['realestate'] }),
        raw: {},
        usage: { inputTokens: 60, outputTokens: 25 },
      }),
      selectBestTemplate: vi.fn().mockResolvedValue({
        text: JSON.stringify({ variant: 'modern', reason: 'test' }),
        raw: {},
        usage: { inputTokens: 20, outputTokens: 8 },
      }),
      selectHeroImage: vi.fn().mockResolvedValue({
        text: JSON.stringify({ index: 0, reason: 'test' }),
        raw: {},
        usage: { inputTokens: 30, outputTokens: 6 },
      }),
      healthCheck: vi.fn().mockResolvedValue({ ok: true }),
    }
    module.pipeline.aiAdapter.providers.set('gemini', fakeProvider)
    createAiPostMock.mockReset()
    createAiPostMock.mockResolvedValue({
      ok: true,
      result: {
        captions: {
          instagram: 'Sunny Hamra 2-bed. #Beirut #RealEstate',
          facebook: 'Bright 2-bed apartment in Hamra, ready for its next owner.',
          tiktok: 'POV: Hamra apartment unlocked. [Sound: city loft] #Hamra',
          x: 'Bright 2-bed in Hamra. #Beirut',
          linkedin: 'A well-presented two-bedroom apartment in Hamra, Beirut.',
          whatsapp: '2-bed in Hamra is available. Reply YES for a viewing.',
        },
      },
      captions: {
        instagram: 'Sunny Hamra 2-bed. #Beirut #RealEstate',
        facebook: 'Bright 2-bed apartment in Hamra, ready for its next owner.',
        tiktok: 'POV: Hamra apartment unlocked. [Sound: city loft] #Hamra',
        x: 'Bright 2-bed in Hamra. #Beirut',
        linkedin: 'A well-presented two-bedroom apartment in Hamra, Beirut.',
        whatsapp: '2-bed in Hamra is available. Reply YES for a viewing.',
      },
      provider: 'openai',
      cost_micro_usd: 14,
      tokens_in: 100,
      tokens_out: 80,
    })
  })

  afterAll(async () => {
    if (module) module.queue.stop()
    await closeDb()
    try {
      await rm(testRoot, { recursive: true, force: true })
    } catch {}
    if (testDbName) {
      await dropTestDatabase(testDbName)
    }
  })

  it('creates a draft listing from a WhatsApp text message', async () => {
    const messageId = randomUUID()
    const agentPhone = '96131234567'

    const ingestResult = await module.pipeline.ingest({
      from: agentPhone,
      messageId,
      text: 'Bright 2-bed apartment in Hamra, 300k',
      interactiveId: null,
      mediaIds: [],
      media: [],
      location: null,
      messageType: 'text',
      rawPayload: {},
    })

    expect(ingestResult.handled).toBe(true)
    expect(ingestResult.sessionId).toBeTruthy()

    const draft = await module.pipeline.runExtraction(ingestResult.sessionId)

    expect(draft).toBeTruthy()
    expect(draft.status).toBe('awaiting_approval')
    expect(draft.extracted_property.title).toBe('Integration Test Apartment')
    expect(draft.captions.instagram.caption).toBe('Sunny Hamra 2-bed. #Beirut #RealEstate')
    expect(createAiPostMock).toHaveBeenCalledTimes(1)
    const postArgs = createAiPostMock.mock.calls[0][0]
    expect(postArgs.description).toBe('Bright 2-bed apartment')
    expect(postArgs.language).toBe('en')
    expect(postArgs.channels).toEqual(['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp'])

    const usageRows = await findAll('ai_call_usage', (row) => row.related_entity_id === ingestResult.sessionId || row.related_entity_id === draft.id)
    expect(usageRows.length).toBeGreaterThanOrEqual(1)
    const callTypes = usageRows.map((row) => row.call_type).sort()
    expect(callTypes).toEqual(expect.arrayContaining([
      'extractProperty',
    ]))
    expect(callTypes).not.toContain('generateCaption:instagram')
    expect(callTypes).not.toContain('generateCaption:tiktok')
    expect(callTypes).not.toContain('generateCaption:x')
    for (const row of usageRows) {
      expect(row.provider).toBe('gemini')
      expect(row.model).toBe('gemini-1.5-flash')
      expect(Number(row.input_tokens)).toBeGreaterThan(0)
      expect(Number(row.output_tokens)).toBeGreaterThan(0)
      expect(row.feature).toBe('whatsapp-listings')
    }
  })

  it('detects and stores a WhatsApp location pin as canonical coordinates', async () => {
    const messageId = randomUUID()
    const agentPhone = '96131234568'

    await update('agents', (a) => a.id === agentId, (a) => ({ ...a, phone: agentPhone }))

    const ingestResult = await module.pipeline.ingest({
      from: agentPhone,
      messageId,
      text: 'Apartment here, 2 beds, 300k',
      interactiveId: null,
      mediaIds: [],
      media: [],
      location: { latitude: 33.8938, longitude: 35.5018, name: 'Hamra', address: 'Main St' },
      messageType: 'location',
      rawPayload: {},
    })

    expect(ingestResult.handled).toBe(true)
    expect(ingestResult.locationPin).toBe(true)

    const draft = await module.pipeline.runExtraction(ingestResult.sessionId)
    expect(draft).toBeTruthy()
    expect(draft.location_pin_latitude).toBe(33.8938)
    expect(draft.location_pin_longitude).toBe(35.5018)
    expect(draft.location_source).toBe('whatsapp_pin')
  })
})
