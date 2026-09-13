/**
 * Inbox AI suggested replies (Wave 8).
 * Fail-open on missing key / Anthropic errors / 5s timeout — no heuristic fallback.
 */

import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import rateLimit from 'express-rate-limit'
import { findAll, findOne, insert } from '../../db.js'
import { personalTenantId } from '../../tenant-authorization.js'
import { assertOwnsConversation } from '../authz.js'
import { recordAiCall } from '../ai-usage-logger.js'

export const AI_SUGGESTION_MODEL = 'claude-haiku-4-5-20251001'
export const AI_SUGGESTION_TIMEOUT_MS = 5_000
export const AI_SUGGESTION_MAX_BODY = 240
export const AI_SUGGESTION_MAX_COUNT = 3

export function heuristicSuggestionBodies(lastInbound, contactName, language = 'en') {
  const first = String(contactName || '').split(' ')[0] || 'there'
  const text = String(lastInbound?.content || lastInbound?.body || '').toLowerCase()
  const suggestions = []
  if (lastInbound?.suggested_reply) suggestions.push(String(lastInbound.suggested_reply).trim())
  if (/\b(available|availability|still for sale|still on)\b/.test(text)) {
    suggestions.push('Yes, it is still available. Would you like to schedule a viewing?')
  }
  if (/\b(price|asking|offer|discount)\b/.test(text)) {
    suggestions.push('Happy to walk you through the current asking price and recent comps.')
  }
  suggestions.push(Thanks for reaching out, . When works for a viewing?)
  suggestions.push('I can send the floor plan and latest photos — which would you like first?')
  return normalizeSuggestionBodies(suggestions, language)
}

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/

/**
 * @param {string | null | undefined} text
 * @param {string | null | undefined} [hint]
 * @returns {'ar' | 'en'}
 */
export function detectSuggestionLanguage(text, hint) {
  const normalizedHint = String(hint || '').toLowerCase()
  if (normalizedHint === 'ar' || normalizedHint === 'en') return normalizedHint
  if (ARABIC_SCRIPT_RE.test(String(text || ''))) return 'ar'
  return 'en'
}

/**
 * @param {unknown} raw
 * @param {'ar' | 'en'} language
 * @returns {Array<{ id: string, body: string, language: 'ar' | 'en' }>}
 */
export function normalizeSuggestionBodies(raw, language) {
  /** @type {string[]} */
  let bodies = []
  if (Array.isArray(raw)) {
    bodies = raw.map((item) => {
      if (item && typeof item === 'object' && 'body' in item) return String(item.body || '')
      return String(item || '')
    })
  } else if (typeof raw === 'string') {
    const text = raw.trim()
    try {
      const jsonStart = text.indexOf('[')
      const jsonEnd = text.lastIndexOf(']')
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
        if (Array.isArray(parsed)) {
          bodies = parsed.map((item) => {
            if (item && typeof item === 'object' && 'body' in item) return String(item.body || '')
            return String(item || '')
          })
        }
      }
    } catch {
      bodies = text
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').replace(/^["']|["']$/g, '').trim())
    }
  }

  const seen = new Set()
  /** @type {Array<{ id: string, body: string, language: 'ar' | 'en' }>} */
  const out = []
  for (const body of bodies) {
    const trimmed = String(body || '').trim().slice(0, AI_SUGGESTION_MAX_BODY)
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push({ id: randomUUID(), body: trimmed, language })
    if (out.length >= AI_SUGGESTION_MAX_COUNT) break
  }
  return out
}

/**
 * Rate limiter: 20 req / minute / user (mirrors admin-limiter pattern).
 * @param {{ skipInVitest?: boolean }} [options]
 */
export function createAiSuggestionsLimiter(options = {}) {
  const skipInVitest = options.skipInVitest !== false
  return rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.id || req.ip || 'anonymous'),
    validate: false,
    skip: () => (skipInVitest ? Boolean(process.env.VITEST) : false),
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Too many requests, please try again later.',
        code: 'RATE_LIMITED',
      })
    },
  })
}

function buildSystemPrompt(language) {
  return [
    'You are Wingcaster, an assistant for a real-estate agent drafting short inbox reply suggestions.',
    'Keep a brief, professional tone.',
    `Respond in the SAME language as the last inbound message (language code: ${language}).`,
    'Never auto-translate between Arabic and English.',
    'Never fabricate property facts (price, availability, size, amenities, location details).',
    'Return ONLY a JSON array of up to 3 short reply strings. No markdown, no commentary.',
    `Each reply must be at most ${AI_SUGGESTION_MAX_BODY} characters.`,
  ].join(' ')
}

/**
 * @param {{
 *   conversationId: string,
 *   userId: string,
 *   deps?: Record<string, unknown>,
 * }} args
 */
export async function generateAiSuggestions({ conversationId, userId, deps = {} }) {
  const assertOwns = /** @type {typeof assertOwnsConversation} */ (
    deps.assertOwnsConversation || assertOwnsConversation
  )
  const findAllFn = /** @type {typeof findAll} */ (deps.findAll || findAll)
  const insertFn = /** @type {typeof insert} */ (deps.insert || insert)
  const recordAiCallFn = /** @type {typeof recordAiCall} */ (deps.recordAiCall || recordAiCall)
  const timeoutMs = Number(deps.timeoutMs || AI_SUGGESTION_TIMEOUT_MS)
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : process.env.ANTHROPIC_API_KEY
  const createMessage = deps.createMessage

  const conversation = await assertOwns(userId, conversationId)

  if (!apiKey && !createMessage) {
    return { suggestions: [], degraded: true }
  }

  const allMessages = await findAllFn(
    'conversation_messages',
    (m) => m.conversation_id === conversation.id,
  )
  const chronological = [...allMessages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const messages = chronological.slice(-20)
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')
  const inboundText = String(lastInbound?.content || lastInbound?.body || '')
  const language = detectSuggestionLanguage(inboundText, lastInbound?.language)

  const threadContext = messages
    .map((m) => `${m.direction}: ${String(m.content || m.body || '').slice(0, 240)}`)
    .join('\n')

  const system = buildSystemPrompt(language)
  const userContent = [
    'Draft up to 3 short reply suggestions for the agent.',
    threadContext ? `Recent thread (oldest → newest):\n${threadContext}` : 'Recent thread: (empty)',
    `Last inbound message:\n${inboundText || '(empty)'}`,
  ].join('\n\n')

  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const create = createMessage || ((params) => {
      const client = new Anthropic({ apiKey: String(apiKey) })
      return client.messages.create(params)
    })

    const callPromise = create({
      model: AI_SUGGESTION_MODEL,
      max_tokens: 400,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: userContent }],
      signal: controller.signal,
    })

    const timeoutPromise = new Promise((_, reject) => {
      const onAbort = () => reject(Object.assign(new Error('AI suggestion timeout'), { code: 'TIMEOUT' }))
      if (controller.signal.aborted) onAbort()
      else controller.signal.addEventListener('abort', onAbort, { once: true })
    })

    const response = await Promise.race([callPromise, timeoutPromise])
    const text = Array.isArray(response?.content)
      ? response.content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n')
      : ''
    const suggestions = normalizeSuggestionBodies(text, language)
    const latencyMs = Date.now() - started
    const model = response?.model || AI_SUGGESTION_MODEL
    const inputTokens = Number(response?.usage?.input_tokens || 0)
    const outputTokens = Number(response?.usage?.output_tokens || 0)

    let tenantId = null
    try {
      tenantId = personalTenantId(userId)
    } catch {
      tenantId = null
    }

    try {
      await insertFn('audit_log', {
        id: randomUUID(),
        agent_id: userId,
        type: 'ai_suggestion',
        action: 'generate',
        entity_type: 'conversation',
        entity_id: conversation.id,
        metadata: {
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          user_id: userId,
          tenant_id: tenantId,
        },
        created_at: new Date().toISOString(),
      })
    } catch {
      // audit is best-effort
    }

    await recordAiCallFn({
      tenantId,
      feature: 'inbox_ai_suggestions',
      callType: 'generate',
      provider: 'anthropic',
      model,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
      duration_ms: latencyMs,
      relatedEntityType: 'conversation',
      relatedEntityId: conversation.id,
    })

    return {
      suggestions,
      model,
      latency_ms: latencyMs,
    }
  } catch {
    return { suggestions: [], degraded: true }
  } finally {
    clearTimeout(timer)
  }
}
