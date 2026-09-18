/**
 * AGT-TSK-003 — Reminder policies CRUD.
 */
import { z } from 'zod'
import { findOne } from '../../db.js'
import {
  createReminderPolicy,
  deleteReminderPolicy,
  getReminderPolicies,
  getReminderPolicyById,
  updateReminderPolicy,
} from '../../reminders.js'

const ruleSchema = z
  .object({
    offset_minutes: z.number().int(),
    channels: z.array(z.enum(['email', 'whatsapp', 'inapp'])).min(1).max(3),
    message_template: z.string().max(2000).optional(),
    active: z.boolean().optional(),
  })
  .strict()

const createSchema = z
  .object({
    name: z.string().min(1).max(120),
    owner_type: z.enum(['agent', 'agency']).default('agent'),
    owner_id: z.string().min(1).max(128).optional(),
    appointment_type: z.enum(['viewing', 'call', 'booking', 'meeting']),
    rules: z.array(ruleSchema).min(1).max(12),
    is_default: z.boolean().optional(),
  })
  .strict()

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    appointment_type: z.enum(['viewing', 'call', 'booking', 'meeting']).optional(),
    rules: z.array(ruleSchema).min(1).max(12).optional(),
    is_default: z.boolean().optional(),
  })
  .strict()

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

async function assertCanAccessPolicy(userId, policy) {
  if (!policy) {
    const err = new Error('Not found')
    err.status = 404
    err.name = 'NotFoundError'
    throw err
  }
  if (policy.owner_type === 'agent') {
    if (policy.owner_id !== userId) {
      const err = new Error('Not found')
      err.status = 404
      err.name = 'NotFoundError'
      throw err
    }
    return policy
  }
  const member = await findOne(
    'agency_members',
    (m) => m.agency_id === policy.owner_id && m.user_id === userId && m.status === 'active',
  )
  if (!member) {
    const err = new Error('Not found')
    err.status = 404
    err.name = 'NotFoundError'
    throw err
  }
  return policy
}

async function assertCanMutatePolicy(userId, policy) {
  await assertCanAccessPolicy(userId, policy)
  if (policy.owner_type === 'agency') {
    const member = await findOne(
      'agency_members',
      (m) => m.agency_id === policy.owner_id && m.user_id === userId && m.status === 'active',
    )
    if (!member || !['owner', 'admin'].includes(member.role)) {
      const err = new Error('Not found')
      err.status = 404
      err.name = 'NotFoundError'
      throw err
    }
  }
  return policy
}

export function registerRoutes(app, { authMiddleware, logActivity }) {
  app.get('/api/reminder-policies', authMiddleware, async (req, res) => {
    try {
      const ownerType = req.query.owner_type || 'agent'
      const ownerId = ownerType === 'agent' ? req.user.id : String(req.query.owner_id || '')
      if (ownerType === 'agency') {
        const member = await findOne(
          'agency_members',
          (m) => m.agency_id === ownerId && m.user_id === req.user.id && m.status === 'active',
        )
        if (!member) return res.status(404).json({ error: 'Not found' })
      }
      const rows = await getReminderPolicies({
        ownerType,
        ownerId: ownerType === 'agent' ? req.user.id : ownerId,
        appointmentType: req.query.appointment_type,
      })
      res.json(rows)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/reminder-policies', authMiddleware, async (req, res) => {
    try {
      const parsed = createSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      }
      const body = parsed.data
      const ownerType = body.owner_type
      const ownerId = ownerType === 'agent' ? req.user.id : body.owner_id
      if (ownerType === 'agency') {
        const member = await findOne(
          'agency_members',
          (m) => m.agency_id === ownerId && m.user_id === req.user.id && m.status === 'active',
        )
        if (!member || !['owner', 'admin'].includes(member.role)) {
          return res.status(404).json({ error: 'Not found' })
        }
      }
      const policy = await createReminderPolicy({
        name: body.name,
        ownerType,
        ownerId,
        appointmentType: body.appointment_type,
        rules: body.rules,
        isDefault: body.is_default,
      })
      if (logActivity) {
        await logActivity({
          type: 'reminder_policy_created',
          agent_id: req.user.id,
          meta: { policy_id: policy.id, appointment_type: policy.appointment_type },
        })
      }
      res.status(201).json(policy)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.get('/api/reminder-policies/:id', authMiddleware, async (req, res) => {
    try {
      const policy = await getReminderPolicyById(req.params.id)
      await assertCanAccessPolicy(req.user.id, policy)
      res.json(policy)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Not found' })
      res.status(500).json({ error: err.message })
    }
  })

  app.patch('/api/reminder-policies/:id', authMiddleware, async (req, res) => {
    try {
      const parsed = patchSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      }
      const policy = await getReminderPolicyById(req.params.id)
      await assertCanMutatePolicy(req.user.id, policy)
      const updated = await updateReminderPolicy(req.params.id, parsed.data)
      if (logActivity) {
        await logActivity({
          type: 'reminder_policy_updated',
          agent_id: req.user.id,
          meta: { policy_id: req.params.id },
        })
      }
      res.json(updated)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Not found' })
      res.status(400).json({ error: err.message })
    }
  })

  app.delete('/api/reminder-policies/:id', authMiddleware, async (req, res) => {
    try {
      const policy = await getReminderPolicyById(req.params.id)
      await assertCanMutatePolicy(req.user.id, policy)
      await deleteReminderPolicy(req.params.id)
      if (logActivity) {
        await logActivity({
          type: 'reminder_policy_deleted',
          agent_id: req.user.id,
          meta: { policy_id: req.params.id },
        })
      }
      res.json({ success: true })
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Not found' })
      res.status(500).json({ error: err.message })
    }
  })
}
