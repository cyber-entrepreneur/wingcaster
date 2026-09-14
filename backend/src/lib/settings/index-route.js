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

import { findAll, query } from '../../db.js'
import { findUserById } from '../../identity.js'
import logger from '../logger.js'

const PG_UNDEFINED_COLUMN = '42703'
const PG_UNDEFINED_TABLE = '42P01'

function isMissingRelationOrColumn(err) {
  const code = err?.code
  return code === PG_UNDEFINED_TABLE || code === PG_UNDEFINED_COLUMN
}

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
        route: '/settings/notifications',
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
        route: '/settings/danger/delete-account',
        icon: 'trash-2',
        access: 'authenticated',
      }),
    ]),
  }),
])

function isDegradableLookupError(err) {
  if (isMissingRelationOrColumn(err)) return true
  const message = String(err?.message || '')
  return /DATABASE_URL is required/i.test(message) || err?.code === 'ECONNREFUSED'
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

function publicCapabilities(caps, snapshot = {}) {
  const twoFactorEnrolled = Boolean(snapshot.two_factor_enrolled)
  const sessionCount = Number(snapshot.active_session_count || 0)
  return {
    account: true,
    danger: true,
    password: Boolean(caps.hasPassword),
    identity: {
      oauth_only: Boolean(caps.oauthOnly),
      signin_method: snapshot.signin_method || (caps.oauthOnly ? 'oauth' : 'email'),
    },
    security: {
      two_factor_enrolled: twoFactorEnrolled,
      active_session_count: Number.isFinite(sessionCount) ? sessionCount : 0,
    },
    billing: caps.canSeeBilling
      ? {
        plan: snapshot.plan || null,
        past_due: Boolean(snapshot.past_due),
        display_name: snapshot.display_name || null,
        renews_at: snapshot.renews_at || null,
      }
      : false,
    team: caps.canManageTeam
      ? {
        role: caps.role || 'admin',
        member_count: snapshot.member_count ?? null,
        pending_invite_count: snapshot.pending_invite_count ?? 0,
      }
      : false,
    env: snapshot.env || 'live',
  }
}

function applyItemBadges(item, snapshot = {}) {
  if (item.id === 'two_factor' && !snapshot.two_factor_enrolled) {
    return {
      ...item,
      badge: { kind: 'status', tone: 'warning', label_key: 'badge.2faOff' },
    }
  }
  if (item.id === 'sessions' && Number(snapshot.active_session_count) > 1) {
    return {
      ...item,
      badge: { kind: 'count', value: Number(snapshot.active_session_count) },
    }
  }
  if (item.id === 'subscription' && snapshot.past_due) {
    return {
      ...item,
      badge: { kind: 'status', tone: 'danger', label_key: 'badge.pastDue' },
    }
  }
  return item
}

/**
 * Best-effort extras for the SHR-SET-001 capabilities contract.
 * Missing tables (sessions BE, tenant_subscriptions) degrade to zeros/nulls.
 */
export async function loadSettingsSnapshot({ user, memberships = [], tenantId } = {}) {
  const snapshot = {
    two_factor_enrolled: Boolean(user?.totp_enabled || user?.data?.totp_enabled),
    active_session_count: 0,
    signin_method: user?.auth_provider && user.auth_provider !== 'password' && user.auth_provider !== 'email'
      ? String(user.auth_provider)
      : 'email',
    env: 'live',
  }

  if (user?.id) {
    try {
      const rows = await query(
        `SELECT COUNT(*)::int AS n
           FROM user_sessions
          WHERE user_id = $1
            AND revoked_at IS NULL`,
        [user.id],
      )
      snapshot.active_session_count = Number(rows?.[0]?.n || 0)
    } catch (err) {
      if (!isDegradableLookupError(err)) {
        logger.warn({ err: err.message, user_id: user.id }, 'settings index session count lookup failed')
      }
    }
  }

  const activeTenantId = tenantId
    || memberships.find((m) => m?.status === 'active' && m.tenant_id)?.tenant_id
    || null
  if (activeTenantId) {
    try {
      const rows = await query(
        `SELECT p.code AS package_code, p.display_name, s.status, s.billing_cycle_end
           FROM public.tenant_subscriptions s
           JOIN public.product_package_versions v ON v.id = s.package_version_id
           JOIN public.product_packages p ON p.id = v.package_id
          WHERE s.tenant_id = $1
          ORDER BY s.created_at DESC
          LIMIT 1`,
        [activeTenantId],
      )
      const row = rows?.[0]
      if (row) {
        snapshot.plan = row.package_code || null
        snapshot.display_name = row.display_name || row.package_code || null
        snapshot.renews_at = row.billing_cycle_end || null
        snapshot.past_due = String(row.status || '').toLowerCase() === 'past_due'
      }
    } catch (err) {
      if (!isDegradableLookupError(err)) {
        logger.warn({ err: err.message, tenant_id: activeTenantId }, 'settings index billing snapshot lookup failed')
      }
    }
  }

  return snapshot
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
 * @param {{ memberships?: object[], user?: object, fallback?: boolean, capabilities?: object, snapshot?: object }} input
 */
export function buildSettingsIndex({ memberships, user, fallback = false, capabilities, snapshot } = {}) {
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

  const extras = {
    two_factor_enrolled: Boolean(user?.totp_enabled || user?.data?.totp_enabled),
    active_session_count: 0,
    signin_method: 'email',
    env: 'live',
    ...(snapshot || {}),
  }

  const allowedGroupIds = fallback ? new Set(FALLBACK_GROUP_IDS) : null
  const groups = []

  for (const group of SETTINGS_CATALOG) {
    if (allowedGroupIds && !allowedGroupIds.has(group.id)) continue
    const items = group.items
      .filter((item) => maySeeItem(item.access, caps))
      .map(publicItem)
      .map((item) => applyItemBadges(item, extras))
    if (items.length === 0) continue
    groups.push(publicGroup(group, items))
  }

  return {
    capabilities: publicCapabilities(caps, extras),
    groups,
    recent_activity: Array.isArray(snapshot?.recent_activity) ? snapshot.recent_activity : [],
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
      const snapshot = await loadSettingsSnapshot({
        ...context,
        tenantId: req.tenant?.creditTenantId || req.tenantId || null,
      })
      return res.json(buildSettingsIndex({ ...context, snapshot }))
    } catch (err) {
      logger.error(
        { err: err.message, user_id: req.user?.id },
        'settings index capability lookup failed; returning fallback menu',
      )
      return res.json(buildSettingsIndex({ fallback: true, user: req.user }))
    }
  })
}
