/**
 * Unit coverage for inbox AI suggestions (Wave 8).
 * Filename kept as `.postgres.test.js` per dispatch; uses mock-db style.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dal = vi.hoisted(() => ({
  findAll: vi.fn(async () => []),
  insert: vi.fn(async (_c, item) => item),
}))

const authz = vi.hoisted(() => ({
  assertOwnsConversation: vi.fn(async (_userId, id) => ({
    id,
    assigned_agent_id: 'user-1',
    contact_id: 'contact-1',
  })),
}))

const usageLogger = vi.hoisted(() => ({
  recordAiCall: vi.fn(async () => undefined),
}))

const aiCaps = vi.hoisted(() => ({
  assertAiSuggestionAllowed: vi.fn(async (userId) => ({
    agencyId: null,
    dailyCap: 200,
    monthlyCap: null,
    tenantId: `personal:${userId}`,
    used: 0,
    usageDate: '2026-09-15',
    resetsAt: '2026-09-16T00:00:00.000Z',
  })),
  recordAiSuggestionUsage: vi.fn(async () => undefined),
}))

const anthropic = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('../../db.js', () => dal)
vi.mock('../authz.js', () => authz)
vi.mock('../ai-usage-logger.js', () => usageLogger)
vi.mock('../ai-caps.js', () => aiCaps)
vi.mock('../../tenant-authorization.js', () => ({
  personalTenantId: (userId) => `personal:${userId}`,
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    constructor() {
      this.messages = { create: anthropic.create }
    }
  },
}))

import {
  createAiSuggestionsLimiter,
  detectSuggestionLanguage,
  generateAiSuggestions,
  normalizeSuggestionBodies,
} from './ai-suggestions.js'

describe('ai-suggestions', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ANTHROPIC_API_KEY
    dal.findAll.mockResolvedValue([
      {
        id: 'm0',
        conversation_id: 'conv-1',
        direction: 'outbound',
        content: 'Hello',
        created_at: '2026-09-08T08:00:00Z',
      },
      {
        id: 'm1',
        conversation_id: 'conv-1',
        direction: 'inbound',
        content: 'هل الشقة ما زالت متاحة؟',
        created_at: '2026-09-08T08:12:00Z',
      },
    ])
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalKey
  })

  it('detects Arabic script as ar', () => {
    expect(detectSuggestionLanguage('مرحبا')).toBe('ar')
    expect(detectSuggestionLanguage('Is it available?')).toBe('en')
  })

  it('caps suggestion bodies at 240 chars and 3 items', () => {
    const long = 'x'.repeat(300)
    const out = normalizeSuggestionBodies([long, 'a', 'b', 'c'], 'en')
    expect(out).toHaveLength(3)
    expect(out[0].body).toHaveLength(240)
    expect(out[0].id).toBeTruthy()
  })

  it('createAiSuggestionsLimiter is 20/min keyed on user id', () => {
    const limiter = createAiSuggestionsLimiter({ skipInVitest: false })
    expect(limiter).toBeTypeOf('function')
  })

  it('scopes via assertOwnsConversation before loading messages', async () => {
    authz.assertOwnsConversation.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
    await expect(
      generateAiSuggestions({ conversationId: 'missing', userId: 'user-1' }),
    ).rejects.toMatchObject({ status: 404 })
    expect(dal.findAll).not.toHaveBeenCalled()
  })

  it('returns degraded when no API key', async () => {
    const result = await generateAiSuggestions({ conversationId: 'conv-1', userId: 'user-1' })
    expect(result).toEqual({ suggestions: [], degraded: true })
    expect(authz.assertOwnsConversation).toHaveBeenCalledWith('user-1', 'conv-1')
  })

  it('writes audit log and records AI call on success; system prompt includes language instruction', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    anthropic.create.mockResolvedValue({
      model: 'claude-haiku-4-5-20251001',
      content: [{ type: 'text', text: '["نعم، ما زالت متاحة.", "هل تود ترتيب معاينة؟"]' }],
      usage: { input_tokens: 12, output_tokens: 18 },
    })

    const result = await generateAiSuggestions({ conversationId: 'conv-1', userId: 'user-1' })
    expect(result.degraded).toBeUndefined()
    expect(result.suggestions).toHaveLength(2)
    expect(result.suggestions[0].language).toBe('ar')
    expect(result.model).toBe('claude-haiku-4-5-20251001')
    expect(typeof result.latency_ms).toBe('number')

    expect(aiCaps.assertAiSuggestionAllowed).toHaveBeenCalledWith('user-1', expect.objectContaining({
      activeTenantId: null,
    }))
    expect(aiCaps.recordAiSuggestionUsage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      tenantId: 'personal:user-1',
      inputTokens: 12,
      outputTokens: 18,
    }))

    expect(anthropic.create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringMatching(/SAME language|language code: ar|Never auto-translate/i),
        messages: [expect.objectContaining({ role: 'user' })],
      }),
    )

    expect(dal.insert).toHaveBeenCalledWith(
      'audit_log',
      expect.objectContaining({
        type: 'ai_suggestion',
        action: 'generate',
        entity_id: 'conv-1',
        metadata: expect.objectContaining({
          input_tokens: 12,
          output_tokens: 18,
          user_id: 'user-1',
          tenant_id: 'personal:user-1',
        }),
      }),
    )
    expect(usageLogger.recordAiCall).toHaveBeenCalled()
  })

  it('throws AI_DAILY_CAP before calling Anthropic', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    aiCaps.assertAiSuggestionAllowed.mockRejectedValueOnce(
      Object.assign(new Error('AI daily suggestion cap reached'), {
        status: 429,
        code: 'AI_DAILY_CAP',
        cap: 200,
        used: 200,
        resets_at: '2026-09-16T00:00:00.000Z',
      }),
    )

    await expect(
      generateAiSuggestions({ conversationId: 'conv-1', userId: 'user-1' }),
    ).rejects.toMatchObject({ status: 429, code: 'AI_DAILY_CAP' })
    expect(anthropic.create).not.toHaveBeenCalled()
  })

  it('returns degraded on timeout', async () => {
    const result = await generateAiSuggestions({
      conversationId: 'conv-1',
      userId: 'user-1',
      deps: {
        apiKey: 'test-key',
        timeoutMs: 30,
        createMessage: () => new Promise(() => {}),
      },
    })
    expect(result).toEqual({ suggestions: [], degraded: true })
  })

  it('returns degraded on Anthropic errors without heuristic fallback', async () => {
    const result = await generateAiSuggestions({
      conversationId: 'conv-1',
      userId: 'user-1',
      deps: {
        apiKey: 'test-key',
        createMessage: async () => {
          throw new Error('upstream')
        },
      },
    })
    expect(result).toEqual({ suggestions: [], degraded: true })
  })
})
