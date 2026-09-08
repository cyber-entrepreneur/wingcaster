/**
 * Capability-gated settings home catalog (BE-BLOCKER-23).
 *
 * Server is the source of truth for which settings groups/items a caller may
 * see. Never trust a client-supplied role — callers pass membership facts
 * loaded from tenant_memberships.
 *
 * `capability_packs` may not exist yet (BE-BLOCKER-29). Treat missing /
 * non-array values as [].
 */

export const SETTINGS_CATALOG = Object.freeze([
  Object.freeze({
    id: 'account',
    label: 'Account',
    items: Object.freeze([
      Object.freeze({
        id: 'profile',
        label: 'Account & profile',
        route: '/settings/account',
        access: 'authenticated',
      }),
    ]),
  }),
  Object.freeze({
    id: 'security',
    label: 'Security',
    items: Object.freeze([
      Object.freeze({
        id: 'two_factor',
        label: 'Two-factor authentication',
        route: '/settings/2fa',
        access: 'authenticated',
      }),
      Object.freeze({
        id: 'sessions',
        label: 'Sessions & devices',
        route: '/settings/sessions',
        access: 'authenticated',
      }),
    ]),
  }),
  Object.freeze({
    id: 'billing',
    label: 'Billing & notifications',
    items: Object.freeze([
      Object.freeze({
        id: 'billing_notifications',
        label: 'Billing notifications',
        route: '/settings/notifications/billing',
        access: 'billing',
      }),
      Object.freeze({
        id: 'subscription',
        label: 'Subscription & plans',
        route: '/settings/billing',
        access: 'billing',
      }),
    ]),
  }),
  Object.freeze({
    id: 'team',
    label: 'Team & tenants',
    items: Object.freeze([
      Object.freeze({
        id: 'members',
        label: 'Team members',
        route: '/agency/members',
        access: 'team',
      }),
      Object.freeze({
        id: 'roles',
        label: 'Roles & permissions',
        route: '/agency/settings/roles',
        access: 'team',
      }),
    ]),
  }),
  Object.freeze({
    id: 'danger',
    label: 'Danger zone',
    items: Object.freeze([
      Object.freeze({
        id: 'delete_account',
        label: 'Delete account',
        route: '/settings/delete-account',
        access: 'account_owner',
      }),
    ]),
  }),
])

/**
 * Normalize capability_packs from a membership row.
 * Column may be absent until BE-BLOCKER-29 lands.
 */
export function normalizeCapabilityPacks(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((pack) => (typeof pack === 'string' ? pack.trim() : ''))
    .filter(Boolean)
}

/**
 * Derive gating flags from active tenant_memberships rows.
 *
 * - account_owner: personal workspace owner (every normal account)
 * - team: agency owner/admin
 * - billing: personal owner, agency owner/admin, or finance capability pack
 */
export function resolveSettingsCapabilities(memberships = []) {
  const active = (memberships || []).filter((m) => !m?.status || m.status === 'active')
  const capability_packs = []
  let isAccountOwner = false
  let canManageTeam = false
  let canManageBilling = false
  /** Highest-privilege agency role seen (for diagnostics / tests). */
  let primaryRole = null

  for (const membership of active) {
    const role = membership.role || null
    const packs = normalizeCapabilityPacks(membership.capability_packs)
    for (const pack of packs) {
      if (!capability_packs.includes(pack)) capability_packs.push(pack)
    }

    const isPersonal = membership.affiliation_mode === 'personal'
      || String(membership.tenant_id || '').startsWith('personal:')

    if (isPersonal && role === 'owner') {
      isAccountOwner = true
      canManageBilling = true
      if (!primaryRole) primaryRole = role
    }

    if (!isPersonal && (role === 'owner' || role === 'admin')) {
      canManageTeam = true
      canManageBilling = true
      primaryRole = role
    } else if (!isPersonal && role && !primaryRole) {
      primaryRole = role
    }

    if (packs.includes('finance')) {
      canManageBilling = true
    }
  }

  // No membership rows yet (legacy / mid-migration) — still allow self-serve
  // account + security + danger + personal billing, never team admin.
  if (active.length === 0) {
    isAccountOwner = true
    canManageBilling = true
    primaryRole = 'owner'
  }

  return {
    role: primaryRole,
    capability_packs,
    isAccountOwner,
    canManageTeam,
    canManageBilling,
  }
}

function maySeeItem(access, caps) {
  switch (access) {
    case 'authenticated':
      return true
    case 'billing':
      return Boolean(caps.canManageBilling)
    case 'team':
      return Boolean(caps.canManageTeam)
    case 'account_owner':
      return Boolean(caps.isAccountOwner)
    default:
      return false
  }
}

/**
 * Build the settings index response for a caller.
 *
 * @param {{ memberships?: Array<object>, capabilities?: object }} input
 * @returns {{ groups: Array<{ id: string, label: string, items: Array<{id,label,route}> }> }}
 */
export function buildSettingsIndex({ memberships, capabilities } = {}) {
  const caps = capabilities || resolveSettingsCapabilities(memberships)
  const groups = []

  for (const group of SETTINGS_CATALOG) {
    const items = group.items
      .filter((item) => maySeeItem(item.access, caps))
      .map(({ id, label, route }) => ({ id, label, route }))
    if (items.length === 0) continue
    groups.push({ id: group.id, label: group.label, items })
  }

  return { groups }
}
