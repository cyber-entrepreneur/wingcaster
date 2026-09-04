import { describe, it, expect, vi, beforeEach } from 'vitest'

const { insert, warn } = vi.hoisted(() => ({
  insert: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../persistence/postgres-adapter.js', () => ({
  insert: (...args) => insert(...args),
}))

vi.mock('./logger.js', () => ({
  logger: { warn, info: vi.fn(), debug: vi.fn(), child: vi.fn() },
}))

import { estimateCostMicroUsd, recordAiCall } from './ai-usage-logger.js'

describe('estimateCostMicroUsd', () => {
  it('returns a known cost for a priced model', () => {
    expect(estimateCostMicroUsd('openai', 'gpt-4o-mini', 1_000_000, 0)).toBe(1500)
    expect(estimateCostMicroUsd('openai', 'gpt-4o-mini', 1000, 2000)).toBe(14)
  })

  it('returns null for an unknown model', () => {
    expect(estimateCostMicroUsd('openai', 'gpt-does-not-exist', 100, 100)).toBeNull()
  })

  it('returns 0 for zero tokens on a known model', () => {
    expect(estimateCostMicroUsd('claude', 'claude-3-haiku-20240307', 0, 0)).toBe(0)
  })

  it('prices Claude Haiku 4.5 at $1 / $5 per 1M tokens', () => {
    expect(estimateCostMicroUsd('claude', 'claude-haiku-4-5-20251001', 1_000_000, 0)).toBe(10_000)
    expect(estimateCostMicroUsd('claude', 'claude-haiku-4-5-20251001', 0, 1_000_000)).toBe(50_000)
  })
})

describe('recordAiCall', () => {
  beforeEach(() => {
    insert.mockReset()
    warn.mockReset()
  })

  it('inserts a usage row on the happy path', async () => {
    insert.mockResolvedValue({ id: 'row-1' })
    await recordAiCall({
      tenantId: 'agent-1',
      feature: 'whatsapp-listings',
      callType: 'extractProperty',
      providerResult: {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        usage: { inputTokens: 100, outputTokens: 40 },
        fallbackFrom: null,
      },
      relatedEntityType: 'session',
      relatedEntityId: 'sess-1',
    })
    expect(insert).toHaveBeenCalledTimes(1)
    const [collection, row] = insert.mock.calls[0]
    expect(collection).toBe('ai_call_usage')
    expect(row).toMatchObject({
      tenant_id: 'agent-1',
      feature: 'whatsapp-listings',
      call_type: 'extractProperty',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      input_tokens: 100,
      output_tokens: 40,
      fallback_from: null,
      related_entity_type: 'session',
      related_entity_id: 'sess-1',
    })
    expect(row.cost_estimate_micro_usd).toBe(Math.round(100 * 750 / 1_000_000 + 40 * 3000 / 1_000_000))
    expect(warn).not.toHaveBeenCalled()
  })

  it('places request_id and duration_ms on the insert payload, not nested under data', async () => {
    insert.mockResolvedValue({ id: 'row-2' })
    await recordAiCall({
      feature: 'ai.post_creation',
      callType: 'createAiPost',
      provider: 'openai',
      model: 'gpt-4o-mini',
      tokens_in: 10,
      tokens_out: 4,
      duration_ms: 42,
      request_id: 'req-1',
      extras: { tone: 'warm' },
    })
    const [, row] = insert.mock.calls[0]
    expect(row.request_id).toBe('req-1')
    expect(row.duration_ms).toBe(42)
    expect(row.tone).toBe('warm')
    expect(row.data).toBeUndefined()
  })

  it('logs a warn and does not throw when insert fails', async () => {
    insert.mockRejectedValue(new Error('db down'))
    await expect(recordAiCall({
      feature: 'whatsapp-listings',
      callType: 'classifyIntent',
      providerResult: { provider: 'openai', model: 'gpt-4o-mini', usage: { inputTokens: 1, outputTokens: 1 } },
    })).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls[0][1]).toMatch(/recordAiCall failed/)
  })
})
