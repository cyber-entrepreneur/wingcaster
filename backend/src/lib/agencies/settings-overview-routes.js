/**
 * AGN-SET-001 — Agency settings home overview.
 *
 * GET /api/agency/settings/overview
 *
 * Returns the caller's agency identity, their role, and a small set of
 * live status counts used to decorate the settings-home cards (member
 * count, pending applications, MFA-required, pending ownership transfer,
 * accepting-applications). Read-only.
 *
 * Gating: an active EXCLUSIVE agency membership is required (the same
 * primary-agency resolution the agency pricing surface uses). Callers with
 * no such membership receive 403 — never a leak of another agency's data.
 * Card-level permission (which cards an Owner/Admin vs. member sees) is
 * derived on the client from `my_role`.
 */

import { authMiddleware } from '../../auth.js'
import { findOne, findAll } from '../../db.js'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import { loadAgencyMfaPolicy } from './mfa-policy-routes.js'
import logger from '../logger.js'

const ACTIVE_TRANSFER_STATUSES = new Set(['pending', 'executed'])

function serializeAgency(agency) {
  return {
    id: agency.id,
    name: agency.name || null,
    slug: agency.slug || null,
    license_number: agency.license_number || null,
    accepting_applications: Boolean(agency.accepting_applications),
  }
}

export async function buildAgencySettingsOverview(agencyId) {
  const agency = await findOne('agencies', (row) => row.id === agencyId)
  if (!agency) return null

  const [members, applications, transfers, mfaPolicy] = await Promise.all([
    findAll('agency_members', (row) => row.agency_id === agencyId && row.status === 'active'),
    findAll('agency_applications', (row) => row.agency_id === agencyId && row.status === 'pending'),
    findAll('ownership_transfer_requests', (row) => row.agency_id === agencyId && ACTIVE_TRANSFER_STATUSES.has(row.status)),
    loadAgencyMfaPolicy(agencyId),
  ])

  return {
    agency: serializeAgency(agency),
    stats: {
      member_count: members.length,
      pending_applications: applications.length,
      mfa_required: Boolean(mfaPolicy?.required),
      pending_ownership_transfer: transfers.length > 0,
      accepting_applications: Boolean(agency.accepting_applications),
    },
  }
}

export function registerAgencySettingsOverviewRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/agency/settings/overview', auth, async (req, res) => {
    try {
      const memberships = await listUserAgencyMemberships(req.user.id)
      const membership = memberships.find((item) => item.affiliation_mode === 'exclusive')
      if (!membership) return res.status(403).json({ error: 'Active agency membership required' })

      const overview = await buildAgencySettingsOverview(membership.agency_id)
      if (!overview) return res.status(404).json({ error: 'Agency not found' })

      res.json({ ...overview, my_role: membership.role })
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'agency settings overview failed')
      res.status(500).json({ error: 'Failed to load agency settings overview' })
    }
  })
}

export { registerAgencySettingsOverviewRoutes as registerRoutes }
