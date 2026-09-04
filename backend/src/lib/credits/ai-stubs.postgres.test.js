import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { FEATURES } from './features.js'
import { grant } from './engine.js'
import { createAiPost, rateProperty, activateLeadGen } from './ai-stubs.js'
import { captionsSchema, propertyRatingSchema } from './ai-producers/schemas.js'
import { AI_PRODUCER_ERROR } from './ai-producers/errors.js'
import { insert } from '../../db.js'

const SAMPLE_CAPTIONS = {
  instagram: 'Sunny 2-bed in Hamra ✨ #Beirut #Home #RealEstate',
  facebook: 'This bright 2-bed apartment in Hamra is ready for its next owner.',
  tiktok: 'POV: you just found the Hamra apartment. [Sound: city loft] #Hamra #Apartment',
  x: 'Bright 2-bed in Hamra. #Beirut',
  linkedin: 'A well-presented two-bedroom apartment in Hamra, Beirut.',
  whatsapp: '2-bed in Hamra is available. Reply YES for a viewing.',
}

const SAMPLE_RATING = {
  ratings: { quality: 8, price_fairness: 7, area_fit: 8, presentation: 7, overall: 8 },
  reasoning: {
    quality: 'Solid finishes for the vintage.',
    price_fairness: 'Ask is close to local comps.',
    area_fit: 'Hamra amenities match the brief.',
    presentation: 'Photos are bright and honest.',
    overall: 'A well-balanced listing.',
  },
}

const POST_INPUT = {
  description: 'Bright 2-bed apartment in Hamra with balcony and morning light.',
  propertyPayload: { city: 'Beirut', neighborhood: 'Hamra', bedrooms: 2, price: 300000 },
  tone: 'warm',
  channels: ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp'],
  language: 'en',
}

const RATE_INPUT = {
  propertyPayload: {
    title: 'Hamra 2-bed',
    description: 'Bright 2-bed apartment in Hamra',
    city: 'Beirut',
    neighborhood: 'Hamra',
    price: 300000,
    bedrooms: 2,
  },
  areaContext: { name: 'Hamra', walkability: 8 },
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  }
}

function openaiJson(payload, usage = { prompt_tokens: 120, completion_tokens: 80 }) {
  return jsonResponse({
    choices: [{ message: { content: JSON.stringify(payload) } }],
    usage,
  })
}

function openaiMalformed() {
  return jsonResponse({
    choices: [{ message: { content: 'not-json' } }],
    usage: { prompt_tokens: 10, completion_tokens: 4 },
  })
}

function openaiDown() {
  return jsonResponse({ error: 'openai down' }, { ok: false, status: 503 })
}

function anthropicTool(name, input, usage = { input_tokens: 110, output_tokens: 70 }) {
  return jsonResponse({
    content: [{ type: 'tool_use', id: 'toolu_1', name, input }],
    usage,
  })
}

function anthropicMalformed() {
  return jsonResponse({
    content: [{ type: 'text', text: 'sorry, here is some prose' }],
    usage: { input_tokens: 8, output_tokens: 6 },
  })
}

function anthropicDown() {
  return jsonResponse({ error: 'anthropic down' }, { ok: false, status: 503 })
}

function stubProviders({ openai, anthropic }) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url)
    if (href.includes('api.openai.com')) return typeof openai === 'function' ? openai() : openai
    if (href.includes('api.anthropic.com')) return typeof anthropic === 'function' ? anthropic() : anthropic
    throw new Error(`unexpected fetch ${href}`)
  }))
}

async function seedCredits(amount = 50_000) {
  const tenantId = randomUUID()
  await grant({
    tenantId,
    source: 'promo',
    amount,
    currency: 'USD',
    grantRef: { idempotency_key: `seed:${tenantId}`, reason: 'test seed' },
  })
  return tenantId
}

async function consumeRow(pool, tenantId, requestId) {
  const consumed = await pool.query(
    `SELECT credits_amount, feature, call_type FROM public.credit_consumptions
      WHERE tenant_id = $1 AND request_id = $2`,
    [tenantId, requestId],
  )
  return consumed.rows[0] || null
}

async function reservationStatus(pool, tenantId, requestId) {
  const reservation = await pool.query(
    `SELECT status FROM public.credit_reservations WHERE tenant_id = $1 AND request_id = $2`,
    [tenantId, requestId],
  )
  return reservation.rows[0]?.status || null
}

async function usageRows(pool, tenantId, feature) {
  const rows = await pool.query(
    `SELECT feature, call_type, provider, model, input_tokens, output_tokens, cost_estimate_micro_usd, data
       FROM public.ai_call_usage WHERE tenant_id = $1 AND feature = $2 ORDER BY occurred_at`,
    [tenantId, feature],
  )
  return rows.rows
}

finPostgresSuite('AI producer wiring (createAiPost + rateProperty)', {}, ({ pool }) => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.AI_PROVIDER_PRIMARY
    delete process.env.AI_PROVIDER_FALLBACK
  })

  function withKeys() {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
  }

  it('createAiPost × OpenAI happy path meters, matches schema, and logs usage', async () => {
    withKeys()
    stubProviders({
      openai: openaiJson({ captions: SAMPLE_CAPTIONS }),
      anthropic: anthropicDown(),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await createAiPost({
      ...POST_INPUT,
      provider: 'openai',
      creditContext: { tenantId, requestId, callType: 'createAiPost', relatedEntityType: 'session', relatedEntityId: 'sess-1' },
    })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('openai')
    expect(captionsSchema().safeParse({ captions: out.captions }).success).toBe(true)
    const consumed = await consumeRow(pool(), tenantId, requestId)
    expect(consumed.feature).toBe(FEATURES.AI_POST_CREATION)
    expect(Number(consumed.credits_amount)).toBe(500)
    const logs = await usageRows(pool(), tenantId, FEATURES.AI_POST_CREATION)
    expect(logs).toHaveLength(1)
    expect(logs[0].provider).toBe('openai')
    expect(logs[0].model).toBe('gpt-4o-mini')
    expect(Number(logs[0].input_tokens)).toBe(120)
    expect(Number(logs[0].output_tokens)).toBe(80)
    expect(logs[0].data?.request_id).toBe(requestId)
  })

  it('createAiPost × Anthropic happy path meters, matches schema, and logs usage', async () => {
    withKeys()
    stubProviders({
      openai: openaiDown(),
      anthropic: anthropicTool('submit_captions', { captions: SAMPLE_CAPTIONS }),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await createAiPost({
      ...POST_INPUT,
      provider: 'anthropic',
      creditContext: { tenantId, requestId, callType: 'createAiPost' },
    })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('anthropic')
    expect(captionsSchema().safeParse({ captions: out.captions }).success).toBe(true)
    const consumed = await consumeRow(pool(), tenantId, requestId)
    expect(consumed.feature).toBe(FEATURES.AI_POST_CREATION)
    expect(Number(consumed.credits_amount)).toBe(500)
    const logs = await usageRows(pool(), tenantId, FEATURES.AI_POST_CREATION)
    expect(logs[0].provider).toBe('anthropic')
    expect(logs[0].model).toBe('claude-3-haiku-20240307')
  })

  it('rateProperty × OpenAI happy path meters, matches schema, and logs usage', async () => {
    withKeys()
    stubProviders({
      openai: openaiJson(SAMPLE_RATING),
      anthropic: anthropicDown(),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await rateProperty({
      ...RATE_INPUT,
      provider: 'openai',
      creditContext: { tenantId, requestId, callType: 'rateProperty', relatedEntityType: 'property', relatedEntityId: 'prop-1' },
    })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('openai')
    expect(propertyRatingSchema.safeParse({ ratings: out.ratings, reasoning: out.reasoning }).success).toBe(true)
    const consumed = await consumeRow(pool(), tenantId, requestId)
    expect(consumed.feature).toBe(FEATURES.AI_PROPERTY_RATING)
    expect(Number(consumed.credits_amount)).toBe(200)
    const logs = await usageRows(pool(), tenantId, FEATURES.AI_PROPERTY_RATING)
    expect(logs).toHaveLength(1)
    expect(logs[0].provider).toBe('openai')
    expect(logs[0].model).toBe('gpt-4o-mini')
  })

  it('rateProperty × Anthropic happy path meters, matches schema, and logs usage', async () => {
    withKeys()
    stubProviders({
      openai: openaiDown(),
      anthropic: anthropicTool('submit_property_rating', SAMPLE_RATING),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await rateProperty({
      ...RATE_INPUT,
      provider: 'anthropic',
      creditContext: { tenantId, requestId, callType: 'rateProperty' },
    })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('anthropic')
    expect(propertyRatingSchema.safeParse({ ratings: out.ratings, reasoning: out.reasoning }).success).toBe(true)
    const consumed = await consumeRow(pool(), tenantId, requestId)
    expect(consumed.feature).toBe(FEATURES.AI_PROPERTY_RATING)
    expect(Number(consumed.credits_amount)).toBe(200)
    const logs = await usageRows(pool(), tenantId, FEATURES.AI_PROPERTY_RATING)
    expect(logs[0].provider).toBe('anthropic')
    expect(logs[0].model).toBe('claude-3-haiku-20240307')
  })

  it('createAiPost falls over to Anthropic when OpenAI is down', async () => {
    withKeys()
    stubProviders({
      openai: openaiDown(),
      anthropic: anthropicTool('submit_captions', { captions: SAMPLE_CAPTIONS }),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await createAiPost({
      ...POST_INPUT,
      provider: 'openai',
      creditContext: { tenantId, requestId },
    })
    expect(out.provider).toBe('anthropic')
    expect(Number((await consumeRow(pool(), tenantId, requestId)).credits_amount)).toBe(500)
  })

  it('rateProperty falls over to Anthropic when OpenAI is down', async () => {
    withKeys()
    stubProviders({
      openai: openaiDown(),
      anthropic: anthropicTool('submit_property_rating', SAMPLE_RATING),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await rateProperty({
      ...RATE_INPUT,
      provider: 'openai',
      creditContext: { tenantId, requestId },
    })
    expect(out.provider).toBe('anthropic')
    expect(Number((await consumeRow(pool(), tenantId, requestId)).credits_amount)).toBe(200)
  })

  it('createAiPost fails closed and releases credits when both providers are down', async () => {
    withKeys()
    stubProviders({ openai: openaiDown(), anthropic: anthropicDown() })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await expect(createAiPost({
      ...POST_INPUT,
      creditContext: { tenantId, requestId },
    })).rejects.toMatchObject({ code: AI_PRODUCER_ERROR.AI_PROVIDERS_UNAVAILABLE })
    expect(await consumeRow(pool(), tenantId, requestId)).toBeNull()
    expect(await reservationStatus(pool(), tenantId, requestId)).toBe('RELEASED')
  })

  it('rateProperty fails closed and releases credits when both providers are down', async () => {
    withKeys()
    stubProviders({ openai: openaiDown(), anthropic: anthropicDown() })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await expect(rateProperty({
      ...RATE_INPUT,
      creditContext: { tenantId, requestId },
    })).rejects.toMatchObject({ code: AI_PRODUCER_ERROR.AI_PROVIDERS_UNAVAILABLE })
    expect(await consumeRow(pool(), tenantId, requestId)).toBeNull()
    expect(await reservationStatus(pool(), tenantId, requestId)).toBe('RELEASED')
  })

  it('JSON parse failure on OpenAI falls over to Anthropic for createAiPost', async () => {
    withKeys()
    stubProviders({
      openai: openaiMalformed(),
      anthropic: anthropicTool('submit_captions', { captions: SAMPLE_CAPTIONS }),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await createAiPost({
      ...POST_INPUT,
      provider: 'openai',
      creditContext: { tenantId, requestId },
    })
    expect(out.provider).toBe('anthropic')
    expect(fetch.mock.calls.some(([url]) => String(url).includes('api.openai.com'))).toBe(true)
    expect(fetch.mock.calls.some(([url]) => String(url).includes('api.anthropic.com'))).toBe(true)
  })

  it('JSON parse failure on OpenAI falls over to Anthropic for rateProperty', async () => {
    withKeys()
    stubProviders({
      openai: openaiMalformed(),
      anthropic: anthropicTool('submit_property_rating', SAMPLE_RATING),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    const out = await rateProperty({
      ...RATE_INPUT,
      provider: 'openai',
      creditContext: { tenantId, requestId },
    })
    expect(out.provider).toBe('anthropic')
  })

  it('both providers parse-fail fail closed with AI_STRUCTURED_OUTPUT_FAILED', async () => {
    withKeys()
    stubProviders({ openai: openaiMalformed(), anthropic: anthropicMalformed() })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await expect(createAiPost({
      ...POST_INPUT,
      creditContext: { tenantId, requestId },
    })).rejects.toMatchObject({ code: AI_PRODUCER_ERROR.AI_STRUCTURED_OUTPUT_FAILED })
    expect(await consumeRow(pool(), tenantId, requestId)).toBeNull()
    expect(await reservationStatus(pool(), tenantId, requestId)).toBe('RELEASED')

    const rateRequestId = randomUUID()
    await expect(rateProperty({
      ...RATE_INPUT,
      creditContext: { tenantId, requestId: rateRequestId },
    })).rejects.toMatchObject({ code: AI_PRODUCER_ERROR.AI_STRUCTURED_OUTPUT_FAILED })
    expect(await consumeRow(pool(), tenantId, rateRequestId)).toBeNull()
  })

  it('opts.work override bypasses the real producer path', async () => {
    const tenantId = await seedCredits()
    await expect(createAiPost({
      creditContext: { tenantId, requestId: randomUUID() },
      work: async () => ({ copy: 'injected-post' }),
    })).resolves.toEqual({ copy: 'injected-post' })
    await expect(rateProperty({
      creditContext: { tenantId, requestId: randomUUID() },
      work: async () => ({ rating: 9 }),
    })).resolves.toEqual({ rating: 9 })
  })

  it('createAiPost language=ar throws LANGUAGE_NOT_YET_SUPPORTED and releases the reservation', async () => {
    withKeys()
    stubProviders({
      openai: openaiJson({ captions: SAMPLE_CAPTIONS }),
      anthropic: anthropicTool('submit_captions', { captions: SAMPLE_CAPTIONS }),
    })
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await expect(createAiPost({
      ...POST_INPUT,
      language: 'ar',
      creditContext: { tenantId, requestId },
    })).rejects.toMatchObject({
      code: AI_PRODUCER_ERROR.LANGUAGE_NOT_YET_SUPPORTED,
      message: expect.stringMatching(/Arabic prompt templates are Phase 2/),
    })
    expect(await consumeRow(pool(), tenantId, requestId)).toBeNull()
    expect(await reservationStatus(pool(), tenantId, requestId)).toBe('RELEASED')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('activateLeadGen remains NOT_IMPLEMENTED', async () => {
    const tenantId = await seedCredits()
    await expect(activateLeadGen({
      creditContext: { tenantId, requestId: randomUUID() },
    })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })

  it('rateProperty persists ratings onto properties.ai_ratings', async () => {
    withKeys()
    stubProviders({
      openai: openaiJson(SAMPLE_RATING),
      anthropic: anthropicDown(),
    })
    const tenantId = await seedCredits()
    const propertyId = randomUUID()
    const agentId = randomUUID()
    await pool().query(
      `INSERT INTO users (id, email, name, data) VALUES ($1, $2, 'Rater', '{}'::jsonb)`,
      [agentId, `rate-${agentId}@example.test`],
    )
    await pool().query(
      `INSERT INTO agents (id, user_id, email, name, slug, data) VALUES ($1, $1, $2, 'Rater', $3, '{}'::jsonb)`,
      [agentId, `rate-${agentId}@example.test`, `rater-${agentId.slice(0, 8)}`],
    )
    await insert('properties', {
      id: propertyId,
      agent_id: agentId,
      title: 'Hamra 2-bed',
      description: 'Bright 2-bed apartment in Hamra',
      property_type: 'apartment',
      listing_type: 'sale',
      price: 300000,
      city: 'Beirut',
      neighborhood: 'Hamra',
    })
    const out = await rateProperty({
      propertyPayload: { id: propertyId, title: 'Hamra 2-bed', city: 'Beirut', price: 300000 },
      areaContext: { name: 'Hamra' },
      provider: 'openai',
      creditContext: { tenantId, requestId: randomUUID(), relatedEntityId: propertyId },
    })
    expect(out.ok).toBe(true)
    const stored = await pool().query(
      `SELECT ai_ratings FROM properties WHERE id = $1`,
      [propertyId],
    )
    expect(stored.rows[0].ai_ratings.ratings.overall).toBe(8)
    expect(stored.rows[0].ai_ratings.provider).toBe('openai')
  })
})
