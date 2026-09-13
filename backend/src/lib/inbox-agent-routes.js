/**
 * Inbox agent preferences, bulk actions, and AI suggested-reply contract
 * (AGT-INB-001 / AGT-INB-002).
 *
 * inbox_merge_mode lives on tenant_memberships.data — same bag as Wave 8 Pro
 * dashboard_layout / list-prefs — so no extra migration is required.
 */

import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { findOne, insert, update } from '../db.js'
import { findUserById } from '../identity.js'
import { personalTenantId } from '../tenant-authorization.js'
import { assertOwnsContact, assertOwnsConversation } from './authz.js'
import { validate } from './validation.js'
import {
  assignConversation,
  archiveConversation,
  markConversationReadByAgent,
  markConversationUnreadByAgent,
} from '../conversations/orchestrator.js'
import {
  createAiSuggestionsLimiter,
  generateAiSuggestions,
} from './conversations/ai-suggestions.js'

const MERGE_MODES = ['merged', 'separate']

const prefsPatchSchema = z.object({
  inbox_merge_mode: z.enum(['merged', 'separate']),
})

const bulkSchema = z.object({
  conversation_ids: z.array(z.string().min(1).max(80)).min(1).max(200),
  action: z.enum(['mark_read', 'mark_unread', 'assign', 'archive']),
  assign_to_agent_id: z.string().min(1).max(80).optional(),
})

const revealPiiSchema = z.object({
  field: z.enum(['phone', 'email', 'name']),
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

export function registerInboxAgentRoutes(app, deps) {
  const { authMiddleware } = deps
  if (!authMiddleware) throw new Error('registerInboxAgentRoutes requires authMiddleware')

  const aiSuggestionsLimiter = createAiSuggestionsLimiter()

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

  app.post(
    '/api/conversations/:id/ai-suggestions',
    authMiddleware,
    aiSuggestionsLimiter,
    async (req, res) => {
      if (!inboxAiEnabled()) {
        return res.json({ suggestions: [], degraded: true })
      }
      try {
        const result = await generateAiSuggestions({
          conversationId: req.params.id,
          userId: req.user.id,
        })
        return res.json(result)
      } catch (err) {
        if (err?.status === 404 || err?.status === 403) {
          return res.status(err.status).json({ error: err.message || 'Not found' })
        }
        return res.json({ suggestions: [], degraded: true })
      }
    },
  )

  app.post(
    '/api/contacts/:id/reveal-pii',
    authMiddleware,
    validate(revealPiiSchema),
    async (req, res) => {
      try {
        const contact = await assertOwnsContact(req.user.id, req.params.id)
        const field = req.validated.field
        await insert('audit_log', {
          id: randomUUID(),
          agent_id: req.user.id,
          type: 'contact_pii_viewed',
          action: 'reveal',
          entity_type: 'contact',
          entity_id: contact.id,
          ip: req.ip || null,
          user_agent: req.get?.('user-agent') || null,
          metadata: {
            field,
            contact_id: contact.id,
            source: 'inbox',
          },
          created_at: new Date().toISOString(),
        })
        return res.json({ ok: true, field })
      } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || 'Reveal failed' })
      }
    },
  )
}