/**
 * AGN-TPL-001 — agency-scoped message templates list API.
 */
import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne } from '../../db.js'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import {
  createAgencyMessageTemplate,
  getAgencyMessageTemplate,
  listAgencyMessageTemplates,
  publishAgencyMessageTemplate,
} from './agency-message-templates.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

const listQuerySchema = z.object({
  channel: z.enum(['whatsapp', 'sms', 'email']).optional(),
  category: z.enum(['greeting', 'follow_up', 'viewing', 'offer', 'general']).optional(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
}).strict()

const createSchema = z.object({
  name: z.string().min(1).max(120),
  channel: z.enum(['whatsapp', 'sms', 'email']),
  category: z.enum(['greeting', 'follow_up', 'viewing', 'offer', 'general']).optional(),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(10000),
  language: z.string().min(2).max(10).optional(),
  approval_status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
}).strict()

async function requireAgencyTemplateManager(req, res, next) {
  const memberships = await listUserAgencyMemberships(req.user.id)
  const membership = memberships.find((row) => row.affiliation_mode === 'exclusive' && ADMIN_ROLES.has(row.role))
  if (!membership?.agency_id) {
    return res.status(403).json({ error: 'Agency admin access required' })
  }
  const agency = await findOne('agencies', (row) => row.id === membership.agency_id)
  if (!agency) return res.status(404).json({ error: 'Agency not found' })
  req.agencyId = membership.agency_id
  req.membership = membership
  next()
}

export function registerAgencyMessageTemplateRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || authMiddleware

  app.get('/api/agency/templates', auth, requireAgencyTemplateManager, async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
    }
    const templates = await listAgencyMessageTemplates(req.agencyId, parsed.data)
    res.json({ templates })
  })

  app.get('/api/agency/templates/:id', auth, requireAgencyTemplateManager, async (req, res) => {
    const template = await getAgencyMessageTemplate(req.agencyId, req.params.id)
    if (!template) return res.status(404).json({ error: 'Template not found' })
    res.json(template)
  })

  app.post('/api/agency/templates', auth, requireAgencyTemplateManager, async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    try {
      const template = await createAgencyMessageTemplate(req.agencyId, req.user.id, parsed.data)
      res.status(201).json(template)
    } catch (err) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  app.post('/api/agency/templates/:id/publish', auth, requireAgencyTemplateManager, async (req, res) => {
    const template = await publishAgencyMessageTemplate(req.agencyId, req.params.id)
    if (!template) return res.status(404).json({ error: 'Template not found' })
    res.json(template)
  })
}

export { registerAgencyMessageTemplateRoutes as registerRoutes }
