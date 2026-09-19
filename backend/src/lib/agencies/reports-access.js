/**
 * Agency reports access gates (AGN-REP-*).
 */

import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import { packsFromMembership } from '../settings/index-route.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])
const REPORTS_VIEW_PACKS = new Set(['finance', 'read_only', 'marketer'])
const CUSTOM_REPORT_WRITE_PACKS = new Set(['finance'])

export function membershipCanViewReports(membership) {
  if (!membership) return false
  if (ADMIN_ROLES.has(membership.role)) return true
  if (membership.role === 'guest') return false
  const packs = packsFromMembership(membership)
  return packs.some((pack) => REPORTS_VIEW_PACKS.has(pack))
}

export function membershipCanManageCustomReports(membership) {
  if (!membership) return false
  if (ADMIN_ROLES.has(membership.role)) return true
  if (membership.role === 'guest') return false
  const packs = packsFromMembership(membership)
  return packs.some((pack) => CUSTOM_REPORT_WRITE_PACKS.has(pack))
}

export async function resolveCallerAgencyMembership(user) {
  const memberships = await listUserAgencyMemberships(user.id)
  if (!memberships.length) return null

  const activeTenantId = user.active_tenant_id || null
  if (activeTenantId && String(activeTenantId).startsWith('agency:')) {
    const match = memberships.find((m) => m.tenant_id === activeTenantId)
    if (match) return match
  }

  const admin = memberships.find((m) => ADMIN_ROLES.has(m.role))
  if (admin) return admin
  return memberships.find((m) => membershipCanViewReports(m)) || null
}

export async function requireAgencyReportsRead(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const membership = await resolveCallerAgencyMembership(req.user)
    if (!membership?.agency_id || !membershipCanViewReports(membership)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.agencyId = membership.agency_id
    req.membership = membership
    next()
  } catch (err) {
    next(err)
  }
}

export async function requireAgencyCustomReportsWrite(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const membership = await resolveCallerAgencyMembership(req.user)
    if (!membership?.agency_id || !membershipCanManageCustomReports(membership)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.agencyId = membership.agency_id
    req.membership = membership
    next()
  } catch (err) {
    next(err)
  }
}
