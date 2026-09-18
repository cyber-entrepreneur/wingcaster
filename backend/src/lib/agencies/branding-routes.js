import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne, insert, update } from '../../db.js'
import { getAgencyMembership } from '../../tenant-authorization.js'
import logger from '../logger.js'

const BRAND_FONTS = ['system', 'ibm-plex-sans', 'archivo', 'playfair-display']
const BRAND_COLOR = /^#[0-9A-Fa-f]{6}$/

const assetUrl = z.string().trim().max(2000).nullable().refine((value) => {
  if (!value) return true
  if (value.startsWith('/uploads/')) return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}, 'Asset must be an uploaded path or HTTPS URL')

export const agencyBrandingUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000),
  logo_url: assetUrl,
  favicon_url: assetUrl,
  primary_color: z.string().regex(BRAND_COLOR),
  accent_color: z.string().regex(BRAND_COLOR),
  font_family: z.enum(BRAND_FONTS),
}).strict()

const resetSchema = z.object({}).strict()
const WRITER_ROLES = new Set(['owner', 'admin'])

function serializeBranding(agency) {
  return {
    agency_id: agency.id,
    name: agency.name,
    description: agency.description || '',
    logo_url: agency.logo_url || agency.logo || null,
    favicon_url: agency.favicon_url || null,
    primary_color: agency.brand_primary_color || agency.primary_color || null,
    accent_color: agency.brand_accent_color || agency.secondary_color || null,
    font_family: agency.brand_font_family || 'system',
    updated_at: agency.brand_updated_at || agency.updated_at || null,
    updated_by: agency.brand_updated_by || null,
    is_default: !(
      agency.logo_url ||
      agency.favicon_url ||
      agency.brand_primary_color ||
      agency.brand_accent_color ||
      agency.brand_font_family
    ),
  }
}

async function requireBrandWriter(agencyId, userId) {
  const agency = await findOne('agencies', (item) => item.id === agencyId)
  if (!agency) return null
  const member = await getAgencyMembership(agency.id, userId)
  if (!member || !WRITER_ROLES.has(member.role)) return null
  return { agency, member }
}

async function writeAudit({ agencyId, actorId, action, before, after, req }) {
  try {
    await insert('audit_log', {
      id: randomUUID(),
      agent_id: actorId,
      agency_id: agencyId,
      type: `agency_branding_${action}`,
      action,
      entity_type: 'agency_branding',
      entity_id: agencyId,
      ip: req.ip || null,
      user_agent: req.get?.('user-agent') || null,
      metadata: { before, after },
    })
  } catch (error) {
    logger.error({ err: error.message, agencyId }, 'Agency branding audit write failed')
  }
}

export function registerAgencyBrandingRoutes(app, { authMiddleware: auth = authMiddleware } = {}) {
  app.get('/api/agencies/:id/branding', auth, async (req, res, next) => {
    try {
      const gate = await requireBrandWriter(req.params.id, req.user.id)
      if (!gate) return res.status(404).json({ error: 'Agency not found' })
      return res.json({ branding: serializeBranding(gate.agency) })
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/agencies/:id/branding', auth, async (req, res, next) => {
    try {
      const parsed = agencyBrandingUpdateSchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }
      const gate = await requireBrandWriter(req.params.id, req.user.id)
      if (!gate) return res.status(404).json({ error: 'Agency not found' })

      const before = serializeBranding(gate.agency)
      const now = new Date().toISOString()
      const payload = parsed.data
      await update(
        'agencies',
        (agency) => agency.id === gate.agency.id,
        (agency) => ({
          ...agency,
          name: payload.name,
          description: payload.description,
          logo_url: payload.logo_url || null,
          favicon_url: payload.favicon_url || null,
          brand_primary_color: payload.primary_color.toUpperCase(),
          brand_accent_color: payload.accent_color.toUpperCase(),
          brand_font_family: payload.font_family,
          brand_updated_at: now,
          brand_updated_by: req.user.id,
          updated_at: now,
        }),
      )
      const saved = await findOne('agencies', (agency) => agency.id === gate.agency.id)
      const after = serializeBranding(saved)
      await writeAudit({
        agencyId: gate.agency.id,
        actorId: req.user.id,
        action: 'updated',
        before,
        after,
        req,
      })
      return res.json({ branding: after })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/agencies/:id/branding/reset', auth, async (req, res, next) => {
    try {
      const parsed = resetSchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }
      const gate = await requireBrandWriter(req.params.id, req.user.id)
      if (!gate) return res.status(404).json({ error: 'Agency not found' })

      const before = serializeBranding(gate.agency)
      const now = new Date().toISOString()
      await update(
        'agencies',
        (agency) => agency.id === gate.agency.id,
        (agency) => ({
          ...agency,
          logo_url: null,
          favicon_url: null,
          brand_primary_color: null,
          brand_accent_color: null,
          brand_font_family: null,
          brand_updated_at: now,
          brand_updated_by: req.user.id,
          updated_at: now,
        }),
      )
      const saved = await findOne('agencies', (agency) => agency.id === gate.agency.id)
      const after = serializeBranding(saved)
      await writeAudit({
        agencyId: gate.agency.id,
        actorId: req.user.id,
        action: 'reset',
        before,
        after,
        req,
      })
      return res.json({ branding: after })
    } catch (error) {
      next(error)
    }
  })
}

export const __testing = { serializeBranding, requireBrandWriter }
