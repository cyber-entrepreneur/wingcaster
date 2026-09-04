import { AI_PRODUCER_ERROR, codedError } from './errors.js'
import { producerConfig } from './config.js'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const TIMEOUT_MS = 30_000

function timeoutSignal(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function readJson(res) {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Provider HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw codedError('Provider response was not JSON', AI_PRODUCER_ERROR.AI_PROVIDER_PARSE_FAILED)
  }
}

function parseJsonObject(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw codedError('Provider returned empty content', AI_PRODUCER_ERROR.AI_PROVIDER_PARSE_FAILED)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw codedError('Provider JSON parse failed', AI_PRODUCER_ERROR.AI_PROVIDER_PARSE_FAILED)
  }
}

export async function callOpenAiJsonObject({ model, system, user, temperature = 0.2 }) {
  const apiKey = producerConfig().openai.apiKey
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const { signal, clear } = timeoutSignal(TIMEOUT_MS)
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal,
    })
    const data = await readJson(res)
    const content = data.choices?.[0]?.message?.content
    const parsed = parseJsonObject(content)
    return {
      provider: 'openai',
      model,
      parsed,
      usage: {
        inputTokens: Number(data.usage?.prompt_tokens || data.usage?.input_tokens || 0),
        outputTokens: Number(data.usage?.completion_tokens || data.usage?.output_tokens || 0),
      },
      raw: data,
    }
  } finally {
    clear()
  }
}

export async function callAnthropicTool({ model, system, user, tool, temperature = 0.2 }) {
  const apiKey = producerConfig().anthropic.apiKey
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

  const { signal, clear } = timeoutSignal(TIMEOUT_MS)
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 2048,
        system,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: user }],
      }),
      signal,
    })
    const data = await readJson(res)
    const toolUse = Array.isArray(data.content)
      ? data.content.find((block) => block?.type === 'tool_use' && block?.name === tool.name)
      : null
    if (!toolUse || toolUse.input == null || typeof toolUse.input !== 'object') {
      throw codedError('Anthropic tool-use payload missing', AI_PRODUCER_ERROR.AI_PROVIDER_PARSE_FAILED)
    }
    return {
      provider: 'anthropic',
      model,
      parsed: toolUse.input,
      usage: {
        inputTokens: Number(data.usage?.input_tokens || 0),
        outputTokens: Number(data.usage?.output_tokens || 0),
      },
      raw: data,
    }
  } finally {
    clear()
  }
}
