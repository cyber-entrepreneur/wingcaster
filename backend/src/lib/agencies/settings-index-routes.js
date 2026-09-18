/**
 * AGN-SET-001 — Agency settings home index.
 *
 *   GET /api/agency/settings/index — owner/admin read; capability-gated menu
 */

import { authMiddleware } from '../../auth.js'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

export const AGENCY_SETTINGS_CATALOG = Object.freeze([
  Object.freeze({
    id: 'identity',
    label: 'Agency identity',
    label_key: 'agency.settings.groups.identity',
    items: Object.freeze([
      Object.freeze({
        id: 'branding',
        label: 'Brand & appearance',
        label_key: 'agency.settings.items.branding',
        route: '/white-label',
        icon: 'palette',
        min_role: 'admin',
      }),
      Object.freeze({
        id: 'widgets',
        label: 'Embeddable widgets',
        label_key: 'agency.settings.items.widgets',
        route: '/widgets',
        icon: 'layout-grid',
        min_role: 'admin',
      }),
    ]),
  }),
  Object.freeze({
    id: 'access',
    label: 'Access & roles',
    label_key: 'agency.settings.groups.access',
    items: Object.freeze([
      Object.freeze({
        id: 'roles',
        label: 'Roles & permissions',
        label_key: 'agency.settings.items.roles',
        route: '/agency/settings/roles',
        icon: 'shield-check',
        min_role: 'admin',
      }),
      Object.freeze({
        id: 'security',
        label: 'Security policy',
        label_key: 'agency.settings.items.security',
        route: '/agency/settings/security',
        icon: 'shield',
        min_role: 'admin',
      }),
      Object.freeze({
        id: 'audit',
        label: 'Audit log',
        label_key: 'agency.settings.items.audit',
        route: '/agency/settings/audit',
        icon: 'scroll-text',
        min_role: 'admin',
      }),
    ]),
  }),
  Object.freeze({
    id: 'publishing',
    label: 'Publishing & integrations',
    label_key: 'agency.settings.groups.publishing',
    items: Object.freeze([
      Object.freeze({
        id: 'integrations',
        label: 'Integrations',
        label_key: 'agency.settings.items.integrations',
        route: '/integrations',
        icon: 'plug',
        min_role: 'admin',
      }),
      Object.freeze({
        id: 'members',
        label: 'Team members',
        label_key: 'agency.settings.items.members',
        route: '/agency',
        icon: 'users',
        min_role: 'admin',
      }),
    ]),
  }),
  Object.freeze({
    id: 'ownership',
    label: 'Ownership',
    label_key: 'agency.settings.groups.ownership',
    items: Object.freeze([
      Object.freeze({
        id: 'ownership_transfer',
        label: 'Transfer ownership',
        label_key: 'agency.settings.items.ownership_transfer',
        route: '/agency/settings/ownership-transfer',
        icon: 'arrow-right-left',
        min_role: 'owner',
      }),
    ]),
  }),
])

function roleRank(role) {
  if (role === 'owner') return 2
  if (role === 'admin') return 1
  return 0
}

export function buildAgencySettingsIndex({ role, agencyId }) {
  const rank = roleRank(role)
  const groups = AGENCY_SETTINGS_CATALOG
    .map((group) => ({
      id: group.id,
      label: group.label,
      label_key: group.label_key,
      items: group.items
        .filter((item) => rank >= roleRank(item.min_role))
        .map(({ min_role, ...item }) => item),
    }))
    .filter((group) => group.items.length > 0)

  return {
    agency_id: agencyId,
    role,
    groups,
    capabilities: {
      can_manage_team: rank >= roleRank('admin'),
      can_transfer_ownership: role === 'owner',
    },
  }
}

async function resolveAgencyAdmin(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  const membership = memberships.find((item) => ADMIN_ROLES.has(item.role))
  if (!membership) {
    return { ok: false, status: 403, error: 'Forbidden: agency owner or admin required' }
  }
  return {
    ok: true,
    agencyId: membership.agency_id,
    role: membership.role,
  }
}

export function registerAgencySettingsIndexRoutes(app) {
  app.get('/api/agency/settings/index', authMiddleware, async (req, res) => {
    try {
      const gate = await resolveAgencyAdmin(req.user.id)
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
      res.json(buildAgencySettingsIndex({ role: gate.role, agencyId: gate.agencyId }))
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to load agency settings index' })
    }
  })
}
