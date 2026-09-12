/**
 * Agency capability-pack HTTP surface (BE-BLOCKER-29).
 *
 * GET   /api/agency/capability-packs
 * GET   /api/agency/capability-packs/:id
 * PATCH /api/agency/members/:userId/capability-packs
 * POST  /api/agency/capability-pack-definitions → 405 (no create in v1)
 */

import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne } from '../../db.js'
import {
  getAgencyMembership,
  listUserAgencyMemberships,
} from '../../tenant-authorization.js'
import { validate } from '../validation.js'
import logger from '../logger.js'
import {
  assignCapabilityPacks,
  countAgencyMembers,
  countAgencyOwners,
  countMembersByPack,
  getPackDefinition,
  listMembersPreview,
  listPackDefinitions,
  membershipHasSettingsAccess,
  toDetailPackDto,
  toListPackDto,
} from './capability-packs.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

export const assignCapabilityPacksSchema = z.object({
  packs: z.array(z.string().min(1).max(120)).max(20),
  audit_reason: z.string().max(500).optional().nullable(),
}).passthrough()

async function resolveCallerAgencyMembership(req) {
  const memberships = await listUserAgencyMemberships(req.user.id)
  if (!memberships.length) return null

  const activeTenantId = req.user.active_tenant_id || null
  if (activeTenantId && String(activeTenantId).startsWith('agency:')) {
    const match = memberships.find((m) => m.tenant_id === activeTenantId)
    if (match) return match
  }

  const admin = memberships.find((m) => ADMIN_ROLES.has(m.role))
  if (admin) return admin
  return memberships.find((m) => m.role !== 'guest') || memberships[0]
}

async function requireAgencySettingsRead(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const membership = await resolveCallerAgencyMembership(req)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!membershipHasSettingsAccess(membership)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const agency = await findOne('agencies', (row) => row.id === membership.agency_id)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })
    req.agency = agency
    req.agencyId = agency.id
    req.membership = membership
    next()
  } catch (err) {
    next(err)
  }
}

async function requireAgencySettingsWrite(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const membership = await resolveCallerAgencyMembership(req)
    if (!membership?.agency_id || !ADMIN_ROLES.has(membership.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const agency = await findOne('agencies', (row) => row.id === membership.agency_id)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })
    req.agency = agency
    req.agencyId = agency.id
    req.membership = membership
    next()
  } catch (err) {
    next(err)
  }
}

export function registerAgencyCapabilityPackRoutes(app, { auth = authMiddleware } = {}) {
  app.post('/api/agency/capability-pack-definitions', auth, (_req, res) => {
    res.set('Allow', 'GET')
    return res.status(405).json({
      error: 'Method Not Allowed',
      code: 'CAPABILITY_PACK_CREATE_DISABLED',
      message: 'v1 supports one Custom pack; creating additional pack definitions is not allowed.',
    })
  })

  app.post('/api/agency/capability-packs', auth, (_req, res) => {
    res.set('Allow', 'GET')
    return res.status(405).json({
      error: 'Method Not Allowed',
      code: 'CAPABILITY_PACK_CREATE_DISABLED',
      message: 'v1 supports one Custom pack; creating additional pack definitions is not allowed.',
    })
  })

  app.get(
    '/api/agency/capability-packs',
    auth,
    requireAgencySettingsRead,
    async (req, res) => {
      try {
        const [defs, counts, ownerCount, memberCountTotal] = await Promise.all([
          listPackDefinitions(),
          countMembersByPack(req.agencyId),
          countAgencyOwners(req.agencyId),
          countAgencyMembers(req.agencyId),
        ])
        const packs = defs.map((pack) => toListPackDto(pack, {
          memberCount: counts[pack.slug] || counts[pack.id] || 0,
        }))
        return res.json({
          agency_id: req.agencyId,
          packs,
          agency_meta: {
            owner_count: ownerCount,
            member_count_total: memberCountTotal,
          },
        })
      } catch (err) {
        logger.error(
          { err: err.message, agency_id: req.agencyId, user_id: req.user?.id },
          'list capability packs failed',
        )
        return res.status(500).json({ error: 'Failed to load capability packs' })
      }
    },
  )

  app.get(
    '/api/agency/capability-packs/:id',
    auth,
    requireAgencySettingsRead,
    async (req, res) => {
      try {
        const pack = await getPackDefinition(req.params.id)
        if (!pack) return res.status(404).json({ error: 'Pack not found' })
        const [counts, membersPreview] = await Promise.all([
          countMembersByPack(req.agencyId),
          listMembersPreview(req.agencyId, pack.slug || pack.id),
        ])
        return res.json(toDetailPackDto(pack, {
          memberCount: counts[pack.slug] || counts[pack.id] || 0,
          membersPreview,
        }))
      } catch (err) {
        logger.error(
          { err: err.message, agency_id: req.agencyId, pack_id: req.params.id, user_id: req.user?.id },
          'get capability pack failed',
        )
        return res.status(500).json({ error: 'Failed to load capability pack' })
      }
    },
  )

  app.patch(
    '/api/agency/members/:userId/capability-packs',
    auth,
    requireAgencySettingsWrite,
    validate(assignCapabilityPacksSchema),
    async (req, res) => {
      try {
        const targetUserId = String(req.params.userId || '')
        const targetMembership = await getAgencyMembership(req.agencyId, targetUserId)
        if (!targetMembership) {
          return res.status(404).json({ error: 'Member not found', code: 'MEMBER_NOT_FOUND' })
        }

        const result = await assignCapabilityPacks({
          agencyId: req.agencyId,
          targetUserId,
          packRefs: req.validated.packs,
          actorId: req.user.id,
          auditReason: req.validated.audit_reason ?? null,
        })

        if (result.pending) {
          return res.status(202).json({
            approval_request_id: result.approval_request_id,
            requires_approvers: result.requires_approvers,
            message: result.message,
          })
        }

        return res.status(200).json({
          membership: result.membership,
          packs: result.membership?.capability_packs || [],
        })
      } catch (err) {
        if (err.code === 'UNKNOWN_PACK') {
          return res.status(400).json({ error: 'UNKNOWN_PACK', unknown_ids: err.unknown_ids || [] })
        }
        if (err.code === 'SECOND_OWNER_REQUIRED') {
          return res.status(409).json({
            error: 'SECOND_OWNER_REQUIRED',
            help_url: err.help_url || '/agency/settings/ownership',
          })
        }
        if (err.code === 'MEMBER_NOT_FOUND') {
          return res.status(404).json({ error: 'Member not found', code: 'MEMBER_NOT_FOUND' })
        }
        logger.error(
          {
            err: err.message,
            agency_id: req.agencyId,
            target_user_id: req.params.userId,
            user_id: req.user?.id,
          },
          'assign capability packs failed',
        )
        return res.status(500).json({ error: 'Failed to assign capability packs' })
      }
    },
  )
}

export { registerAgencyCapabilityPackRoutes as registerRoutes }
