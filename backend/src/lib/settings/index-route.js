/**
 * GET /api/settings/index — capability-gated settings home menu (BE-BLOCKER-23).
 *
 * Server is the source of truth for which settings groups/items a caller may
 * see. Never trust a client-supplied role. `capability_packs` on
 * tenant_memberships may not exist yet (BE-BLOCKER-29); treat missing/null as [].
 *
 * Wave 0.5 minimum shape (`groups[].id/label/items[].id/label/route`) plus
 * SHR-SET-001 extras (`capabilities`, item `icon`/`badge`/`label_key`).
 */

import { findAll } from '../../db.js'
import { findUserById } from '../../identity.js'
import logger from '../logger.js'

const PG_UNDEFINED_COLUMN = '42703'
const PG_UNDEFINED_TABLE = '42P01'

export const FALLBACK_GROUP_IDS = Object.freeze(['account', 'security', 'danger'])

export const SETTINGS_CATALOG = Object.freeze([
  Object.freeze({
    id: 'account',
    label: 'Account',
    label_key: 'settings.groups.account',
    items: Object.freeze([
      Object.freeze({
        id: 'profile',
        label: 'Account & profile',
        label_key: 'settings.items.profile',
        route: '/settings/account',
        icon: 'user',
        access: 'authenticated',
      }),
    ]),
  }),
  Object.freeze({
    id: 'security',
    label: 'Security',
    label_key: 'settings.groups.security',
    items: Object.freeze([
      Object.freeze({
        id: 'password',
        label: 'Password',
        label_key: 'settings.items.password',
        route: '/settings/password',
        icon: 'key-round',
        access: 'password',
      }),
      Object.freeze({
        id: 'two_factor',
        label: 'Two-factor authentication',
        label_key: 'settings.items.two_factor',
        route: '/settings/2fa',
        icon: 'shield',
        access: 'authenticated',
      }),
      Object.freeze({
        id: 'sessions',
        label: 'Sessions & devices',
        label_key: 'settings.items.sessions',
        route: '/settings/sessions',
        icon: 'monitor',
        access: 'authenticated',
      }),
    ]),
  }),
  Object.freeze({
    id: 'billing',
    label: 'Billing & notifications',
    label_key: 'settings.groups.billing',
    items: Object.freeze([
      Object.freeze({
        id: 'billing_notifications',
        label: 'Billing notifications',
        label_key: 'settings.items.billing_notifications',
        route: '/settings/notifications/billing',
        icon: 'bell',
        access: 'billing',
      }),
      Object.freeze({
        id: 'subscription',
        label: 'Subscription & plans',
        label_key: 'settings.items.subscription',
        route: '/settings/billing',
        icon: 'credit-card',
        access: 'billing',
      }),
    ]),
  }),
  Object.freeze({
    id: 'team',
    label: 'Team & tenants',
    label_key: 'settings.groups.team',
    items: Object.freeze([
      Object.freeze({
        id: 'members',
        label: 'Team members',
        label_key: 'settings.items.members',
        route: '/agency/members',
        icon: 'users',
        access: 'team',
      }),
      Object.freeze({
        id: 'roles',
        label: 'Roles & permissions',
        label_key: 'settings.items.roles',
        route: '/agency/settings/roles',
        icon: 'shield-check',
        access: 'team',
      }),
    ]),
  }),
  Object.freeze({
    id: 'danger',
    label: 'Danger zone',
    label_key: 'settings.groups.danger',
    items: Object.freeze([
      Object.freeze({
        id: 'delete_account',
        label: 'Delete account',
        label_key: 'settings.items.delete_account',
        route: '/settings/delete-account',
        icon: 'trash-2',
        access: 'authenticated',
      }),
    ]),
  }),
])

function isMissingRelationOrColumn(err) {
  return err?.code === PG_UNDEFINED_COLUMN || err?.code === PG_UNDEFINED_TABLE
}

function isAgencyMembership(membership) {
  if (!membership) return false
  if (membership.affiliation_mode === 'personal') return false
  return String(membership.tenant_id || '').startsWith('agency:')
    || (membership.affiliation_mode && membership.affiliation_mode !== 'personal')
}

function isPersonalMembership(membership) {
  if (!membership) return false
  if (membership.affiliation_mode === 'personal') return true
  return String(membership.tenant_id || '').startsWith('personal:')
}

/**
 * Normalize capability_packs from a membership row.
 * Column may be absent until BE-BLOCKER-29 lands.
 */
export function normalizeCapabilityPacks(value) {
  if (value == null || value === '') return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeCapabilityPacks(JSON.parse(trimmed))
      } catch {
        return []
      }
    }
    return [trimmed]
  }
  if (Array.isArray(value)) {
    return value
      .map((pack) => (typeof pack === 'string' ? pack.trim() : ''))
      .filter(Boolean)
  }
  if (typeof value === 'object' && typeof value.pack === 'string' && value.pack.trim()) {
    return [value.pack.trim()]
  }
  return []
}

export function packsFromMembership(membership) {
  const fromColumn = normalizeCapabilityPacks(membership?.capability_packs)
  if (fromColumn.length) return fromColumn
  return normalizeCapabilityPacks(membership?.capabilities)
}

/**
 * OAuth-only users have no local password. `password_hash` present-and-empty
 * (or explicitly null on a hydrated user row) means hide the password item.
 * JWT principals typically omit the field — that is "unknown", not oauth-only.
 */
export function isOauthOnlyUser(user) {
  if (!user) return false
  if (user.oauth_only === true || user.data?.oauth_only === true) return true
  const provider = user.auth_provider || user.data?.auth_provider
  if (provider && provider !== 'password' && provider !== 'email') {
    if (!user.password_hash) return true
  }
  if (Object.prototype.hasOwnProperty.call(user, 'password_hash')) {
    return !user.password_hash
  }
  return false
}

/**
 * Derive gating flags from active tenant_memberships rows + the caller.
 *
 * Visibility (Wave 0.5):
 * - Everyone authenticated: Account, Security, Danger zone.
 * - Hide password item if oauth-only.
 * - Billing: include unless we can prove the caller has none (guest-only).
 * - Team: agency owner/admin only (not solo agent / member / guest).
 */
export function resolveSettingsCapabilities({ memberships = [], user } = {}) {
  const active = (memberships || []).filter((m) => !m?.status || m.status === 'active')
  const capability_packs = []
  let canManageTeam = false
  let primaryRole = null
  let guestOnly = active.length > 0

  for (const membership of active) {
    const role = membership.role || null
    const packs = packsFromMembership(membership)
    for (const pack of packs) {
      if (!capability_packs.includes(pack)) capability_packs.push(pack)
    }

    if (role !== 'guest') guestOnly = false

    if (isAgencyMembership(membership) && (role === 'owner' || role === 'admin')) {
      canManageTeam = true
      primaryRole = role
    } else if (isPersonalMembership(membership) && role === 'owner') {
      if (!primaryRole) primaryRole = role
    } else if (role && !primaryRole) {
      primaryRole = role
    }
  }

  if (active.length === 0) {
    primaryRole = user?.role || 'agent'
    guestOnly = false
  }

  const oauthOnly = isOauthOnlyUser(user)
  // Guests with no other membership are the only case we can prove have no billing.
  const canSeeBilling = !guestOnly

  return {
    role: primaryRole,
    capability_packs,
    canManageTeam,
    canSeeBilling,
    hasPassword: !oauthOnly,
    oauthOnly,
  }
}

function publicCapabilities(caps) {
  return {
    account: true,
    security: true,
    billing: Boolean(caps.canSeeBilling),
    team: Boolean(caps.canManageTeam),
    danger: true,
    password: Boolean(caps.hasPassword),
  }
}

function maySeeItem(access, caps) {
  switch (access) {
    case 'authenticated':
      return true
    case 'password':
      return Boolean(caps.hasPassword)
    case 'billing':
      return Boolean(caps.canSeeBilling)
    case 'team':
      return Boolean(caps.canManageTeam)
    default:
      return false
  }
}

function publicItem(item) {
  return {
    id: item.id,
    label: item.label,
    label_key: item.label_key,
    route: item.route,
    icon: item.icon,
    badge: item.badge ?? null,
  }
}

function publicGroup(group, items) {
  return {
    id: group.id,
    label: group.label,
    label_key: group.label_key,
    items,
  }
}

/**
 * Build the settings index response for a caller.
 *
 * @param {{ memberships?: object[], user?: object, fallback?: boolean, capabilities?: object }} input
 */
export function buildSettingsIndex({ memberships, user, fallback = false, capabilities } = {}) {
  const caps = fallback
    ? {
      canManageTeam: false,
      canSeeBilling: false,
      hasPassword: !isOauthOnlyUser(user),
      oauthOnly: isOauthOnlyUser(user),
      capability_packs: [],
      role: null,
    }
    : (capabilities || resolveSettingsCapabilities({ memberships, user }))

  const allowedGroupIds = fallback ? new Set(FALLBACK_GROUP_IDS) : null
  const groups = []

  for (const group of SETTINGS_CATALOG) {
    if (allowedGroupIds && !allowedGroupIds.has(group.id)) continue
    const items = group.items
      .filter((item) => maySeeItem(item.access, caps))
      .map(publicItem)
    if (items.length === 0) continue
    groups.push(publicGroup(group, items))
  }

  return {
    capabilities: publicCapabilities(caps),
    groups,
  }
}

export async function defaultLoadCallerContext(req) {
  const userId = req.user.id
  let user = req.user
  try {
    const loaded = await findUserById(userId)
    if (loaded) user = loaded
  } catch (err) {
    if (!isMissingRelationOrColumn(err)) throw err
  }

  let memberships = []
  try {
    memberships = await findAll(
      'tenant_memberships',
      (membership) => membership.user_id === userId && membership.status === 'active',
    )
  } catch (err) {
    if (!isMissingRelationOrColumn(err)) throw err
  }

  return { user, memberships }
}

/**
 * Register GET /api/settings/index.
 *
 * @param {import('express').Application} app
 * @param {{ authMiddleware: Function, loadCallerContext?: Function }} deps
 */
export function registerRoutes(app, { authMiddleware, loadCallerContext } = {}) {
  if (!authMiddleware) {
    throw new Error('registerRoutes requires authMiddleware')
  }
  const loadContext = loadCallerContext || defaultLoadCallerContext

  app.get('/api/settings/index', authMiddleware, async (req, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const context = await loadContext(req)
      return res.json(buildSettingsIndex(context))
    } catch (err) {
      logger.error(
        { err: err.message, user_id: req.user?.id },
        'settings index capability lookup failed; returning fallback menu',
      )
      return res.json(buildSettingsIndex({ fallback: true, user: req.user }))
    }
  })
}
