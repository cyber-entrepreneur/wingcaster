/**
 * Inbox agent preferences, bulk actions, and AI suggested-reply contract
 * (AGT-INB-001 / AGT-INB-002).
 *
 * inbox_merge_mode lives on tenant_memberships.data — same bag as Wave 8 Pro
 * dashboard_layout / list-prefs — so no extra migration is required.
 */

import { z } from 'zod'
import { findAll, findOne, update } from '../db.js'
import { findUserById } from '../identity.js'
import { personalTenantId } from '../tenant-authorization.js'
import { assertOwnsConversation } from './authz.js'
import { validate } from './validation.js'
import {
  assignConversation,
  archiveConversation,
  markConversationReadByAgent,
  markConversationUnreadByAgent,
} from '../conversations/orchestrator.js'

const MERGE_MODES = ['merged', 'separate']

const prefsPatchSchema = z.object({
  inbox_merge_mode: z.enum(['merged', 'separate']),
})

const bulkSchema = z.object({
  conversation_ids: z.array(z.string().min(1).max(80)).min(1).max(200),
  action: z.enum(['mark_read', 'mark_unread', 'assign', 'archive']),
  assign_to_agent_id: z.string().min(1).max(80).optional(),
})

function membershipDataBag(row) {
  const raw = row?.data
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
}

function normalizeMergeMode(value) {
  return MERGE_MODES.includes(value) ? value : 'separate'
}

async function resolveActiveTenantId(user) {
  if (user?.active_tenant_id) return user.active_tenant_id
  return personalTenantId(user.id)
}

async function loadActiveMembership(userId) {
  const user = await findUserById(userId)
  if (!user) return null
  const tenantId = await resolveActiveTenantId(user)
  const membership = await findOne(
    'tenant_memberships',
    (row) => row.user_id === userId && row.tenant_id === tenantId && row.status === 'active',
  )
  if (!membership) {
    return {
      user,
      tenantId,
      membership: null,
      data: {},
    }
  }
  return { user, tenantId, membership, data: membershipDataBag(membership) }
}

function inboxAiEnabled() {
  const flag = String(process.env.INBOX_AI_SUGGESTIONS || '1').toLowerCase()
  return flag !== '0' && flag !== 'false' && flag !== 'off'
}

function heuristicSuggestions(lastInbound, contactName) {
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
  suggestions.push(`Thanks for reaching out, ${first}. When works for a viewing?`)
  suggestions.push('I can send the floor plan and latest photos — which would you like first?')
  const seen = new Set()
  return suggestions.filter((item) => {
    if (!item || seen.has(item)) return false
    seen.add(item)
    return true
  }).slice(0, 3)
}

export function registerInboxAgentRoutes(app, deps) {
  const { authMiddleware } = deps
  if (!authMiddleware) throw new Error('registerInboxAgentRoutes requires authMiddleware')

  app.get('/api/agent-preferences', authMiddleware, async (req, res) => {
    const ctx = await loadActiveMembership(req.user.id)
    if (!ctx) return res.status(404).json({ error: 'User not found' })
    res.json({
      inbox_merge_mode: normalizeMergeMode(ctx.data.inbox_merge_mode),
      tenant_id: ctx.tenantId,
      updated_at: ctx.membership?.updated_at || null,
    })
  })

  app.patch('/api/agent-preferences', authMiddleware, validate(prefsPatchSchema), async (req, res) => {
    const ctx = await loadActiveMembership(req.user.id)
    if (!ctx) return res.status(404).json({ error: 'User not found' })
    const now = new Date().toISOString()
    const nextData = { ...ctx.data, inbox_merge_mode: req.validated.inbox_merge_mode }

    if (ctx.membership) {
      await update(
        'tenant_memberships',
        (row) => row.id === ctx.membership.id,
        (row) => ({ ...row, data: nextData, updated_at: now }),
      )
    } else {
      const user = await findUserById(req.user.id)
      await update(
        'users',
        (row) => row.id === req.user.id,
        (row) => ({
          ...row,
          data: { ...(user?.data || {}), inbox_merge_mode: req.validated.inbox_merge_mode },
          updated_at: now,
        }),
      )
    }

    res.json({
      inbox_merge_mode: req.validated.inbox_merge_mode,
      tenant_id: ctx.tenantId,
      updated_at: now,
    })
  })

  app.post('/api/conversations/bulk', authMiddleware, validate(bulkSchema), async (req, res) => {
    const { conversation_ids, action, assign_to_agent_id } = req.validated
    if (action === 'assign' && !assign_to_agent_id) {
      return res.status(400).json({ error: 'assign_to_agent_id is required' })
    }

    const failed = []
    let updated = 0
    for (const id of conversation_ids) {
      try {
        await assertOwnsConversation(req.user.id, id)
        if (action === 'mark_read') await markConversationReadByAgent(id)
        else if (action === 'mark_unread') await markConversationUnreadByAgent(id)
        else if (action === 'assign') await assignConversation(id, assign_to_agent_id)
        else if (action === 'archive') await archiveConversation(id)
        updated += 1
      } catch (err) {
        failed.push({
          conversation_id: id,
          error: err.status === 404 ? 'NOT_FOUND' : err.status === 403 ? 'PERMISSION_DENIED' : 'FAILED',
        })
      }
    }
    res.json({ updated, failed })
  })

  app.post('/api/conversations/:id/ai-suggestions', authMiddleware, async (req, res) => {
    if (!inboxAiEnabled()) {
      return res.json({ enabled: false, suggestions: [], source: null })
    }
    const conversation = await assertOwnsConversation(req.user.id, req.params.id)
    const messages = (await findAll('conversation_messages', (m) => m.conversation_id === conversation.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const lastInbound = messages.find((m) => m.direction === 'inbound')
    const contact = conversation.contact_id
      ? await findOne('contacts', (c) => c.id === conversation.contact_id)
      : null
    const suggestions = heuristicSuggestions(lastInbound, contact?.name || conversation.contact_name)
    res.json({
      enabled: true,
      suggestions,
      source: lastInbound?.suggested_reply ? 'stored' : 'heuristic',
    })
  })
}
