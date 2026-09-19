/**
 * AGN-WLB-003 — agency white-label copy fields editor API.
 */
import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne } from '../../db.js'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import {
  FEATURED_FILTERS,
  FEATURED_SORTS,
  ensureAgencySiteConfig,
  getAgencySiteConfig,
  publishAgencySiteConfig,
  updateAgencySiteCopyFields,
} from './agency-site-config.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

const featuredSchema = z.object({
  filter: z.enum(FEATURED_FILTERS).optional(),
  area: z.string().max(120).optional(),
  property_type: z.string().max(80).optional(),
  price_min: z.number().nonnegative().nullable().optional(),
  price_max: z.number().nonnegative().nullable().optional(),
  sort: z.enum(FEATURED_SORTS).optional(),
}).strict()

const copyFieldsSchema = z.object({
  header: z.object({ tagline: z.string().max(200).optional() }).strict().optional(),
  about: z.object({
    paragraph: z.string().max(5000).optional(),
    mission: z.string().max(2000).optional(),
  }).strict().optional(),
  featured_listings: featuredSchema.optional(),
  team: z.object({ intro: z.string().max(2000).optional() }).strict().optional(),
  contact: z.object({
    phone: z.string().max(40).optional(),
    email: z.string().max(200).optional(),
    address: z.string().max(500).optional(),
    hours: z.string().max(500).optional(),
  }).strict().optional(),
  footer: z.object({ disclaimer: z.string().max(2000).optional() }).strict().optional(),
}).strict()

const updateSchema = z.object({
  copy_fields: copyFieldsSchema,
}).strict()

async function requireAgencySiteEditor(req, res, next) {
  const memberships = await listUserAgencyMemberships(req.user.id)
  const membership = memberships.find((row) => row.affiliation_mode === 'exclusive' && ADMIN_ROLES.has(row.role))
  if (!membership?.agency_id) {
    return res.status(403).json({ error: 'Agency admin access required' })
  }
  const agency = await findOne('agencies', (row) => row.id === membership.agency_id)
  if (!agency) return res.status(404).json({ error: 'Agency not found' })
  req.agencyId = membership.agency_id
  req.agency = agency
  next()
}

export function registerAgencySiteConfigRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || authMiddleware

  app.get('/api/agency/white-label/copy', auth, requireAgencySiteEditor, async (req, res) => {
    const config = await ensureAgencySiteConfig(req.agencyId)
    res.json({ config, agency_name: req.agency.name })
  })

  app.put('/api/agency/white-label/copy', auth, requireAgencySiteEditor, async (req, res) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    const config = await updateAgencySiteCopyFields(req.agencyId, parsed.data.copy_fields)
    res.json({ config })
  })

  app.post('/api/agency/white-label/copy/publish', auth, requireAgencySiteEditor, async (req, res) => {
    const config = await publishAgencySiteConfig(req.agencyId)
    res.json({ config })
  })
}

export { registerAgencySiteConfigRoutes as registerRoutes }
