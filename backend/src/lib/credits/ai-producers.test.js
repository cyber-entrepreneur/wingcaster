import { afterEach, describe, expect, it, vi } from 'vitest'
import { captionsSchema, normalizeCaptionsEnvelope, parseWithSchema, propertyRatingSchema } from './ai-producers/schemas.js'
import { produceAiPost } from './ai-producers/create-ai-post.js'
import { produceRateProperty } from './ai-producers/rate-property.js'
import { AI_PRODUCER_ERROR } from './ai-producers/errors.js'
import { createAiPost } from './ai-stubs.js'
import { isAutoMigration } from '../../persistence/migrations/runner.js'

vi.mock('../ai-usage-logger.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    recordAiCall: vi.fn().mockResolvedValue(undefined),
  }
})

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
  language: 'en',
}

const RATE_INPUT = {
  propertyPayload: {
    title: 'Hamra 2-bed',
    description: 'Bright 2-bed apartment in Hamra',
    city: 'Beirut',
    price: 300000,
  },
  areaContext: { name: 'Hamra' },
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

function openaiJson(payload) {
  return jsonResponse({
    choices: [{ message: { content: JSON.stringify(payload) } }],
    usage: { prompt_tokens: 120, completion_tokens: 80 },
  })
}

function anthropicTool(name, input) {
  return jsonResponse({
    content: [{ type: 'tool_use', id: 'toolu_1', name, input }],
    usage: { input_tokens: 110, output_tokens: 70 },
  })
}

function stubProviders({ openai, anthropic }) {
  process.env.OPENAI_API_KEY = 'test-openai-key'
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url)
    if (href.includes('api.openai.com')) return typeof openai === 'function' ? openai() : openai
    if (href.includes('api.anthropic.com')) return typeof anthropic === 'function' ? anthropic() : anthropic
    throw new Error(`unexpected fetch ${href}`)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
})

describe('AI producer schemas', () => {
  it('auto-applies 310_property_ai_ratings.sql (305b letter suffix would be skipped)', () => {
    expect(isAutoMigration('310_property_ai_ratings.sql')).toBe(true)
    expect(isAutoMigration('305b_property_ai_ratings.sql')).toBe(false)
  })

  it('accepts a full captions object from either provider envelope', () => {
    const schema = captionsSchema()
    expect(parseWithSchema(schema, { captions: SAMPLE_CAPTIONS }).success).toBe(true)
    expect(parseWithSchema(schema, SAMPLE_CAPTIONS, { normalize: normalizeCaptionsEnvelope }).success).toBe(true)
  })

  it('accepts 1-10 property ratings with reasoning', () => {
    const parsed = propertyRatingSchema.safeParse({
      ratings: { quality: 8, price_fairness: 7.5, area_fit: 8, presentation: 6, overall: 7.5 },
      reasoning: {
        quality: 'Solid finishes.',
        price_fairness: 'In line with Hamra comps.',
        area_fit: 'Walkable to shops.',
        presentation: 'Photos are adequate.',
        overall: 'A strong listing.',
      },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects ratings outside 1-10', () => {
    const parsed = propertyRatingSchema.safeParse({
      ratings: { quality: 0, price_fairness: 7, area_fit: 8, presentation: 6, overall: 7 },
      reasoning: {
        quality: 'x', price_fairness: 'x', area_fit: 'x', presentation: 'x', overall: 'x',
      },
    })
    expect(parsed.success).toBe(false)
  })
})

describe('createAiPost language guard', () => {
  it('throws LANGUAGE_NOT_YET_SUPPORTED for Arabic without calling a provider', async () => {
    await expect(produceAiPost({
      description: 'شقة في الحمرا',
      language: 'ar',
    })).rejects.toMatchObject({ code: AI_PRODUCER_ERROR.LANGUAGE_NOT_YET_SUPPORTED })
  })

  it('opts.work bypasses the real producer path', async () => {
    await expect(createAiPost({
      work: async () => ({ copy: 'injected' }),
    })).resolves.toEqual({ copy: 'injected' })
  })
})

describe('createAiPost provider matrix (unmetered)', () => {
  it('OpenAI happy path matches the captions schema', async () => {
    stubProviders({
      openai: openaiJson({ captions: SAMPLE_CAPTIONS }),
      anthropic: jsonResponse({ error: 'unused' }, { ok: false, status: 503 }),
    })
    const out = await produceAiPost({ ...POST_INPUT, provider: 'openai' })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('openai')
    expect(captionsSchema().safeParse({ captions: out.captions }).success).toBe(true)
  })

  it('Anthropic happy path matches the captions schema via tool-use', async () => {
    stubProviders({
      openai: jsonResponse({ error: 'unused' }, { ok: false, status: 503 }),
      anthropic: anthropicTool('submit_captions', { captions: SAMPLE_CAPTIONS }),
    })
    const out = await produceAiPost({ ...POST_INPUT, provider: 'anthropic' })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('anthropic')
    expect(captionsSchema().safeParse({ captions: out.captions }).success).toBe(true)
  })

  it('falls over to Anthropic when OpenAI JSON parse fails (no same-provider retry)', async () => {
    stubProviders({
      openai: jsonResponse({
        choices: [{ message: { content: 'not-json' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      anthropic: anthropicTool('submit_captions', { captions: SAMPLE_CAPTIONS }),
    })
    const out = await produceAiPost({ ...POST_INPUT, provider: 'openai' })
    expect(out.provider).toBe('anthropic')
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('api.openai.com'))).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('api.anthropic.com'))).toHaveLength(1)
  })

  it('fails closed with AI_STRUCTURED_OUTPUT_FAILED when both parse-fail', async () => {
    stubProviders({
      openai: jsonResponse({
        choices: [{ message: { content: 'not-json' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      anthropic: jsonResponse({
        content: [{ type: 'text', text: 'prose' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    })
    await expect(produceAiPost({ ...POST_INPUT, provider: 'openai' }))
      .rejects.toMatchObject({ code: AI_PRODUCER_ERROR.AI_STRUCTURED_OUTPUT_FAILED })
  })

  it('fails closed with AI_PROVIDERS_UNAVAILABLE when both providers are down', async () => {
    stubProviders({
      openai: jsonResponse({ error: 'down' }, { ok: false, status: 503 }),
      anthropic: jsonResponse({ error: 'down' }, { ok: false, status: 503 }),
    })
    await expect(produceAiPost({ ...POST_INPUT, provider: 'openai' }))
      .rejects.toMatchObject({ code: AI_PRODUCER_ERROR.AI_PROVIDERS_UNAVAILABLE })
  })
})

describe('rateProperty provider matrix (unmetered)', () => {
  it('OpenAI happy path matches the rating schema', async () => {
    stubProviders({
      openai: openaiJson(SAMPLE_RATING),
      anthropic: jsonResponse({ error: 'unused' }, { ok: false, status: 503 }),
    })
    const out = await produceRateProperty({ ...RATE_INPUT, provider: 'openai' })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('openai')
    expect(propertyRatingSchema.safeParse({ ratings: out.ratings, reasoning: out.reasoning }).success).toBe(true)
  })

  it('Anthropic happy path matches the rating schema via tool-use', async () => {
    stubProviders({
      openai: jsonResponse({ error: 'unused' }, { ok: false, status: 503 }),
      anthropic: anthropicTool('submit_property_rating', SAMPLE_RATING),
    })
    const out = await produceRateProperty({ ...RATE_INPUT, provider: 'anthropic' })
    expect(out.ok).toBe(true)
    expect(out.provider).toBe('anthropic')
    expect(propertyRatingSchema.safeParse({ ratings: out.ratings, reasoning: out.reasoning }).success).toBe(true)
  })

  it('falls over to Anthropic when OpenAI is down', async () => {
    stubProviders({
      openai: jsonResponse({ error: 'down' }, { ok: false, status: 503 }),
      anthropic: anthropicTool('submit_property_rating', SAMPLE_RATING),
    })
    const out = await produceRateProperty({ ...RATE_INPUT, provider: 'openai' })
    expect(out.provider).toBe('anthropic')
  })

  it('fails closed with AI_STRUCTURED_OUTPUT_FAILED when both parse-fail', async () => {
    stubProviders({
      openai: jsonResponse({
        choices: [{ message: { content: 'not-json' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      anthropic: jsonResponse({
        content: [{ type: 'text', text: 'prose' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    })
    await expect(produceRateProperty({ ...RATE_INPUT, provider: 'openai' }))
      .rejects.toMatchObject({ code: AI_PRODUCER_ERROR.AI_STRUCTURED_OUTPUT_FAILED })
  })
})
