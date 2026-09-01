import { describe, it, expect, vi, afterEach } from 'vitest'
import { createProvider as createClaude } from './claude.js'
import { createProvider as createOpenAi } from './openai.js'
import { createProvider as createGemini } from './gemini.js'
import { createProvider as createDeepseek } from './deepseek.js'
import { createProvider as createKimi } from './kimi.js'
import { createProvider as createQwen } from './qwen.js'

function mockFetchJson(body) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
}

function logger() {
  return { debug: vi.fn(), warn: vi.fn() }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const providers = [
  {
    name: 'claude',
    factory: createClaude,
    withUsage: {
      content: [{ type: 'text', text: '{"caption":"ok","hashtags":[]}' }],
      usage: { input_tokens: 11, output_tokens: 7 },
    },
    withoutUsage: {
      content: [{ type: 'text', text: '{"caption":"ok","hashtags":[]}' }],
    },
  },
  {
    name: 'openai',
    factory: createOpenAi,
    withUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
      usage: { prompt_tokens: 21, completion_tokens: 9 },
    },
    withoutUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
    },
  },
  {
    name: 'gemini',
    factory: createGemini,
    withUsage: {
      candidates: [{ content: { parts: [{ text: '{"caption":"ok","hashtags":[]}' }] } }],
      usageMetadata: { promptTokenCount: 33, candidatesTokenCount: 4 },
    },
    withoutUsage: {
      candidates: [{ content: { parts: [{ text: '{"caption":"ok","hashtags":[]}' }] } }],
    },
  },
  {
    name: 'deepseek',
    factory: createDeepseek,
    withUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 6 },
    },
    withoutUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
    },
  },
  {
    name: 'kimi',
    factory: createKimi,
    withUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
      usage: { prompt_tokens: 18, completion_tokens: 5 },
    },
    withoutUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
    },
  },
  {
    name: 'qwen',
    factory: createQwen,
    withUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
      usage: { prompt_tokens: 40, completion_tokens: 12 },
    },
    withoutUsage: {
      choices: [{ message: { content: '{"caption":"ok","hashtags":[]}' } }],
    },
  },
]

describe.each(providers)('$name token usage extraction', ({ name, factory, withUsage, withoutUsage }) => {
  it('extracts inputTokens and outputTokens from the canonical response', async () => {
    mockFetchJson(withUsage)
    const log = logger()
    const provider = factory({ apiKey: 'test-key', logger: log })
    const result = await provider.generateCaption({ platform: 'instagram', prompt: 'hi' })
    expect(result.text).toContain('caption')
    expect(result.raw).toEqual(withUsage)
    const expectedIn = withUsage.usage?.input_tokens ?? withUsage.usage?.prompt_tokens ?? withUsage.usageMetadata?.promptTokenCount
    const expectedOut = withUsage.usage?.output_tokens ?? withUsage.usage?.completion_tokens ?? withUsage.usageMetadata?.candidatesTokenCount
    expect(result.usage).toEqual({ inputTokens: expectedIn, outputTokens: expectedOut })
    expect(log.warn).not.toHaveBeenCalled()
  })

  it('returns zeros and warns when usage fields are missing', async () => {
    mockFetchJson(withoutUsage)
    const log = logger()
    const provider = factory({ apiKey: 'test-key', logger: log })
    const result = await provider.generateCaption({ platform: 'instagram', prompt: 'hi' })
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(log.warn).toHaveBeenCalled()
    expect(log.warn.mock.calls[0][1]).toMatch(/usage fields missing/)
  })
})
