import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne, insert, update } from '../../db.js'
import { getAgencyMembership } from '../../tenant-authorization.js'
import logger from '../logger.js'

const EDITOR_ROLES = new Set(['owner', 'admin', 'marketer'])

export const publicProfileSettingsSchema = z.object({
  show_team: z.boolean(),
  show_listings: z.boolean(),
  show_reviews: z.boolean(),
  show_closed_transactions: z.boolean(),
  show_contact_form: z.boolean(),
  hero_title: z.string().trim().max(120),
  hero_body: z.string().trim().max(600),
  meta_description: z.string().trim().max(160),
}).strict()

export function serializePublicProfileSettings(row, agency) {
  return {
    agency_id: agency.id,
    show_team: row?.show_team ?? true,
    show_listings: row?.show_listings ?? true,
    show_reviews: row?.show_reviews ?? true,
    show_closed_transactions: row?.show_closed_transactions ?? false,
    show_contact_form: row?.show_contact_form ?? true,
    hero_title: row?.hero_title || agency.name || '',
    hero_body: row?.hero_body || agency.description || '',
    meta_description: row?.meta_description || agency.description || '',
    updated_at: row?.updated_at || null,
    updated_by: row?.updated_by || null,
    is_default: !row,
  }
}

export async function loadAgencyPublicProfileSettings(agency) {
  const row = await findOne('agency_public_profile_settings', (item) => item.agency_id === agency.id)
  return serializePublicProfileSettings(row, agency)
}

async function requireEditor(agencyId, userId) {
  const agency = await findOne('agencies', (item) => item.id === agencyId)
  if (!agency) return null
  const membership = await getAgencyMembership(agency.id, userId)
  if (!membership || !EDITOR_ROLES.has(membership.role)) return null
  return { agency, membership }
}

async function writeAudit({ agencyId, actorId, before, after, req }) {
  try {
    await insert('audit_log', {
      id: randomUUID(),
      agent_id: actorId,
      agency_id: agencyId,
      type: 'agency_public_profile_updated',
      action: 'update',
      entity_type: 'agency_public_profile_settings',
      entity_id: agencyId,
      ip: req.ip || null,
      user_agent: req.get?.('user-agent') || null,
      metadata: { before, after },
    })
  } catch (error) {
    logger.error({ err: error.message, agencyId }, 'Agency public profile audit write failed')
  }
}

export function registerAgencyPublicProfileSettingsRoutes(
  app,
  { authMiddleware: auth = authMiddleware } = {},
) {
  app.get('/api/agencies/:id/public-profile-settings', auth, async (req, res, next) => {
    try {
      const gate = await requireEditor(req.params.id, req.user.id)
      if (!gate) return res.status(404).json({ error: 'Agency not found' })
      return res.json({ settings: await loadAgencyPublicProfileSettings(gate.agency) })
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/agencies/:id/public-profile-settings', auth, async (req, res, next) => {
    try {
      const parsed = publicProfileSettingsSchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }
      const gate = await requireEditor(req.params.id, req.user.id)
      if (!gate) return res.status(404).json({ error: 'Agency not found' })

      const before = await loadAgencyPublicProfileSettings(gate.agency)
      const current = await findOne(
        'agency_public_profile_settings',
        (item) => item.agency_id === gate.agency.id,
      )
      const now = new Date().toISOString()
      if (current) {
        await update(
          'agency_public_profile_settings',
          (item) => item.agency_id === gate.agency.id,
          (item) => ({
            ...item,
            ...parsed.data,
            updated_by: req.user.id,
            updated_at: now,
          }),
        )
      } else {
        await insert('agency_public_profile_settings', {
          id: randomUUID(),
          agency_id: gate.agency.id,
          ...parsed.data,
          updated_by: req.user.id,
          created_at: now,
          updated_at: now,
          data: {},
        })
      }
      const after = await loadAgencyPublicProfileSettings(gate.agency)
      await writeAudit({
        agencyId: gate.agency.id,
        actorId: req.user.id,
        before,
        after,
        req,
      })
      return res.json({ settings: after })
    } catch (error) {
      next(error)
    }
  })
}
