/**
 * Wave 0 nav-chrome backend routes.
 *
 * Mounted from server.js via registerWave0NavRoutes(app, deps).
 * Covers tenant switcher, locale prefs, notifications popover, global search,
 * PA env switch, and login OAuth (google / apple / facebook).
 */

import { randomUUID, createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { findAll, findOne, insert, update } from '../db.js'
import {
  findAgentForUser,
  findUserByEmail,
  findUserById,
  updateUser,
} from '../identity.js'
import { personalTenantId } from '../tenant-authorization.js'
import { validate } from './validation.js'
import {
  fromAnyEnv,
  normalizeClientEnv,
  toFinEnvironment,
} from './session-env.js'

const OAUTH_PROVIDERS = Object.freeze(['google', 'apple', 'facebook'])

const switchTenantSchema = z.object({
  tenantId: z.string().min(1).max(200),
})

const patchMeSchema = z.object({
  preferred_locale: z.enum(['en', 'ar']).optional(),
  /** Per-tenant UI density mode — stored on tenant_memberships.data.ui_mode (D-S-06 / AGT-SET-002). */
  ui_mode: z.enum(['guided', 'pro']).optional(),
}).refine((body) => Object.keys(body).length > 0, {
  message: 'At least one field is required',
})

function membershipDataBag(row) {
  const raw = row?.data
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
}

function normalizeUiMode(value) {
  return value === 'pro' ? 'pro' : 'guided'
}

/**
 * Write ui_mode into the acting tenant membership's JSONB `data` column.
 * Preference is per-tenant-context, not a new column and not per-user global.
 */
async function persistMembershipUiMode(userId, uiMode) {
  const user = await findUserById(userId)
  if (!user) return null
  const tenantId = await resolveActiveTenantId(user)
  const membership = await findOne(
    'tenant_memberships',
    (row) => row.user_id === userId && row.tenant_id === tenantId && row.status === 'active',
  )
  if (!membership) return null

  const nextData = {
    ...membershipDataBag(membership),
    ui_mode: normalizeUiMode(uiMode),
  }
  const now = new Date().toISOString()
  await update(
    'tenant_memberships',
    (row) => row.id === membership.id,
    (row) => ({
      ...row,
      data: nextData,
      updated_at: now,
    }),
  )
  return {
    tenant_id: tenantId,
    data: nextData,
    updated_at: now,
  }
}

const searchSchema = z.object({
  query: z.string().min(1).max(200),
  persona: z.enum(['agent', 'agency', 'pa']),
})

const envSwitchSchema = z.object({
  target: z.enum(['live', 'test']),
})

const oauthStartSchema = z.object({
  redirect_uri: z.string().url().optional(),
  return_to: z.string().max(500).optional(),
})

const oauthCallbackSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(200),
  id_token: z.string().max(8192).optional(),
  user: z.record(z.any()).optional(),
})

function includesQuery(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(needle)
}

function notificationIcon(type, metadata = {}) {
  if (metadata?.icon) return String(metadata.icon)
  if (type === 'billing') return 'credit-card'
  if (type === 'workflow') return 'git-branch'
  if (type === 'system') return 'bell'
  return 'inbox'
}

function serializeNotification(row) {
  return {
    id: row.id,
    title: row.title || 'Notification',
    snippet: row.body || row.metadata?.snippet || '',
    timestamp: row.created_at || row.updated_at || null,
    unread: row.read !== true,
    icon: notificationIcon(row.type, row.metadata || {}),
  }
}

async function countTenantListings(tenantId) {
  const rows = await findAll(
    'properties',
    (property) => property.tenant_id === tenantId || property.custody_tenant_id === tenantId,
  )
  return rows.length
}

async function countTenantAgents(tenant) {
  if (!tenant) return 0
  if (tenant.tenant_type === 'personal') return 1
  const memberships = await findAll(
    'tenant_memberships',
    (membership) => membership.tenant_id === tenant.id && membership.status === 'active',
  )
  return memberships.length
}

async function resolveActiveTenantId(user) {
  const preferred = user.active_tenant_id || null
  if (preferred) {
    const membership = await findOne(
      'tenant_memberships',
      (row) => row.user_id === user.id && row.tenant_id === preferred && row.status === 'active',
    )
    if (membership) return preferred
  }
  return personalTenantId(user.id)
}

export async function listAccessibleTenants(userId) {
  const user = await findUserById(userId)
  if (!user) return { tenants: [], activeTenantId: null }

  const memberships = await findAll(
    'tenant_memberships',
    (membership) => membership.user_id === userId && membership.status === 'active',
  )
  const tenants = await findAll('tenants')
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]))
  const activeTenantId = await resolveActiveTenantId(user)

  const items = []
  for (const membership of memberships) {
    const tenant = tenantById.get(membership.tenant_id)
    if (!tenant || tenant.status === 'closed') continue
    const [listingsCount, agentsCount] = await Promise.all([
      countTenantListings(tenant.id),
      countTenantAgents(tenant),
    ])
    const dataBag = membershipDataBag(membership)
    items.push({
      id: tenant.id,
      name: tenant.name,
      avatarUrl: tenant.settings?.avatar_url || tenant.data?.avatar_url || null,
      role: membership.role,
      listingsCount,
      agentsCount,
      isActive: tenant.id === activeTenantId,
      tenantType: tenant.tenant_type,
      uiMode: normalizeUiMode(dataBag.ui_mode),
    })
  }

  items.sort((a, b) => {
    if (a.tenantType === 'personal' && b.tenantType !== 'personal') return -1
    if (b.tenantType === 'personal' && a.tenantType !== 'personal') return 1
    return String(a.name).localeCompare(String(b.name))
  })

  return {
    tenants: items.map(({ tenantType, ...rest }) => rest),
    activeTenantId,
  }
}

export async function findUserByPhone(phone) {
  const normalized = String(phone || '').trim()
  if (!normalized) return null
  const digits = normalized.replace(/\D/g, '')
  return findOne('users', (user) => {
    const candidate = String(user.phone || '').trim()
    if (!candidate) return false
    if (candidate === normalized) return true
    return digits && candidate.replace(/\D/g, '') === digits
  })
}

export async function findUserByUsername(username) {
  const needle = String(username || '').trim().toLowerCase()
  if (!needle) return null

  const byColumn = await findOne(
    'users',
    (user) => String(user.username || '').trim().toLowerCase() === needle,
  )
  if (byColumn) return byColumn

  const byData = await findOne(
    'users',
    (user) => String(user.data?.username || '').trim().toLowerCase() === needle,
  )
  if (byData) return byData

  const agent = await findOne(
    'agents',
    (row) => String(row.slug || '').trim().toLowerCase() === needle,
  )
  if (agent?.user_id) return findUserById(agent.user_id)
  return null
}

export async function resolveLoginUser({ identifier_type, identifier, email }) {
  if (identifier_type && identifier) {
    const value = String(identifier).trim()
    if (identifier_type === 'email') return findUserByEmail(value.toLowerCase())
    if (identifier_type === 'phone') return findUserByPhone(value)
    if (identifier_type === 'username') return findUserByUsername(value)
    return null
  }
  if (email) return findUserByEmail(email)
  return null
}

function oauthProviderConfig(provider) {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
      userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    }
  }
  if (provider === 'apple') {
    return {
      clientId: process.env.APPLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.APPLE_OAUTH_CLIENT_SECRET || '',
      authUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      scope: 'name email',
      userInfoUrl: null,
    }
  }
  if (provider === 'facebook') {
    return {
      clientId: process.env.FACEBOOK_OAUTH_CLIENT_ID || process.env.FACEBOOK_APP_ID || '',
      clientSecret: process.env.FACEBOOK_OAUTH_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || '',
      authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
      scope: 'email,public_profile',
      userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email',
    }
  }
  return null
}

function defaultOAuthRedirect(req, provider) {
  const base = process.env.APP_PUBLIC_URL
    || process.env.WEB_APP_URL
    || `${req.protocol}://${req.get('host')}`
  return `${String(base).replace(/\/$/, '')}/auth/oauth/${provider}/callback`
}

async function persistOAuthState({ provider, redirectUri, returnTo, userId = null }) {
  const state = randomUUID()
  await insert('oauth_states', {
    id: state,
    agent_id: userId,
    platform: `login:${provider}`,
    redirect_uri: redirectUri,
    return_to: returnTo || null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
  return state
}

async function consumeOAuthState(state, provider) {
  const row = await findOne('oauth_states', (candidate) => candidate.id === state)
  if (!row || row.platform !== `login:${provider}`) return null
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await update('oauth_states', (candidate) => candidate.id === state, () => ({ ...row, consumed: true }))
    return null
  }
  await update('oauth_states', (candidate) => candidate.id === state, (current) => ({
    ...current,
    consumed: true,
    consumed_at: new Date().toISOString(),
  }))
  return row
}

async function upsertOAuthIdentity({ provider, providerUserId, userId, email, profile }) {
  const existing = await findOne(
    'auth_oauth_identities',
    (row) => row.provider === provider && row.provider_user_id === String(providerUserId),
  )
  const now = new Date().toISOString()
  if (existing) {
    await update('auth_oauth_identities', (row) => row.id === existing.id, (row) => ({
      ...row,
      user_id: userId,
      email: email || row.email,
      updated_at: now,
      data: { ...(row.data || {}), profile: profile || row.data?.profile || null },
    }))
    return existing.id
  }
  const id = randomUUID()
  await insert('auth_oauth_identities', {
    id,
    provider,
    provider_user_id: String(providerUserId),
    user_id: userId,
    email: email || null,
    created_at: now,
    updated_at: now,
    data: { profile: profile || null },
  })
  return id
}

async function findUserForOAuthProfile({ provider, providerUserId, email }) {
  const linked = await findOne(
    'auth_oauth_identities',
    (row) => row.provider === provider && row.provider_user_id === String(providerUserId),
  )
  if (linked?.user_id) {
    const user = await findUserById(linked.user_id)
    if (user) return user
  }
  if (email) return findUserByEmail(String(email).trim().toLowerCase())
  return null
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split('.')
    if (parts.length < 2) return null
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function exchangeOAuthCode({ provider, code, redirectUri, cfg, idToken }) {
  const allowDev = process.env.NODE_ENV !== 'production' || process.env.OAUTH_DEV_MODE === 'true'
  if (!cfg.clientId || !cfg.clientSecret) {
    if (!allowDev) {
      const err = new Error(`${provider} OAuth is not configured`)
      err.status = 503
      err.code = 'oauth_not_configured'
      throw err
    }
    if (String(code).startsWith('dev_')) {
      const suffix = createHash('sha256').update(code).digest('hex').slice(0, 10)
      return {
        providerUserId: `dev-${provider}-${suffix}`,
        email: `dev-${provider}-${suffix}@oauth.wingcaster.local`,
        name: `Dev ${provider} User`,
        profile: { dev: true, code },
      }
    }
    const err = new Error(`${provider} OAuth is not configured`)
    err.status = 503
    err.code = 'oauth_not_configured'
    throw err
  }

  if (provider === 'apple' && idToken) {
    const payload = decodeJwtPayload(idToken)
    if (!payload?.sub) {
      const err = new Error('Invalid Apple id_token')
      err.status = 400
      throw err
    }
    return {
      providerUserId: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      profile: payload,
    }
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  const tokenJson = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok) {
    const err = new Error(tokenJson.error_description || tokenJson.error || 'OAuth token exchange failed')
    err.status = 401
    err.code = 'oauth_token_exchange_failed'
    throw err
  }

  if (provider === 'apple') {
    const payload = decodeJwtPayload(tokenJson.id_token)
    if (!payload?.sub) {
      const err = new Error('Apple token missing subject')
      err.status = 401
      throw err
    }
    return {
      providerUserId: payload.sub,
      email: payload.email || null,
      name: null,
      profile: payload,
    }
  }

  if (!cfg.userInfoUrl) {
    const err = new Error('OAuth provider missing userinfo endpoint')
    err.status = 500
    throw err
  }

  const accessToken = tokenJson.access_token
  const infoRes = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const info = await infoRes.json().catch(() => ({}))
  if (!infoRes.ok) {
    const err = new Error('Failed to load OAuth profile')
    err.status = 401
    throw err
  }

  return {
    providerUserId: info.sub || info.id,
    email: info.email || null,
    name: info.name || [info.given_name, info.family_name].filter(Boolean).join(' ') || null,
    profile: info,
  }
}

async function scopedSearch({ queryText, persona, user, agent }) {
  const q = String(queryText).trim().toLowerCase()
  const groups = {
    listings: [],
    contacts: [],
    agents: [],
    tenants: [],
    campaigns: [],
  }

  const activeTenantId = await resolveActiveTenantId(user)
  const isPa = persona === 'pa' || user.platform_role === 'platform_admin'

  if (persona === 'agent' || persona === 'agency' || isPa) {
    const properties = await findAll('properties', (property) => {
      if (!includesQuery(property.title, q)
        && !includesQuery(property.city, q)
        && !includesQuery(property.neighborhood, q)
        && !includesQuery(property.address, q)
        && !includesQuery(property.id, q)) {
        return false
      }
      if (isPa && persona === 'pa') return true
      if (persona === 'agency') {
        return property.tenant_id === activeTenantId || property.custody_tenant_id === activeTenantId
      }
      return property.agent_id === user.id
        || property.agent_id === agent?.id
        || property.tenant_id === activeTenantId
        || property.source_user_id === user.id
    })
    groups.listings = properties.slice(0, 20).map((property) => ({
      id: property.id,
      title: property.title || property.address || property.id,
      subtitle: [property.city, property.neighborhood].filter(Boolean).join(' · ') || null,
      href: `/listings/${property.id}`,
    }))
  }

  if (persona === 'agent' || persona === 'agency') {
    const contacts = await findAll('contacts', (contact) => {
      if (!includesQuery(contact.name, q)
        && !includesQuery(contact.email, q)
        && !includesQuery(contact.phone, q)) {
        return false
      }
      if (persona === 'agency') {
        return contact.tenant_id === activeTenantId || contact.agency_id === String(activeTenantId).replace(/^agency:/, '')
      }
      return contact.assigned_agent_id === user.id
        || contact.assigned_agent_id === agent?.id
        || contact.created_by === user.id
        || contact.tenant_id === activeTenantId
    })
    groups.contacts = contacts.slice(0, 20).map((contact) => ({
      id: contact.id,
      title: contact.name || contact.email || contact.phone || contact.id,
      subtitle: contact.email || contact.phone || null,
      href: `/contacts/${contact.id}`,
    }))
  }

  if (persona === 'agency' || persona === 'pa') {
    const agents = await findAll('agents', (row) => (
      includesQuery(row.name, q) || includesQuery(row.email, q) || includesQuery(row.slug, q)
    ))
    const filtered = []
    for (const row of agents) {
      if (persona === 'pa') {
        filtered.push(row)
        continue
      }
      const membership = await findOne(
        'tenant_memberships',
        (m) => m.tenant_id === activeTenantId && m.user_id === row.user_id && m.status === 'active',
      )
      if (membership) filtered.push(row)
    }
    groups.agents = filtered.slice(0, 20).map((row) => ({
      id: row.id,
      title: row.name || row.email,
      subtitle: row.email || null,
      href: persona === 'pa' ? `/admin/agents/${row.id}` : `/agency/members/${row.id}`,
    }))
  }

  if (persona === 'pa') {
    const tenants = await findAll('tenants', (tenant) => (
      includesQuery(tenant.name, q) || includesQuery(tenant.slug, q) || includesQuery(tenant.id, q)
    ))
    groups.tenants = tenants.slice(0, 20).map((tenant) => ({
      id: tenant.id,
      title: tenant.name,
      subtitle: tenant.tenant_type,
      href: `/admin/tenants/${encodeURIComponent(tenant.id)}`,
    }))
  }

  if (persona === 'agent' || persona === 'agency') {
    const campaigns = await findAll('campaigns', (campaign) => {
      if (!includesQuery(campaign.name, q) && !includesQuery(campaign.id, q)) return false
      if (persona === 'agency') return campaign.tenant_id === activeTenantId
      return campaign.agent_id === user.id || campaign.created_by === user.id || campaign.tenant_id === activeTenantId
    })
    groups.campaigns = campaigns.slice(0, 20).map((campaign) => ({
      id: campaign.id,
      title: campaign.name || campaign.id,
      subtitle: campaign.status || null,
      href: `/campaigns/${campaign.id}`,
    }))
  }

  return {
    query: queryText,
    persona,
    groups,
  }
}

/**
 * @param {import('express').Express} app
 * @param {{
 *   authMiddleware: Function,
 *   requirePlatformAdmin: Function,
 *   buildAuthSession: Function,
 *   startSigninChallengeIfRequired?: Function,
 * }} deps
 */
export function registerWave0NavRoutes(app, deps) {
  const {
    authMiddleware,
    requirePlatformAdmin,
    buildAuthSession,
    startSigninChallengeIfRequired,
  } = deps

  if (!authMiddleware) throw new Error('registerWave0NavRoutes requires authMiddleware')
  if (!requirePlatformAdmin) throw new Error('registerWave0NavRoutes requires requirePlatformAdmin')
  if (!buildAuthSession) throw new Error('registerWave0NavRoutes requires buildAuthSession')

  app.get('/api/auth/me/tenants', authMiddleware, async (req, res) => {
    const { tenants } = await listAccessibleTenants(req.user.id)
    res.json({ tenants })
  })

  app.post('/api/auth/switch-tenant', authMiddleware, validate(switchTenantSchema), async (req, res) => {
    const { tenantId } = req.validated
    const membership = await findOne(
      'tenant_memberships',
      (row) => row.user_id === req.user.id && row.tenant_id === tenantId && row.status === 'active',
    )
    if (!membership) return res.status(403).json({ error: 'Not a member of that tenant' })

    const tenant = await findOne('tenants', (row) => row.id === tenantId)
    if (!tenant || tenant.status === 'closed' || tenant.status === 'suspended') {
      return res.status(403).json({ error: 'Tenant is not available' })
    }

    await updateUser(req.user.id, { active_tenant_id: tenantId })
    const user = await findUserById(req.user.id)
    const agent = await findAgentForUser(req.user.id)
    if (!user || !agent) return res.status(401).json({ error: 'Account no longer exists' })

    const session = await buildAuthSession(user, agent, {
      activeTenantId: tenantId,
      env: fromAnyEnv(req.user.env),
    })
    res.json(session)
  })

  app.patch('/api/users/me', authMiddleware, validate(patchMeSchema), async (req, res) => {
    const patch = {}
    if (req.validated.preferred_locale !== undefined) {
      patch.preferred_locale = req.validated.preferred_locale
    }
    const updated = Object.keys(patch).length > 0
      ? await updateUser(req.user.id, patch)
      : await findUserById(req.user.id)
    if (!updated) return res.status(404).json({ error: 'User not found' })

    let tenantMembership = null
    if (req.validated.ui_mode !== undefined) {
      tenantMembership = await persistMembershipUiMode(req.user.id, req.validated.ui_mode)
      if (!tenantMembership) {
        return res.status(404).json({ error: 'Active tenant membership not found' })
      }
    } else {
      const tenantId = await resolveActiveTenantId(updated)
      const membership = await findOne(
        'tenant_memberships',
        (row) => row.user_id === req.user.id && row.tenant_id === tenantId && row.status === 'active',
      )
      if (membership) {
        tenantMembership = {
          tenant_id: tenantId,
          data: membershipDataBag(membership),
          updated_at: membership.updated_at || null,
        }
      }
    }

    const uiMode = normalizeUiMode(tenantMembership?.data?.ui_mode)
    res.json({
      id: updated.id,
      preferred_locale: updated.preferred_locale || 'en',
      active_tenant_id: updated.active_tenant_id || personalTenantId(updated.id),
      ui_mode: uiMode,
      tenant_membership: tenantMembership
        ? {
            tenant_id: tenantMembership.tenant_id,
            data: tenantMembership.data,
          }
        : null,
    })
  })

  app.get('/api/auth/me/notifications', authMiddleware, async (req, res) => {
    const rows = (await findAll('notifications', (n) => n.user_id === req.user.id))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 50)

    // Fallback for older consumer_notifications inbox if the in-app table is empty.
    let source = rows
    if (source.length === 0) {
      source = (await findAll('consumer_notifications', (n) => n.user_id === req.user.id))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 50)
    }

    const notifications = source.map(serializeNotification)
    const unreadCount = notifications.filter((n) => n.unread).length
    res.json({ notifications, unreadCount })
  })

  app.post('/api/auth/me/notifications/mark-all-read', authMiddleware, async (req, res) => {
    const now = new Date().toISOString()
    const inApp = await findAll(
      'notifications',
      (n) => n.user_id === req.user.id && n.read !== true,
    )
    for (const row of inApp) {
      await update('notifications', (n) => n.id === row.id, (n) => ({
        ...n,
        read: true,
        read_at: now,
        updated_at: now,
      }))
    }

    const consumer = await findAll(
      'consumer_notifications',
      (n) => n.user_id === req.user.id && n.read !== true,
    )
    for (const row of consumer) {
      await update('consumer_notifications', (n) => n.id === row.id, (n) => ({
        ...n,
        read: true,
        read_at: now,
        updated_at: now,
      }))
    }

    res.json({ success: true, marked: inApp.length + consumer.length })
  })

  app.post('/api/search', authMiddleware, validate(searchSchema), async (req, res) => {
    const user = await findUserById(req.user.id)
    const agent = await findAgentForUser(req.user.id)
    if (!user || !agent) return res.status(401).json({ error: 'Account no longer exists' })

    if (req.validated.persona === 'pa' && user.platform_role !== 'platform_admin') {
      return res.status(403).json({ error: 'PA search requires platform admin' })
    }

    const result = await scopedSearch({
      queryText: req.validated.query,
      persona: req.validated.persona,
      user,
      agent,
    })
    res.json(result)
  })

  app.post(
    '/api/admin/env/switch',
    authMiddleware,
    requirePlatformAdmin,
    validate(envSwitchSchema),
    async (req, res) => {
      const target = normalizeClientEnv(req.validated.target)
      const user = await findUserById(req.user.id)
      const agent = await findAgentForUser(req.user.id)
      if (!user || !agent) return res.status(401).json({ error: 'Account no longer exists' })

      // Persist last-selected env on the user document for rehydrate hints.
      await updateUser(req.user.id, {
        fin_environment: toFinEnvironment(target),
        env: target,
      })

      const refreshed = await findUserById(req.user.id)
      const session = await buildAuthSession(refreshed, agent, {
        env: target,
        activeTenantId: await resolveActiveTenantId(refreshed),
      })
      req.user = { ...req.user, env: target, fin_environment: toFinEnvironment(target) }
      req.sessionEnv = target
      res.setHeader('X-Wingcaster-Env', target)
      res.json(session)
    },
  )

  app.post('/api/auth/oauth/:provider/start', validate(oauthStartSchema), async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase()
    if (!OAUTH_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Unsupported OAuth provider' })
    }

    const cfg = oauthProviderConfig(provider)
    const redirectUri = req.validated.redirect_uri || defaultOAuthRedirect(req, provider)
    const state = await persistOAuthState({
      provider,
      redirectUri,
      returnTo: req.validated.return_to || null,
    })

    const allowDev = process.env.NODE_ENV !== 'production' || process.env.OAUTH_DEV_MODE === 'true'
    if (!cfg.clientId) {
      if (!allowDev) {
        return res.status(503).json({ error: `${provider} OAuth is not configured`, code: 'oauth_not_configured' })
      }
      const code = `dev_${randomBytes(12).toString('hex')}`
      return res.json({
        auth_url: null,
        state,
        provider,
        dev: true,
        // Client posts this code to /callback in local/dev without a browser redirect.
        dev_code: code,
        redirect_uri: redirectUri,
      })
    }

    const authUrl = new URL(cfg.authUrl)
    authUrl.searchParams.set('client_id', cfg.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', cfg.scope)
    authUrl.searchParams.set('state', state)
    if (provider === 'google') authUrl.searchParams.set('access_type', 'online')
    if (provider === 'apple') authUrl.searchParams.set('response_mode', 'form_post')

    res.json({
      auth_url: authUrl.toString(),
      state,
      provider,
      dev: false,
      redirect_uri: redirectUri,
    })
  })

  app.post('/api/auth/oauth/:provider/callback', validate(oauthCallbackSchema), async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase()
    if (!OAUTH_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Unsupported OAuth provider' })
    }

    const stateRow = await consumeOAuthState(req.validated.state, provider)
    if (!stateRow) return res.status(400).json({ error: 'Invalid or expired OAuth state' })

    const cfg = oauthProviderConfig(provider)
    let profile
    try {
      profile = await exchangeOAuthCode({
        provider,
        code: req.validated.code,
        redirectUri: stateRow.redirect_uri || defaultOAuthRedirect(req, provider),
        cfg,
        idToken: req.validated.id_token,
      })
    } catch (err) {
      return res.status(err.status || 401).json({
        error: err.message || 'OAuth failed',
        code: err.code || 'oauth_failed',
      })
    }

    if (!profile?.providerUserId) {
      return res.status(401).json({ error: 'OAuth profile missing subject' })
    }

    let user = await findUserForOAuthProfile({
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
    })

    if (!user) {
      return res.status(404).json({
        error: 'No WingCaster account is linked to this identity. Sign up first, then connect OAuth.',
        code: 'oauth_account_not_found',
        provider,
        email: profile.email || null,
      })
    }

    if (!user.verified || !user.verified_at) {
      return res.status(401).json({ error: 'email_not_verified' })
    }

    await upsertOAuthIdentity({
      provider,
      providerUserId: profile.providerUserId,
      userId: user.id,
      email: profile.email,
      profile: profile.profile,
    })

    const agent = await findAgentForUser(user.id)
    if (!agent) return res.status(401).json({ error: 'Invalid credentials' })

    if (typeof startSigninChallengeIfRequired === 'function') {
      const challenge = await startSigninChallengeIfRequired(user, req)
      if (challenge) {
        return res.json({ status: '2fa_required', challenge_id: challenge.id, method: challenge.method })
      }
    }

    const session = await buildAuthSession(user, agent, {
      activeTenantId: await resolveActiveTenantId(user),
      env: fromAnyEnv(user.env || user.fin_environment),
    })
    res.json(session)
  })
}

export const __test = {
  serializeNotification,
  oauthProviderConfig,
  scopedSearch,
  OAUTH_PROVIDERS,
}
